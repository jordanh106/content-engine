import React from "react";

type GlassPanelProps = {
  children: React.ReactNode;
  surfaceColor?: string;
  borderColor?: string;
  blur?: number;
  borderRadius?: number;
  padding?: number | string;
  style?: React.CSSProperties;
};

/**
 * Glassmorphism card surface with backdrop blur, subtle border, and inner shadow.
 * Wraps child content in a frosted-glass container.
 */
export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  surfaceColor = "rgba(255, 255, 255, 0.06)",
  borderColor = "rgba(255, 255, 255, 0.08)",
  blur = 20,
  borderRadius = 24,
  padding = 40,
  style,
}) => {
  return (
    <div
      style={{
        background: surfaceColor,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: `1px solid ${borderColor}`,
        borderRadius,
        padding,
        boxShadow:
          "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 32px rgba(0, 0, 0, 0.2)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
