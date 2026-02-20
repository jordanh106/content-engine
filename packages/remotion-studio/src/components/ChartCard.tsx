import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";
import { resolveTheme } from "../schemas/theme";
import { GradientBackground } from "./effects/GradientBackground";
import { GrainOverlay } from "./effects/GrainOverlay";
import { AccentLine } from "./effects/AccentLine";

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
  const t = resolveTheme(theme);

  const maxValue = maxValueProp ?? Math.max(...bars.map((b) => b.value), 1);

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const chartWidth = bars.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

  return (
    <AbsoluteFill>
      <GradientBackground
        variant="mesh"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "85%",
          }}
        >
          {title && (
            <div
              style={{
                fontFamily: theme.headingFont,
                fontSize: 48,
                fontWeight: "bold",
                color: theme.textColor,
                marginBottom: 32,
                opacity: titleProgress,
                transform: `translateY(${interpolate(titleProgress, [0, 1], [-20, 0])}px)`,
                textShadow: `0 2px 20px rgba(0,0,0,0.3), 0 0 40px ${t.glowColor}10`,
                textAlign: "center",
              }}
            >
              {title}
            </div>
          )}

          {title && (
            <div style={{ marginBottom: 48 }}>
              <AccentLine
                color={theme.primaryColor}
                width={120}
                height={3}
                delay={6}
                glow
              />
            </div>
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

                  {/* Bar with gradient and glow */}
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        width: BAR_WIDTH + 16,
                        height: barHeight,
                        left: -8,
                        bottom: 0,
                        background: barColor,
                        filter: "blur(16px)",
                        opacity: 0.2,
                        borderRadius: 8,
                      }}
                    />
                    <div
                      style={{
                        width: BAR_WIDTH,
                        height: barHeight,
                        borderRadius: 8,
                        background: `linear-gradient(to top, ${barColor}dd, ${barColor})`,
                        border: `1px solid ${barColor}40`,
                      }}
                    />
                  </div>

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

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
