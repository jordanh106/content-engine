import { Router } from "express";
import { db, sqlite } from "../db.js";
import { creatorProgress, questEvents } from "../../shared/schema.js";
import { CREATOR_LEVELS } from "../../shared/types.js";
import { QUESTS, getQuestsForLevel, getQuestById, getNextQuest } from "../../shared/quests.js";
import { eq, desc } from "drizzle-orm";

export function createGrowthRouter() {
  const router = Router();

  // GET /api/growth - Get current creator progress + quest state
  router.get("/", async (_req, res) => {
    try {
      const rows = await db.select().from(creatorProgress).limit(1);
      const progress = rows[0];
      if (!progress) {
        return res.status(500).json({ error: "No creator progress found" });
      }

      const completedIds: string[] = JSON.parse(progress.questsCompleted || "[]");
      const milestones: string[] = JSON.parse(progress.milestonesReached || "[]");

      const currentLevel = CREATOR_LEVELS.find((l) => l.level === progress.level) ?? CREATOR_LEVELS[0];
      const nextLevel = CREATOR_LEVELS.find((l) => l.level === progress.level + 1) ?? null;
      const xpToNextLevel = nextLevel ? nextLevel.xpRequired - progress.xp : 0;
      const levelXpStart = currentLevel.xpRequired;
      const levelXpEnd = nextLevel ? nextLevel.xpRequired : currentLevel.xpRequired;
      const xpProgress = levelXpEnd > levelXpStart
        ? Math.round(((progress.xp - levelXpStart) / (levelXpEnd - levelXpStart)) * 100)
        : 100;

      // Get active quest or find next one
      let activeQuest: ReturnType<typeof getQuestById> = undefined;
      if (progress.activeQuestId) {
        activeQuest = getQuestById(progress.activeQuestId);
      }
      if (!activeQuest) {
        activeQuest = getNextQuest(progress.level, completedIds);
      }

      // Available quests for current level
      const availableQuests = getQuestsForLevel(progress.level).filter(
        (q) => !completedIds.includes(q.id),
      );

      // Recent events
      const recentEvents = await db
        .select()
        .from(questEvents)
        .orderBy(desc(questEvents.createdAt))
        .limit(10);

      res.json({
        progress: {
          ...progress,
          questsCompleted: completedIds,
          milestonesReached: milestones,
        },
        currentLevel,
        nextLevel,
        xpToNextLevel,
        xpProgress,
        activeQuest: activeQuest ?? null,
        availableQuests,
        recentEvents,
      });
    } catch (err) {
      console.error("Growth GET error:", err);
      res.status(500).json({ error: "Failed to fetch growth data" });
    }
  });

  // POST /api/growth/quest-event - Record a quest event (step completed, quest completed)
  router.post("/quest-event", async (req, res) => {
    try {
      const { questId, stepId, eventType } = req.body as {
        questId: string;
        stepId?: string;
        eventType: "step_completed" | "quest_completed" | "started";
      };

      const quest = getQuestById(questId);
      if (!quest) {
        return res.status(404).json({ error: "Quest not found" });
      }

      const rows = await db.select().from(creatorProgress).limit(1);
      const progress = rows[0];
      if (!progress) {
        return res.status(500).json({ error: "No creator progress" });
      }

      const completedIds: string[] = JSON.parse(progress.questsCompleted || "[]");

      if (eventType === "started") {
        // Set active quest
        sqlite.prepare("UPDATE creator_progress SET active_quest_id = ?, updated_at = datetime('now')").run(questId);

        await db.insert(questEvents).values({
          questId,
          eventType: "started",
          xpAwarded: 0,
          coachMessage: null,
        });

        return res.json({ ok: true, event: "started" });
      }

      if (eventType === "step_completed" && stepId) {
        const step = quest.steps.find((s) => s.id === stepId);
        if (!step) {
          return res.status(404).json({ error: "Step not found" });
        }

        // Award XP
        const newXp = progress.xp + step.xp;
        sqlite.prepare("UPDATE creator_progress SET xp = ?, updated_at = datetime('now')").run(newXp);

        await db.insert(questEvents).values({
          questId,
          eventType: "completed",
          xpAwarded: step.xp,
          coachMessage: step.coachMessage,
        });

        return res.json({
          ok: true,
          event: "step_completed",
          stepId,
          xpAwarded: step.xp,
          totalXp: newXp,
          coachMessage: step.coachMessage,
        });
      }

      if (eventType === "quest_completed") {
        // Mark quest as completed
        if (!completedIds.includes(questId)) {
          completedIds.push(questId);
        }

        // Check for level up
        const newXp = progress.xp;
        let newLevel = progress.level;
        let newLevelName = progress.levelName;
        let leveledUp = false;

        for (const lvl of CREATOR_LEVELS) {
          if (lvl.level > newLevel && newXp >= lvl.xpRequired) {
            // Check if all quests for current level are completed
            const currentLevelQuests = getQuestsForLevel(newLevel);
            const allDone = currentLevelQuests.every((q) => completedIds.includes(q.id));
            if (allDone) {
              newLevel = lvl.level;
              newLevelName = lvl.name;
              leveledUp = true;
            }
          }
        }

        // Find next quest
        const nextQuest = getNextQuest(newLevel, completedIds);

        sqlite.prepare(
          "UPDATE creator_progress SET level = ?, level_name = ?, quests_completed = ?, active_quest_id = ?, updated_at = datetime('now')"
        ).run(newLevel, newLevelName, JSON.stringify(completedIds), nextQuest?.id ?? null);

        await db.insert(questEvents).values({
          questId,
          eventType: "completed",
          xpAwarded: 0,
          coachMessage: quest.completionMessage,
        });

        return res.json({
          ok: true,
          event: "quest_completed",
          questId,
          completionMessage: quest.completionMessage,
          leveledUp,
          newLevel,
          newLevelName,
          nextQuestId: nextQuest?.id ?? null,
        });
      }

      res.status(400).json({ error: "Invalid event type" });
    } catch (err) {
      console.error("Quest event error:", err);
      res.status(500).json({ error: "Failed to record quest event" });
    }
  });

  // POST /api/growth/track - Track an action for quest progress (called by views)
  router.post("/track", async (req, res) => {
    try {
      const { action, target } = req.body as { action: string; target?: string };

      // Return the current active quest and whether this action completes a step
      const rows = await db.select().from(creatorProgress).limit(1);
      const progress = rows[0];
      if (!progress?.activeQuestId) {
        return res.json({ matched: false });
      }

      const quest = getQuestById(progress.activeQuestId);
      if (!quest) {
        return res.json({ matched: false });
      }

      // Find the first uncompleted step that matches this action
      const recentEvents = await db
        .select()
        .from(questEvents)
        .orderBy(desc(questEvents.createdAt))
        .limit(50);

      const completedStepIds = new Set(
        recentEvents
          .filter((e) => e.eventType === "completed")
          .map((e) => e.questId)
      );

      for (const step of quest.steps) {
        // Skip already completed steps
        if (completedStepIds.has(step.id)) continue;

        const matches =
          (step.checkType === "view_visit" && action === "view_visit" && target === step.checkTarget) ||
          (step.checkType === "action" && action === step.checkTarget) ||
          (step.checkType === "count" && action === step.checkTarget);

        if (matches) {
          return res.json({
            matched: true,
            questId: quest.id,
            stepId: step.id,
            stepTitle: step.title,
            coachMessage: step.coachMessage,
            xp: step.xp,
          });
        }

        // Only match the first uncompleted step (sequential)
        break;
      }

      res.json({ matched: false });
    } catch (err) {
      console.error("Track error:", err);
      res.json({ matched: false });
    }
  });

  return router;
}
