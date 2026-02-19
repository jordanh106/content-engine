import { Composition, Folder } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Explainer } from "./compositions/Explainer";
import { Checklist } from "./compositions/Checklist";
import { Demo } from "./compositions/Demo";
import { MythBuster } from "./compositions/MythBuster";
import { Walkthrough } from "./compositions/Walkthrough";
import { ShotTitleCard } from "./compositions/shots/ShotTitleCard";
import { ShotStatCard } from "./compositions/shots/ShotStatCard";
import { ShotSectionCard } from "./compositions/shots/ShotSectionCard";
import { ShotHookText } from "./compositions/shots/ShotHookText";
import { ShotChecklist } from "./compositions/shots/ShotChecklist";
import { ShotMythTruth } from "./compositions/shots/ShotMythTruth";
import { ShotStepIndicator } from "./compositions/shots/ShotStepIndicator";
import { ShotFrequencyCard } from "./compositions/shots/ShotFrequencyCard";
import { ShotCallToAction } from "./compositions/shots/ShotCallToAction";
import { ShotChartCard } from "./compositions/shots/ShotChartCard";
import { ShotQuoteCard } from "./compositions/shots/ShotQuoteCard";
import { ExplainerSchema } from "./schemas/explainer";
import { ChecklistSchema } from "./schemas/checklist";
import { DemoSchema } from "./schemas/demo";
import { MythBusterSchema } from "./schemas/myth-buster";
import { WalkthroughSchema } from "./schemas/walkthrough";
import {
  ShotTitleCardSchema,
  ShotStatCardSchema,
  ShotSectionCardSchema,
  ShotHookTextSchema,
  ShotChecklistSchema,
  ShotMythTruthSchema,
  ShotStepIndicatorSchema,
  ShotFrequencyCardSchema,
  ShotCTASchema,
  ShotChartCardSchema,
  ShotQuoteCardSchema,
} from "./schemas/shot";
import type {
  ShotTitleCardProps,
  ShotStatCardProps,
  ShotSectionCardProps,
  ShotHookTextProps,
  ShotChecklistProps,
  ShotMythTruthProps,
  ShotStepIndicatorProps,
  ShotFrequencyCardProps,
  ShotCTAProps,
  ShotChartCardProps,
  ShotQuoteCardProps,
} from "./schemas/shot";
import { defaultTheme } from "./schemas/theme";
import type { ExplainerProps } from "./schemas/explainer";
import type { ChecklistProps } from "./schemas/checklist";
import type { DemoProps } from "./schemas/demo";
import type { MythBusterProps } from "./schemas/myth-buster";
import type { WalkthroughProps } from "./schemas/walkthrough";

// 9:16 vertical video (short-form)
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

// Dynamic duration calculator for shot compositions
const calcShotMetadata = <T extends { durationInSeconds: number }>(): CalculateMetadataFunction<T> => {
  return async ({ props }) => {
    return {
      durationInFrames: Math.round(props.durationInSeconds * FPS),
    };
  };
};

const explainerDefaults: ExplainerProps = {
  title: "What Is Tech Neck?",
  hookText: "That neck pain you feel after scrolling? It has a name.",
  sections: [
    {
      label: "What's happening",
      text: "When you look down at your phone, your head shifts forward. That puts up to 60 pounds of extra pressure on your spine.",
      durationInSeconds: 6,
    },
    {
      label: "Why it matters",
      text: "Over time, this changes the curve of your neck. It leads to headaches, shoulder tension, and even numbness in your hands.",
      durationInSeconds: 6,
    },
    {
      label: "What you can do",
      text: "Bring your phone to eye level. Take breaks every 20 minutes. And if it's already causing pain, get it checked before it gets worse.",
      durationInSeconds: 6,
    },
  ],
  stat: { value: "60 lbs", label: "of extra pressure on your spine" },
  ctaText: "Share this with someone who's always on their phone.",
  theme: defaultTheme,
};

const checklistDefaults: ChecklistProps = {
  title: "Signs Your Baby Needs Help",
  hookText:
    "5 signs your baby is trying to tell you something. Most parents miss number 4.",
  items: [
    {
      number: 1,
      label: "Head always tilted one way",
      description: "This could indicate torticollis from birth positioning.",
    },
    {
      number: 2,
      label: "Trouble latching on one side",
      description:
        "Neck tension can make it painful to turn, affecting feeding.",
    },
    {
      number: 3,
      label: "Arching their back constantly",
      description:
        "Often dismissed as colic, but may signal spinal discomfort.",
    },
    {
      number: 4,
      label: "Skipping crawling",
      description:
        "Going straight to walking can mean retained primitive reflexes.",
    },
    {
      number: 5,
      label: "One flat spot on the head",
      description:
        "Plagiocephaly often comes from restricted neck movement.",
    },
  ],
  closingText: "How many did you check?",
  ctaText: "Save this so you remember what to watch for.",
  theme: defaultTheme,
};

