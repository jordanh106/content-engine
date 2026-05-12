import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Activity, Send, FolderKanban } from "lucide-react";
import { clsx } from "clsx";

type HFStatus = { configured: boolean; credits?: number; email?: string };
type RecentJobs = { jobs: { status: string }[]; inFlightCount: number; error?: string };
type Today = { publishedToday: number; sessionInProgress: boolean };
type ActiveProject = { active: { id: string; name: string; kind: string } | null };

/**
 * Home "Now" strip — live situational awareness across the top of the dashboard.
 *
 * Shows credits, generations in flight, published-today count, and active project name.
 * All four data sources refresh every 15s. When any value changes, the strip pulses
 * once (CSS animation) to draw the eye.
 */
export const HomeNowStrip: React.FC = () => {
  const { data: status } = useQuery<HFStatus>({
    queryKey: ["hf-status-now-strip"],
    queryFn: () => fetch("/api/higgsfield/status").then((r) => r.json()),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const { data: jobs } = useQuery<RecentJobs>({
    queryKey: ["hf-recent-jobs-strip"],
    queryFn: () => fetch("/api/higgsfield/recent-jobs?limit=20").then((r) => r.json()),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const { data: today } = useQuery<Today>({
    queryKey: ["metrics-today"],
    queryFn: () => fetch("/api/metrics/today").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const { data: activeProj } = useQuery<ActiveProject>({
    queryKey: ["project-active"],
    queryFn: () => fetch("/api/projects/active").then((r) => r.ok ? r.json() : { active: null }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Pulse on data change — track previous values to detect deltas
  const [pulseKey, setPulseKey] = useState(0);
  const credits = status?.credits != null ? Math.round(status.credits) : null;
  const inFlight = jobs?.inFlightCount ?? 0;
  const published = today?.publishedToday ?? 0;
  const projectName = activeProj?.active?.name ?? null;

  useEffect(() => {
    setPulseKey((k) => k + 1);
  }, [credits, inFlight, published, projectName]);

  return (
    <div
      key={pulseKey}
      className="surface-floating px-5 py-3 flex items-center flex-wrap gap-x-5 gap-y-2 animate-in fade-in duration-300"
    >
      {/* Credits */}
      {credits != null && (
        <NowSegment
          icon={<Sparkles size={14} className="text-teal-500" />}
          label="Credits"
          value={`${credits.toLocaleString()} cr`}
          tone="default"
        />
      )}

      {/* In-flight */}
      <NowSegment
        icon={<Activity size={14} className={inFlight > 0 ? "text-amber-500 animate-pulse" : "text-slate-400"} />}
        label="In flight"
        value={inFlight > 0 ? `${inFlight} generating` : "Idle"}
        tone={inFlight > 0 ? "amber" : "muted"}
      />

      {/* Published today */}
      <NowSegment
        icon={<Send size={14} className={published > 0 ? "text-emerald-500" : "text-slate-400"} />}
        label="Today"
        value={`${published} published`}
        tone={published > 0 ? "emerald" : "muted"}
      />

      {/* Active project */}
      {projectName && (
        <NowSegment
          icon={<FolderKanban size={14} className="text-teal-600" />}
          label="Project"
          value={projectName}
          tone="accent"
          asLink={activeProj?.active ? `/projects/${activeProj.active.id}` : undefined}
        />
      )}
    </div>
  );
};

const NowSegment: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "default" | "muted" | "accent" | "amber" | "emerald";
  asLink?: string;
}> = ({ icon, label, value, tone, asLink }) => {
  const valueClass = clsx(
    "text-sm font-semibold tabular-nums",
    tone === "default" && "text-slate-800",
    tone === "muted" && "text-slate-500",
    tone === "accent" && "text-teal-700",
    tone === "amber" && "text-amber-700",
    tone === "emerald" && "text-emerald-700",
  );

  const inner = (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span className="type-meta">{label}</span>
      <span className={valueClass}>{value}</span>
    </span>
  );

  if (asLink) {
    return <a href={asLink} className="hover:opacity-80 transition-opacity">{inner}</a>;
  }
  return inner;
};
