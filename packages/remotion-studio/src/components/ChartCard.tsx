import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type Bar = {
  label: string;
  value: number;
  color?: string;
};

type ChartCardProps = {
  title?: string;
  bars: Bar[];
  maxValue?: number;
  theme: Theme;
};

const STAGGER_DELAY = 5;
const BAR_MAX_HEIGHT = 700;
const BAR_WIDTH = 80;
const BAR_GAP = 24;

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  bars,
  maxValue: maxValueProp,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxValue = maxValueProp ?? Math.max(...bars.map((b) => b.value), 1);

  // Title animation
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  // Find the tallest bar for glow positioning
  const tallestIndex = bars.reduce(
    (maxI, bar, i, arr) => (bar.value > arr[maxI].value ? i : maxI),
    0,
  );

  const glowProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: tallestIndex * STAGGER_DELAY + 10,
  });

  const chartWidth = bars.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Glow behind tallest bar */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: theme.primaryColor,
          opacity: interpolate(glowProgress, [0, 1], [0, 0.15]),
          filter: "blur(80px)",
          top: "40%",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "85%",
        }}
      >
        {/* Title */}
        {title && (
          <div
            style={{
              fontFamily: theme.headingFont,
              fontSize: 48,
              fontWeight: "bold",
              color: theme.textColor,
              marginBottom: 60,
              opacity: titleProgress,
              transform: `translateY(${interpolate(titleProgress, [0, 1], [-20, 0])}px)`,
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            {title}
          </div>
        )}

        {/* Accent line */}
        {title && (
          <div
            style={{
              width: interpolate(titleProgress, [0, 1], [0, 120]),
              height: 3,
              backgroundColor: theme.primaryColor,
              marginBottom: 60,
              borderRadius: 2,
              opacity: titleProgress * 0.6,
            }}
          />
        )}

        {/* Chart area */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            height: BAR_MAX_HEIGHT + 80,
            gap: BAR_GAP,
            width: chartWidth,
          }}
        >
          {bars.map((bar, i) => {
            const delay = i * STAGGER_DELAY + 8;
            const barProgress = spring({
              frame,
              fps,
              delay,
              config: { damping: 200 },
            });

            const normalizedHeight = (bar.value / maxValue) * BAR_MAX_HEIGHT;
            const barHeight = interpolate(barProgress, [0, 1], [0, normalizedHeight]);
            const barColor = bar.color || theme.primaryColor;
            const labelOpacity = interpolate(barProgress, [0.3, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: BAR_WIDTH,
                }}
              >
                {/* Value label above bar */}
                <div
                  style={{
                    fontFamily: theme.bodyFont,
                    fontSize: 24,
                    fontWeight: "bold",
                    color: theme.textColor,
                    opacity: labelOpacity,
                    marginBottom: 8,
                    textShadow: `0 0 20px ${barColor}40`,
                  }}
                >
                  {bar.value}
                </div>

                {/* Bar */}
                <div
                  style={{
                    width: BAR_WIDTH,
                    height: barHeight,
                    borderRadius: 8,
                    background: `linear-gradient(to top, ${barColor}, ${barColor}cc)`,
                    boxShadow: `0 0 20px ${barColor}30`,
                  }}
                />

                {/* Label below bar */}
                <div
                  style={{
                    fontFamily: theme.bodyFont,
                    fontSize: 18,
                    color: theme.textColor,
                    opacity: labelOpacity * 0.7,
                    marginTop: 12,
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    maxWidth: BAR_WIDTH + 20,
                    lineHeight: 1.2,
                  }}
                >
                  {bar.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