const demoDefaults: DemoProps = {
  title: "Chin Tucks",
  hookText: "If you sit at a desk all day, try this.",
  steps: [
    { instruction: "Sit up straight with your shoulders relaxed." },
    {
      instruction:
        "Pull your chin straight back, like you're making a double chin.",
    },
    { instruction: "Hold for 5 seconds. You should feel a stretch at the base of your skull." },
    { instruction: "Release slowly. That's one rep." },
  ],
  keyCue:
    "Keep your eyes level. Don't tilt your head up or down.",
  frequency: "3 sets of 10, twice daily",
  ctaText: "Save this and try it today.",
  theme: defaultTheme,
};

const mythBusterDefaults: MythBusterProps = {
  mythText: "Cracking your knuckles causes arthritis.",
  truthText:
    "Research shows zero connection between knuckle cracking and arthritis.",
  explanationText:
    "That popping sound is just gas bubbles releasing in the joint fluid. A 60-year self-experiment by Dr. Donald Unger proved it. He cracked only one hand daily for decades. No difference.",
  ctaText: "Did you believe this? Drop it in the comments.",
  theme: defaultTheme,
};

const walkthroughDefaults: WalkthroughProps = {
  title: "Your First Chiropractic Visit",
  hookText:
    "Nervous about your first adjustment? Here's exactly what happens.",
  steps: [
    {
      stepNumber: 1,
      label: "Assessment",
      description:
        "We talk about what's going on, look at your posture, and check your range of motion. No surprises.",
    },
    {
      stepNumber: 2,
      label: "The Adjustment",
      description:
        "Gentle, specific pressure to the areas that need it. You might hear a pop. That's completely normal.",
    },
    {
      stepNumber: 3,
      label: "After",
      description:
        "Some people feel relief right away. Others feel a little sore, like after a workout. Both are normal.",
    },
  ],
  reassuranceText:
    "That's it. It's gentle, it's safe, and it's designed to help your body work better.",
  ctaText: "If you've been thinking about it, this is your sign.",
  theme: defaultTheme,
};

// Shot composition defaults
const shotTitleCardDefaults: ShotTitleCardProps = {
  title: "Why Back Pain Gets Worse in the Third Trimester",
  subtitle: "And what helps",
  durationInSeconds: 3,
  theme: defaultTheme,
};

const shotStatCardDefaults: ShotStatCardProps = {
  value: "60 lbs",
  label: "of extra pressure on your spine",
  durationInSeconds: 4,
  theme: defaultTheme,
};

const shotSectionCardDefaults: ShotSectionCardProps = {
  label: "THE ANATOMY",
  text: "Your center of gravity shifts forward 2-3 inches during pregnancy",
  durationInSeconds: 4,
  theme: defaultTheme,
};

const shotHookTextDefaults: ShotHookTextProps = {
  text: "That neck pain you feel after scrolling? It has a name.",
  durationInSeconds: 3,
  theme: defaultTheme,
};

const shotChecklistDefaults: ShotChecklistProps = {
  items: [
    { number: 1, label: "Head tilted one way", description: "May indicate torticollis" },
    { number: 2, label: "Trouble latching", description: "Neck tension affects feeding" },
    { number: 3, label: "Arching back", description: "May signal spinal discomfort" },
  ],
  durationInSeconds: 6,
  theme: defaultTheme,
};

const shotMythTruthDefaults: ShotMythTruthProps = {
  text: "Cracking your knuckles causes arthritis.",
  type: "myth",
  durationInSeconds: 4,
  theme: defaultTheme,
};

const shotStepIndicatorDefaults: ShotStepIndicatorProps = {
  stepNumber: 1,
  totalSteps: 3,
  label: "Assessment",
  description: "We check your posture and range of motion.",
  durationInSeconds: 5,
  theme: defaultTheme,
};

const shotFrequencyCardDefaults: ShotFrequencyCardProps = {
  frequency: "3 sets of 10, twice daily",
  keyCue: "Keep your eyes level throughout the movement.",
  durationInSeconds: 4,
  theme: defaultTheme,
};

