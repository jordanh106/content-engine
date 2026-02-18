import { Composition, Folder } from "remotion";
import { Explainer } from "./compositions/Explainer";
import { Checklist } from "./compositions/Checklist";
import { Demo } from "./compositions/Demo";
import { MythBuster } from "./compositions/MythBuster";
import { Walkthrough } from "./compositions/Walkthrough";
import { ExplainerSchema } from "./schemas/explainer";
import { ChecklistSchema } from "./schemas/checklist";
import { DemoSchema } from "./schemas/demo";
import { MythBusterSchema } from "./schemas/myth-buster";
import { WalkthroughSchema } from "./schemas/walkthrough";
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

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
