import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Check,
  Sparkles,
  MessageCircle,
  Trophy,
  Loader2,
  Play,
} from "lucide-react";
import type { CreatorGrowthResponse, Quest, QuestStep, DashboardView } from "../../shared/types.js";

type QuestChainProps = {
  onNavigate?: (view: DashboardView) => void;
};

export const QuestChain: React.FC<QuestChainProps> = ({ onNavigate }) => {
  const queryClient = useQueryClient();
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [coachXp, setCoachXp] = useState(0);

  const { data } = useQuery<CreatorGrowthResponse>({
    queryKey: ["creator-growth"],
    queryFn: () => fetch("/api/growth").then((r) => r.json()),
    staleTime: 30_000,
  });

  const startQuestMutation = useMutation({
    mutationFn: async (questId: string) => {
      const r = await fetch("/api/growth/quest-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, eventType: "started" }),
      });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["creator-growth"] }),
  });

  if (!data) return null;

  const { activeQuest, availableQuests, recentEvents, progress } = data;
  const completedQuestIds = new Set(progress.questsCompleted);

  // Determine completed steps within active quest
  const completedStepIds = new Set(
    recentEvents
      .filter((e) => e.eventType === "completed" && e.questId === activeQuest?.id)
      .map((e) => e.questId),
  );

  const showCoach = (message: string, xp: number) => {
    setCoachMessage(message);
    setCoachXp(xp);
    setCoachVisible(true);
  };

  if (!activeQuest && availableQuests.length === 0) {
    // All quests for this level done
    return (
      <div className="bg-surface-elevated border border-themed rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={16} className="text-amber-500" />
          <h3 className="text-xs font-bold text-themed">Level {progress.level} Complete!</h3>
        </div>
        <p className="text-[11px] text-themed-secondary">
          You've completed all quests for this level. Keep creating to unlock the next level.
        </p>
      </div>
    );
  }

  const quest = activeQuest ?? availableQuests[0];
  if (!quest) return null;

  const isActive = activeQuest?.id === quest.id;
  const totalSteps = quest.steps.length;

  // For now, determine step completion from events
  // A simple approach: count completed events for this quest
  const questStepEvents = recentEvents.filter(
    (e) => e.questId === quest.id && e.eventType === "completed",
  );
  const completedStepCount = Math.min(questStepEvents.length, totalSteps);
  const currentStepIndex = completedStepCount;
  const currentStep = quest.steps[currentStepIndex];

  return (
    <div className="bg-surface-elevated border border-themed rounded-2xl overflow-hidden">
      {/* Quest header */}
      <div className="px-4 py-3 border-b border-themed-subtle bg-surface-hover">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            <h3 className="text-xs font-bold text-themed">{quest.title}</h3>
          </div>
          <span className="text-[10px] font-bold text-themed-muted">
            {completedStepCount}/{totalSteps}
          </span>
        </div>
        <p className="text-[11px] text-themed-tertiary mt-1">{quest.description}</p>
        {/* Step progress dots */}
        <div className="flex gap-1 mt-2.5">
          {quest.steps.map((step, i) => (
            <div
              key={step.id}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < completedStepCount
                  ? "bg-emerald-500"
                  : i === currentStepIndex
                  ? "bg-amber-400"
                  : "bg-surface-hover"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Current step or start button */}
      <div className="p-4">
        {!isActive ? (
          <button
            onClick={() => startQuestMutation.mutate(quest.id)}
            disabled={startQuestMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {startQuestMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Start Quest
          </button>
        ) : currentStep ? (
          <div className="space-y-3">
            {/* Current step card */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-black">{currentStepIndex + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-themed">{currentStep.title}</p>
                <p className="text-xs text-themed-secondary mt-0.5">{currentStep.description}</p>
                <div className="flex items-center gap-3 mt-2.5">
                  <span className="text-[10px] font-bold text-amber-500">+{currentStep.xp} XP</span>
                  {currentStep.checkType === "view_visit" && onNavigate && (
                    <button
                      onClick={() => onNavigate(currentStep.checkTarget as DashboardView)}
                      className="text-[11px] font-bold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-0.5"
                    >
                      Go there <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Completed steps summary */}
            {completedStepCount > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-themed-subtle">
                {quest.steps.slice(0, completedStepCount).map((step) => (
                  <div key={step.id} className="flex items-center gap-2 text-[11px] text-themed-tertiary">
                    <Check size={12} className="text-emerald-500 shrink-0" />
                    <span className="line-through">{step.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <Check size={20} className="text-emerald-500 mx-auto mb-1" />
            <p className="text-xs font-bold text-emerald-600">Quest Complete!</p>
          </div>
        )}
      </div>

      {/* Coach message overlay */}
      {coachVisible && (
        <div className="px-4 pb-4">
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <MessageCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-blue-600 mb-1">AI Coach</p>
                <p className="text-[11px] text-themed-secondary leading-relaxed">{coachMessage}</p>
                {coachXp > 0 && (
                  <p className="text-[10px] font-bold text-amber-500 mt-2">+{coachXp} XP earned</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setCoachVisible(false)}
              className="mt-2 text-[9px] font-bold text-blue-500 hover:text-blue-600"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
