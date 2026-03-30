import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type TrackResult = {
  matched: boolean;
  questId?: string;
  stepId?: string;
  stepTitle?: string;
  coachMessage?: string;
  xp?: number;
};

type StepCompletionResult = {
  ok: boolean;
  event: string;
  stepId?: string;
  xpAwarded?: number;
  totalXp?: number;
  coachMessage?: string;
  // quest_completed fields
  questId?: string;
  completionMessage?: string;
  leveledUp?: boolean;
  newLevel?: number;
  newLevelName?: string;
  nextQuestId?: string | null;
};

export type CoachToast = {
  message: string;
  xp: number;
  stepTitle: string;
  questComplete?: boolean;
  levelUp?: { level: number; name: string };
};

/**
 * Hook for tracking quest progress from any view.
 *
 * Usage:
 *   const { trackAction, coachToast, dismissToast } = useQuestTracker();
 *
 *   // When user does something:
 *   trackAction("star_video");         // action-based
 *   trackAction("view_visit", "DISCOVER_FEED");  // view visit
 *
 * The hook will:
 * 1. POST to /api/growth/track to check if the action matches a quest step
 * 2. If matched, POST to /api/growth/quest-event to complete the step
 * 3. Check if the quest is now complete
 * 4. Set coachToast with the AI coaching message
 */
export function useQuestTracker() {
  const queryClient = useQueryClient();
  const [coachToast, setCoachToast] = useState<CoachToast | null>(null);

  const completeStepMutation = useMutation({
    mutationFn: async (params: { questId: string; stepId: string }) => {
      const r = await fetch("/api/growth/quest-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId: params.questId,
          stepId: params.stepId,
          eventType: "step_completed",
        }),
      });
      return r.json() as Promise<StepCompletionResult>;
    },
  });

  const completeQuestMutation = useMutation({
    mutationFn: async (questId: string) => {
      const r = await fetch("/api/growth/quest-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, eventType: "quest_completed" }),
      });
      return r.json() as Promise<StepCompletionResult>;
    },
  });

  const trackAction = useCallback(
    async (action: string, target?: string) => {
      try {
        const r = await fetch("/api/growth/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, target }),
        });
        const result: TrackResult = await r.json();

        if (!result.matched || !result.questId || !result.stepId) return;

        // Complete the step
        const stepResult = await completeStepMutation.mutateAsync({
          questId: result.questId,
          stepId: result.stepId,
        });

        if (!stepResult.ok) return;

        // Show coach toast
        setCoachToast({
          message: stepResult.coachMessage || result.coachMessage || "",
          xp: stepResult.xpAwarded || result.xp || 0,
          stepTitle: result.stepTitle || "",
        });

        // Check if quest is now complete by fetching fresh data
        queryClient.invalidateQueries({ queryKey: ["creator-growth"] });

        // Fetch fresh growth data to check if all steps are done
        const freshR = await fetch("/api/growth");
        const freshData = await freshR.json();

        // If the active quest has no more steps, complete it
        if (freshData.activeQuest?.id === result.questId) {
          const quest = freshData.activeQuest;
          const completedEvents = freshData.recentEvents.filter(
            (e: { questId: string; eventType: string }) =>
              e.questId === quest.id && e.eventType === "completed",
          );
          if (completedEvents.length >= quest.steps.length) {
            const questResult = await completeQuestMutation.mutateAsync(result.questId);
            if (questResult.ok) {
              setCoachToast((prev) => ({
                message: questResult.completionMessage || prev?.message || "",
                xp: prev?.xp || 0,
                stepTitle: prev?.stepTitle || "",
                questComplete: true,
                levelUp: questResult.leveledUp
                  ? { level: questResult.newLevel!, name: questResult.newLevelName! }
                  : undefined,
              }));
              queryClient.invalidateQueries({ queryKey: ["creator-growth"] });
            }
          }
        }
      } catch (err) {
        // Quest tracking is non-critical, don't break the app
        console.warn("Quest tracking error:", err);
      }
    },
    [completeStepMutation, completeQuestMutation, queryClient],
  );

  const dismissToast = useCallback(() => setCoachToast(null), []);

  return { trackAction, coachToast, dismissToast };
}
