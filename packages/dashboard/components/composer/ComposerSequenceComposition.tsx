import React, { Suspense } from "react";
import { AbsoluteFill, Series } from "remotion";
import { COMPONENT_REGISTRY } from "./component-registry.js";
import type { VibeMotionComponent } from "../../shared/types.js";

type ComposerSequenceCompositionProps = {
  components: VibeMotionComponent[];
};

const FPS = 30;

export const ComposerSequenceComposition: React.FC<
  ComposerSequenceCompositionProps
> = ({ components }) => {
  if (components.length === 0) {
    return (
      <AbsoluteFill
        style={{
          background: "#1a1a2e",
          justifyContent: "center",
          alignItems: "center",
          color: "#666",
          fontFamily: "sans-serif",
          fontSize: 28,
        }}
      >
        No components to preview
      </AbsoluteFill>
    );
  }

  return (
    <Suspense
      fallback={
        <AbsoluteFill
          style={{
            background: "#1a1a2e",
            justifyContent: "center",
            alignItems: "center",
            color: "#666",
            fontFamily: "sans-serif",
          }}
        >
          Loading sequence...
        </AbsoluteFill>
      }
    >
      <Series>
        {components.map((comp) => {
          const entry = COMPONENT_REGISTRY[comp.componentType];
          if (!entry) return null;
          const Component = entry.component;
          const frames = Math.round(comp.durationInSeconds * FPS);
          return (
            <Series.Sequence
              key={comp.id}
              durationInFrames={Math.max(1, frames)}
            >
              <Component {...comp.props} />
            </Series.Sequence>
          );
        })}
      </Series>
    </Suspense>
  );
};
