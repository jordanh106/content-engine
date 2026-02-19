import React, { Suspense } from "react";
import { AbsoluteFill } from "remotion";
import { COMPONENT_REGISTRY } from "./component-registry.js";

type ComposerCompositionProps = {
  componentType: string;
  componentProps: Record<string, unknown>;
};

export const ComposerComposition: React.FC<ComposerCompositionProps> = ({
  componentType,
  componentProps,
}) => {
  const entry = COMPONENT_REGISTRY[componentType];

  if (!entry) {
    return (
      <AbsoluteFill
        style={{
          background: "#1a1a2e",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
          fontFamily: "sans-serif",
          fontSize: 32,
        }}
      >
        Unknown: {componentType}
      </AbsoluteFill>
    );
  }

  const Component = entry.component;

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
          Loading...
        </AbsoluteFill>
      }
    >
      <Component {...componentProps} />
    </Suspense>
  );
};
