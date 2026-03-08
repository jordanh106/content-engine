import { Router } from "express";

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

interface N8nWorkflowConfig {
  id: string;
  label: string;
  schedule: string;
}

const TRACKED_WORKFLOWS: N8nWorkflowConfig[] = [
  { id: process.env.N8N_WORKFLOW_ID ?? "", label: "Content Intelligence - Weekly Digest", schedule: "Monday 8am" },
  { id: process.env.N8N_WATCHLIST_INTEL_WORKFLOW_ID ?? "", label: "Watchlist Intelligence", schedule: "Wednesday 8am" },
  { id: process.env.N8N_METRICS_WORKFLOW_ID ?? "", label: "Metrics Sync", schedule: "On demand" },
].filter((w) => w.id);

export function createAutomationRouter() {
  const router = Router();

  // GET /api/automation/status - Get status of all tracked n8n workflows
  router.get("/status", async (_req, res) => {
    if (!N8N_API_URL || !N8N_API_KEY) {
      res.json({
        configured: false,
        workflows: [],
        message: "n8n API not configured. Set N8N_API_URL and N8N_API_KEY in .env",
      });
      return;
    }

    try {
      const results = await Promise.all(
        TRACKED_WORKFLOWS.map(async (wf) => {
          try {
            // Get workflow details
            const wfRes = await fetch(`${N8N_API_URL}/workflows/${wf.id}`, {
              headers: { "X-N8N-API-KEY": N8N_API_KEY! },
            });
            const wfData = wfRes.ok ? await wfRes.json() : null;

            // Get last execution
            const execRes = await fetch(
              `${N8N_API_URL}/executions?workflowId=${wf.id}&limit=3&status=success,error`,
              { headers: { "X-N8N-API-KEY": N8N_API_KEY! } },
            );
            const execData = execRes.ok ? await execRes.json() : { data: [] };
            const executions = execData.data ?? [];

            const lastExecution = executions[0] ?? null;

            return {
              id: wf.id,
              label: wf.label,
              schedule: wf.schedule,
              active: wfData?.active ?? false,
              lastRun: lastExecution?.startedAt ?? null,
              lastStatus: lastExecution?.status ?? "unknown",
              lastFinished: lastExecution?.stoppedAt ?? null,
              recentExecutions: executions.slice(0, 3).map((e: { id: string; status: string; startedAt: string; stoppedAt: string }) => ({
                id: e.id,
                status: e.status,
                startedAt: e.startedAt,
                stoppedAt: e.stoppedAt,
              })),
            };
          } catch {
            return {
              id: wf.id,
              label: wf.label,
              schedule: wf.schedule,
              active: false,
              lastRun: null,
              lastStatus: "error",
              lastFinished: null,
              recentExecutions: [],
              error: "Failed to fetch workflow status",
            };
          }
        }),
      );

      res.json({ configured: true, workflows: results });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch n8n status";
      res.status(500).json({ error: message });
    }
  });

  return router;
}
