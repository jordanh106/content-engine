import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { storyboards, storyboardShots, videoStatus, productionChecklist } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import type { ProductionStyle, ShotProductionCard, ProductionChecklistItem } from "../../shared/types.js";
import {
  PRE_PRODUCTION_CHECKLISTS,
  POST_PRODUCTION_CHECKLISTS,
  CINEMA_DEFAULTS_BY_FORMAT,
  getFilmingTips,
  suggestCameraMovement,
  recommendToolAndModel,
  suggestVfxTrick,
} from "../../shared/production-knowledge.js";

export function createProductionCompanionRouter(contentLibraryPath: string) {
  const router = Router();

  // GET /api/produce/:videoCode - Full production companion data
  router.get("/:videoCode", (req, res) => {
    try {
      const videoCode = req.params.videoCode.toUpperCase();

      // Load video from content library
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === videoCode);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      // Load production style
      const statusRecord = db
        .select()
        .from(videoStatus)
        .where(eq(videoStatus.videoCode, videoCode))
        .get();
      const style = (statusRecord?.productionStyle as ProductionStyle) || null;

      // Load latest storyboard + shots
      const storyboardRow = db
        .select()
        .from(storyboards)
        .where(eq(storyboards.videoCode, videoCode))
        .orderBy(storyboards.id)
        .limit(1)
        .all();

      let shotCards: ShotProductionCard[] = [];

      if (storyboardRow.length > 0) {
        const sb = storyboardRow[0];
        const shots = db
          .select()
          .from(storyboardShots)
          .where(eq(storyboardShots.storyboardId, sb.id))
          .orderBy(storyboardShots.orderIndex)
          .all();

        // Load shot completion state
        const completions = db
          .select()
          .from(productionChecklist)
          .where(
            and(
              eq(productionChecklist.videoCode, videoCode),
              eq(productionChecklist.checklistType, "shot_completion"),
            ),
          )
          .all();
        const completedShots = new Set(
          completions.filter((c) => c.completed).map((c) => c.itemKey),
        );

        const formatId = video.format;

        shotCards = shots.map((shot) => {
          const method = shot.productionMethod as "real" | "ai_enhanced" | "ai_generated" | "motion_graphic";
          const tips = getFilmingTips(method, style);
          const toolModel = recommendToolAndModel(method, shot.shotType, shot.act);
          const movement = suggestCameraMovement(shot.shotType, shot.act, method, formatId);
          const trick = suggestVfxTrick(method, shot.shotType, shot.act);

          // Camera defaults for AI-generated shots
          const cameraDefaults =
            method === "ai_generated" && CINEMA_DEFAULTS_BY_FORMAT[formatId]
              ? {
                  camera: CINEMA_DEFAULTS_BY_FORMAT[formatId].camera,
                  lens: CINEMA_DEFAULTS_BY_FORMAT[formatId].lens,
                  focalLength: CINEMA_DEFAULTS_BY_FORMAT[formatId].focalLength,
                  genre: CINEMA_DEFAULTS_BY_FORMAT[formatId].genre,
                }
              : null;

          return {
            shotNumber: shot.shotNumber,
            act: shot.act,
            durationSeconds: shot.durationSeconds,
            scriptLine: shot.scriptLine,
            productionMethod: method,
            filmingTips: tips,
            toolRecommendation: toolModel?.tool || null,
            modelRecommendation: toolModel?.model || null,
            vfxTrick: trick,
            cameraDefaults,
            suggestedMovement: movement?.movement || null,
            suggestedMovementReason: movement?.reason || null,
            colorGradeNotes:
              method === "ai_enhanced" || method === "ai_generated"
                ? CINEMA_DEFAULTS_BY_FORMAT[formatId]?.colorNotes || null
                : null,
            cinemaStudioPrompt: shot.cinemaStudioPrompt,
            aiEnhancementNotes: shot.aiEnhancementNotes,
            remotionComponent: shot.remotionComponent,
            completed: completedShots.has(`shot_${shot.shotNumber}`),
          };
        });
      }

      // Load pre/post production checklists with completion state
      const allChecks = db
        .select()
        .from(productionChecklist)
        .where(eq(productionChecklist.videoCode, videoCode))
        .all();
      const completedKeys = new Set(
        allChecks.filter((c) => c.completed).map((c) => `${c.checklistType}:${c.itemKey}`),
      );

      const preItems = (style ? PRE_PRODUCTION_CHECKLISTS[style] : PRE_PRODUCTION_CHECKLISTS.real).map(
        (item) => ({
          ...item,
          category: "pre_production" as const,
          completed: completedKeys.has(`pre_production:${item.key}`),
        }),
      );

      const postItems = (style ? POST_PRODUCTION_CHECKLISTS[style] : POST_PRODUCTION_CHECKLISTS.real).map(
        (item) => ({
          ...item,
          category: "post_production" as const,
          completed: completedKeys.has(`post_production:${item.key}`),
        }),
      );

      // Compute completion stats
      const preCompleted = preItems.filter((i) => i.completed).length;
      const shotsCompleted = shotCards.filter((s) => s.completed).length;
      const postCompleted = postItems.filter((i) => i.completed).length;
      const totalItems = preItems.length + shotCards.length + postItems.length;
      const totalCompleted = preCompleted + shotsCompleted + postCompleted;

      res.json({
        preProduction: preItems,
        shotCards,
        postProduction: postItems,
        productionStyle: style,
        formatId: video.format,
        completion: {
          pre: preItems.length > 0 ? Math.round((preCompleted / preItems.length) * 100) : 100,
          shots: shotCards.length > 0 ? Math.round((shotsCompleted / shotCards.length) * 100) : 100,
          post: postItems.length > 0 ? Math.round((postCompleted / postItems.length) * 100) : 100,
          overall: totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 100,
        },
      });
    } catch (error) {
      console.error("[produce] Error:", error);
      res.status(500).json({ error: "Failed to load production data" });
    }
  });

  // PUT /api/produce/:videoCode/check - Toggle a checklist item
  router.put("/:videoCode/check", (req, res) => {
    try {
      const videoCode = req.params.videoCode.toUpperCase();
      const { itemKey, checklistType, completed } = req.body as {
        itemKey: string;
        checklistType: string;
        completed: boolean;
      };

      if (!itemKey || !checklistType) {
        res.status(400).json({ error: "itemKey and checklistType required" });
        return;
      }

      // Upsert the checklist item
      const existing = db
        .select()
        .from(productionChecklist)
        .where(
          and(
            eq(productionChecklist.videoCode, videoCode),
            eq(productionChecklist.checklistType, checklistType),
            eq(productionChecklist.itemKey, itemKey),
          ),
        )
        .get();

      const now = new Date().toISOString();

      if (existing) {
        db.update(productionChecklist)
          .set({
            completed,
            completedAt: completed ? now : null,
          })
          .where(eq(productionChecklist.id, existing.id))
          .run();
      } else {
        db.insert(productionChecklist)
          .values({
            videoCode,
            checklistType,
            itemKey,
            completed,
            completedAt: completed ? now : null,
          })
          .run();
      }

      res.json({ videoCode, itemKey, checklistType, completed });
    } catch (error) {
      console.error("[produce] Check error:", error);
      res.status(500).json({ error: "Failed to update checklist" });
    }
  });

  return router;
}
