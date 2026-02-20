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
import { GlassPanel } from "./effects/GlassPanel";
import { LightSweep } from "./effects/LightSweep";

type CallToActionProps = {
  text: string;
  theme: Theme;
};

export const CallToAction: React.FC<CallToActionProps> = ({ text, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

  const scaleProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180 },
  });
  const glowProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 10,
  });

  const scale = interpolate(scaleProgress, [0, 1], [0.8, 1]);
  const glowOpacity = interpolate(glowProgress, [0, 1], [0, 0.25]);
  const pulsePhase = Math.sin(frame * 0.08) * 0.04;

  // Animated gradient border - rotating hue angle
  const borderAngle = (frame * 2) % 360;

  // Double ring pulse
  const ring1Scale = interpolate(frame % 90, [0, 90], [0.9, 1.4]);
  const ring1Opacity = interpolate(frame % 90, [0, 90], [0.12, 0]);
  const ring2Scale = interpolate((frame + 45) % 90, [0, 90], [0.9, 1.4]);
  const ring2Opacity = interpolate((frame + 45) % 90, [0, 90], [0.12, 0]);

  return (
    <AbsoluteFill>
      <GradientBackground
        variant="spotlight"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      <LightSweep delay={5} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
        }}
      >
        {/* Pulsing rings */}
        <div
          style={{
            position: "absolute",
            width: 350,
            height: 350,
            borderRadius: "50%",
            border: `1px solid ${t.glowColor}`,
            transform: `scale(${ring1Scale})`,
            opacity: ring1Opacity * glowProgress,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 350,
            height: 350,
            borderRadius: "50%",
            border: `1px solid ${t.glowColor}`,
            transform: `scale(${ring2Scale})`,
            opacity: ring2Opacity * glowProgress,
          }}
        />
        {/* Glow blob */}
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            backgroundColor: t.glowColor,
            opacity: glowOpacity + pulsePhase,
            filter: "blur(80px)",
          }}
        />

        {/* Animated gradient border wrapper */}
        <div
          style={{
            padding: 2,
            borderRadius: 28,
            background: `conic-gradient(from ${borderAngle}deg, ${theme.primaryColor}, ${t.primaryGradientEnd}, ${theme.primaryColor})`,
            transform: `scale(${scale})`,
            opacity: scaleProgress,
          }}
        >
          <GlassPanel
            surfaceColor="rgba(10, 10, 24, 0.85)"
            borderColor="transparent"
            blur={t.glassBlur}
            borderRadius={26}
            padding="40px 52px"
          >
            <div
              style={{
                fontFamily: theme.headingFont,
                fontSize: 52,
                fontWeight: "bold",
                color: theme.textColor,
                textAlign: "center",
                lineHeight: 1.4,
                maxWidth: 800,
                textShadow: `0 2px 30px rgba(0,0,0,0.4), 0 0 40px ${t.glowColor}15`,
              }}
            >
              {text}
            </div>
          </GlassPanel>
        </div>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
