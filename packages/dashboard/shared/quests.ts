import type { Quest } from "./types.js";

/**
 * Creator Growth Quest Definitions
 *
 * Each quest is a chain of steps that teach content creation skills
 * through doing. The AI coach messages provide contextual education
 * at each step -- this is the "learning in the flow of work" pattern.
 */

export const QUESTS: Quest[] = [
  // ===== LEVEL 1: OBSERVER =====
  {
    id: "L1_find_inspiration",
    levelRequired: 1,
    title: "Find Your First Inspiration",
    description: "Discover what's working in your niche by exploring viral content.",
    completionMessage: "You've trained your eye. Every great creator starts by studying what works.",
    totalXp: 30,
    steps: [
      {
        id: "L1_1_visit_discover",
        title: "Open the Discover feed",
        description: "Head to Discover to see what's trending in your niche.",
        coachMessage: "This is your inspiration engine. The videos here are sorted by outlier score, which means they performed way above the creator's average. That's the signal that something about THIS video worked unusually well.",
        xp: 10,
        checkType: "view_visit",
        checkTarget: "DISCOVER_FEED",
      },
      {
        id: "L1_1_star_videos",
        title: "Star 3 videos that catch your eye",
        description: "Star videos you'd want to learn from or adapt for your audience.",
        coachMessage: "Nice picks. Notice how the top-performing videos all have one thing in common: they hook you in the first 2 seconds. That's not luck, it's a pattern called 'pattern interrupt'. You'll learn to write these hooks yourself in the next level.",
        xp: 20,
        checkType: "count",
        checkTarget: "star_video",
        checkCount: 3,
      },
    ],
  },
  {
    id: "L1_decode_video",
    levelRequired: 1,
    title: "Decode What Makes a Video Work",
    description: "Open a video's intelligence panel and study its structure.",
    completionMessage: "You can now read the DNA of any viral video. This skill alone puts you ahead of 90% of creators who just post and hope.",
    totalXp: 30,
    steps: [
      {
        id: "L1_2_open_intel",
        title: "Open any video's Intelligence panel",
        description: "Click a video in Discover or the Watchlist to see its breakdown.",
        coachMessage: "This is the Intelligence panel. It deconstructs any video into its components: hook type, story structure, visual style, and more. Think of it like a recipe card for viral content.",
        xp: 10,
        checkType: "action",
        checkTarget: "open_video_intel",
      },
      {
        id: "L1_2_save_hook",
        title: "Save a hook to your Vault",
        description: "Found a hook you like? Save it so you can adapt it later.",
        coachMessage: "Smart move. Your Vault is your personal swipe file. Professional copywriters have been keeping swipe files for decades. Every hook you save here becomes raw material for your own scripts.",
        xp: 20,
        checkType: "action",
        checkTarget: "save_hook_vault",
      },
    ],
  },
  {
    id: "L1_study_creator",
    levelRequired: 1,
    title: "Study a Creator's Strategy",
    description: "Scan a watchlist creator's videos to understand their patterns.",
    completionMessage: "Level 1 complete! You've learned to observe, decode, and study. Now it's time to create.",
    totalXp: 40,
    steps: [
      {
        id: "L1_3_visit_watchlist",
        title: "Go to the Watchlist",
        description: "Check out the creators you're tracking.",
        coachMessage: "Your Watchlist tracks creators in your niche. Watching what works for THEM tells you what will work for YOUR audience, because you share similar viewers.",
        xp: 10,
        checkType: "view_visit",
        checkTarget: "INTELLIGENCE",
      },
      {
        id: "L1_3_scan_creator",
        title: "Scan a creator's recent videos",
        description: "Click the scan button next to any creator to pull their latest content.",
        coachMessage: "You just did competitive intelligence. Look at their outlier scores: anything above 2x means that video dramatically outperformed their average. Those are the ones worth studying closely.",
        xp: 30,
        checkType: "action",
        checkTarget: "scan_creator",
      },
    ],
  },

  // ===== LEVEL 2: WRITER =====
  {
    id: "L2_first_script",
    levelRequired: 2,
    title: "Write Your First Script",
    description: "Use the Script Wizard to create your first video script.",
    completionMessage: "You wrote your first script! The hardest part of content creation is starting. You just did it.",
    totalXp: 50,
    steps: [
      {
        id: "L2_1_open_wizard",
        title: "Open the Script Wizard",
        description: "Go to Create to start writing.",
        coachMessage: "The Script Wizard helps you write scripts using proven formats. Each format (Explainer, Myth Buster, Quick Tip, etc.) has a built-in story structure that's been tested across thousands of videos.",
        xp: 10,
        checkType: "view_visit",
        checkTarget: "SCRIPT_WIZARD",
      },
      {
        id: "L2_1_save_script",
        title: "Save a completed script",
        description: "Write and save your first script to the library.",
        coachMessage: "Your first script is in the Library! Pro tip: the hook is 80% of your video's success. Most viewers decide to watch or scroll within 1.5 seconds. Your hook needs to create curiosity, state a problem, or challenge a belief.",
        xp: 40,
        checkType: "action",
        checkTarget: "save_script",
      },
    ],
  },
  {
    id: "L2_explore_formats",
    levelRequired: 2,
    title: "Explore Different Formats",
    description: "Browse the Library to see all 7 video format templates.",
    completionMessage: "You now know the 7 formats. Most successful creators use 3-4 consistently. Myth Busters (D) and Quick Tips (F) are the easiest to start with.",
    totalXp: 30,
    steps: [
      {
        id: "L2_2_visit_library",
        title: "Browse the content library",
        description: "Check out the 57 pre-written scripts across 7 formats.",
        coachMessage: "Your library has scripts organized by audience (pregnancy, pediatric, athletes, etc.) and format (A through G). Each format has a different strength: Explainers build authority, Myth Busters drive comments, Quick Tips get shares.",
        xp: 15,
        checkType: "view_visit",
        checkTarget: "LIBRARY",
      },
      {
        id: "L2_2_open_detail",
        title: "Open any video's detail panel",
        description: "Click a video to see its full script, shots, and production info.",
        coachMessage: "Every script includes delivery cues in brackets like [Warm, empathetic] or [Authoritative]. These aren't optional, they're the difference between content that connects and content that falls flat. Your tone IS your brand.",
        xp: 15,
        checkType: "action",
        checkTarget: "open_video_detail",
      },
    ],
  },

  // ===== LEVEL 3: PRODUCER =====
  {
    id: "L3_first_session",
    levelRequired: 3,
    title: "Your First Production Session",
    description: "Set up and start a batch recording session.",
    completionMessage: "You just batch-produced content like a pro. This is how the top 1% of creators work: sessions, not random filming.",
    totalXp: 60,
    steps: [
      {
        id: "L3_1_set_style",
        title: "Set a production style on a video",
        description: "Choose Real, Enhanced, Heavy AI, or Full AI for any scripted video.",
        coachMessage: "Production style determines your workflow. 'Real' means you film everything. 'Full AI' means voiceover + AI visuals. Most creators start with 'Enhanced': you on camera with AI polish. It's the sweet spot of authenticity and production value.",
        xp: 20,
        checkType: "action",
        checkTarget: "set_production_style",
      },
      {
        id: "L3_1_advance_pipeline",
        title: "Move a video through the pipeline",
        description: "Advance any video from Scripted to Recording.",
        coachMessage: "You just moved content through the pipeline. This is the batch production model: Script night, Record night, Generate night, Assemble night. Each session takes 45-60 minutes and produces 5-8 videos. That's the leverage.",
        xp: 40,
        checkType: "action",
        checkTarget: "advance_status",
      },
    ],
  },

  // ===== LEVEL 4: PUBLISHER =====
  {
    id: "L4_first_publish",
    levelRequired: 4,
    title: "Publish Your First Video",
    description: "Mark a video as published and log where it went live.",
    completionMessage: "You're published! 95% of practices never post a single video. You just joined the 5% who do.",
    totalXp: 80,
    steps: [
      {
        id: "L4_1_schedule",
        title: "Schedule a video on the calendar",
        description: "Add a video to your publishing calendar.",
        coachMessage: "Scheduling creates commitment. The most successful creators post on a consistent schedule, not 'whenever they feel like it'. Your audience builds expectations around your rhythm. Even 2 videos per week builds serious momentum over 90 days.",
        xp: 30,
        checkType: "action",
        checkTarget: "schedule_video",
      },
      {
        id: "L4_1_publish",
        title: "Mark a video as published",
        description: "After posting, mark it published in the pipeline.",
        coachMessage: "Congratulations, you're officially a content creator. Now the real game begins: learning what works. Head to Intelligence after a few days to see your metrics. But here's the secret: consistency matters more than any single video's performance.",
        xp: 50,
        checkType: "action",
        checkTarget: "publish_video",
      },
    ],
  },

  // ===== LEVEL 5: STRATEGIST =====
  {
    id: "L5_analyze_performance",
    levelRequired: 5,
    title: "Read Your Performance Data",
    description: "Log metrics and find patterns in what's working.",
    completionMessage: "You're now making data-driven content decisions. This is the difference between creators who plateau and creators who grow.",
    totalXp: 100,
    steps: [
      {
        id: "L5_1_log_metrics",
        title: "Log metrics for a published video",
        description: "Enter views, likes, saves, and comments for any published video.",
        coachMessage: "Saves are your most important metric, not views. A high save rate means people found your content valuable enough to come back to. That signals the algorithm to push your content to more people. Watch your save rate closely.",
        xp: 40,
        checkType: "action",
        checkTarget: "log_metrics",
      },
      {
        id: "L5_1_generate_opps",
        title: "Generate content opportunities",
        description: "Run the opportunity generator to find data-backed content ideas.",
        coachMessage: "You're now using data to decide what to create next. Most creators guess. You're using audience signals, trending topics, and content gap analysis. This is how you build a content engine that compounds over time.",
        xp: 60,
        checkType: "action",
        checkTarget: "generate_opportunities",
      },
    ],
  },
];

/** Get quests available for a given level */
export function getQuestsForLevel(level: number): Quest[] {
  return QUESTS.filter((q) => q.levelRequired === level);
}

/** Get a quest by ID */
export function getQuestById(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}

/** Get the next uncompleted quest for a level */
export function getNextQuest(level: number, completedIds: string[]): Quest | undefined {
  return QUESTS.find((q) => q.levelRequired === level && !completedIds.includes(q.id));
}