const shotCTADefaults: ShotCTAProps = {
  text: "Save this and share it with someone who needs it.",
  durationInSeconds: 3,
  theme: defaultTheme,
};

const shotChartCardDefaults: ShotChartCardProps = {
  title: "Patient Improvement Over 6 Weeks",
  bars: [
    { label: "Week 1", value: 20 },
    { label: "Week 2", value: 35 },
    { label: "Week 3", value: 55 },
    { label: "Week 4", value: 70 },
    { label: "Week 5", value: 82 },
    { label: "Week 6", value: 94 },
  ],
  durationInSeconds: 5,
  theme: defaultTheme,
};

const shotQuoteCardDefaults: ShotQuoteCardProps = {
  quote: "I wish I had come in sooner. After three visits, I could finally sleep through the night.",
  attribution: "Sarah M.",
  role: "Patient, 8 months postpartum",
  durationInSeconds: 5,
  theme: defaultTheme,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Content-Formats">
        <Composition
          id="Explainer"
          component={Explainer}
          schema={ExplainerSchema}
          defaultProps={explainerDefaults}
          durationInFrames={30 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Checklist"
          component={Checklist}
          schema={ChecklistSchema}
          defaultProps={checklistDefaults}
          durationInFrames={35 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Demo"
          component={Demo}
          schema={DemoSchema}
          defaultProps={demoDefaults}
          durationInFrames={40 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="MythBuster"
          component={MythBuster}
          schema={MythBusterSchema}
          defaultProps={mythBusterDefaults}
          durationInFrames={15 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Walkthrough"
          component={Walkthrough}
          schema={WalkthroughSchema}
          defaultProps={walkthroughDefaults}
          durationInFrames={45 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>

      <Folder name="Shots">
        <Composition
          id="Shot-TitleCard"
          component={ShotTitleCard}
          schema={ShotTitleCardSchema}
          defaultProps={shotTitleCardDefaults}
          calculateMetadata={calcShotMetadata<ShotTitleCardProps>()}
          durationInFrames={3 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-StatCard"
          component={ShotStatCard}
          schema={ShotStatCardSchema}
          defaultProps={shotStatCardDefaults}
          calculateMetadata={calcShotMetadata<ShotStatCardProps>()}
          durationInFrames={4 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-SectionCard"
          component={ShotSectionCard}
          schema={ShotSectionCardSchema}
          defaultProps={shotSectionCardDefaults}
          calculateMetadata={calcShotMetadata<ShotSectionCardProps>()}
          durationInFrames={4 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-HookText"
          component={ShotHookText}
          schema={ShotHookTextSchema}
          defaultProps={shotHookTextDefaults}
          calculateMetadata={calcShotMetadata<ShotHookTextProps>()}
          durationInFrames={3 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-Checklist"
          component={ShotChecklist}
          schema={ShotChecklistSchema}
          defaultProps={shotChecklistDefaults}
          calculateMetadata={calcShotMetadata<ShotChecklistProps>()}
          durationInFrames={6 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-MythTruth"
          component={ShotMythTruth}
          schema={ShotMythTruthSchema}
          defaultProps={shotMythTruthDefaults}
          calculateMetadata={calcShotMetadata<ShotMythTruthProps>()}
          durationInFrames={4 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-StepIndicator"
          component={ShotStepIndicator}
          schema={ShotStepIndicatorSchema}
          defaultProps={shotStepIndicatorDefaults}
          calculateMetadata={calcShotMetadata<ShotStepIndicatorProps>()}
          durationInFrames={5 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-FrequencyCard"
          component={ShotFrequencyCard}
          schema={ShotFrequencyCardSchema}
          defaultProps={shotFrequencyCardDefaults}
          calculateMetadata={calcShotMetadata<ShotFrequencyCardProps>()}
          durationInFrames={4 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-CTA"
          component={ShotCallToAction}
          schema={ShotCTASchema}
          defaultProps={shotCTADefaults}
          calculateMetadata={calcShotMetadata<ShotCTAProps>()}
          durationInFrames={3 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-ChartCard"
          component={ShotChartCard}
          schema={ShotChartCardSchema}
          defaultProps={shotChartCardDefaults}
          calculateMetadata={calcShotMetadata<ShotChartCardProps>()}
          durationInFrames={5 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Shot-QuoteCard"
          component={ShotQuoteCard}
          schema={ShotQuoteCardSchema}
          defaultProps={shotQuoteCardDefaults}
          calculateMetadata={calcShotMetadata<ShotQuoteCardProps>()}
          durationInFrames={5 * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>
    </>
  );
};
