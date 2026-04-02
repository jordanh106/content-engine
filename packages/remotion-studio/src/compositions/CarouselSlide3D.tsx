import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveTheme } from "../schemas/theme";
import type { CarouselSlide3DProps } from "../schemas/carousel-3d";
import { ThreeDSlideScene } from "../components/ThreeDSlideScene";
import { GrainOverlay } from "../components/effects/GrainOverlay";

export const CarouselSlide3D: React.FC<CarouselSlide3DProps> = ({
  heading,
  bodyText,
  slideType,
  slideIndex,
  totalSlides,
  accentObject = "torus",
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

  // --- Animations ---
  const headingIn = spring({ frame, fps, config: { damping: 200, stiffness: 100 }, delay: 6 });
  const headingScale = interpolate(headingIn, [0, 1], [1.15, 1]);
  const bodyIn = spring({ frame, fps, config: { damping: 200, stiffness: 80 }, delay: 14 });
  const badgeIn = spring({ frame, fps, config: { damping: 200, stiffness: 120 }, delay: 2 });
  const counterIn = spring({ frame, fps, config: { damping: 200, stiffness: 120 }, delay: 4 });
  const accentLineIn = spring({ frame, fps, config: { damping: 200, stiffness: 60 }, delay: 8 });

  // Subtle glow pulse
  const glowPulse = Math.sin(frame * 0.06) * 0.3 + 0.7;

  const isCover = slideType === "cover";
  const isCta = slideType === "cta";

  return (
    <AbsoluteFill>
      {/* Dark base background */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${t.darkBackground} 0%, #0a0a14 100%)`,
        }}
      />

      {/* 3D scene layer */}
      <ThreeDSlideScene
        theme={t}
        accentObject={accentObject}
        slideType={slideType}
      />

      {/* Overlay gradient for text readability */}
      <AbsoluteFill
        style={{
          background: isCover
            ? `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.7) 100%)`
            : `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.7) 100%)`,
        }}
      />

      {/* Slide type badge */}
      {isCover && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: 60,
            opacity: badgeIn,
            transform: `translateY(${interpolate(badgeIn, [0, 1], [-20, 0])}px)`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontFamily: t.bodyFont,
              fontWeight: 900,
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
              color: theme.primaryColor,
              background: `rgba(13, 148, 136, 0.15)`,
              border: `1px solid rgba(13, 148, 136, 0.3)`,
              borderRadius: 6,
              padding: "6px 16px",
            }}
          >
            SWIPE &rarr;
          </div>
        </div>
      )}

      {isCta && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: 60,
            opacity: badgeIn,
            transform: `translateY(${interpolate(badgeIn, [0, 1], [-20, 0])}px)`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontFamily: t.bodyFont,
              fontWeight: 900,
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
              color: "#f59e0b",
              background: `rgba(245, 158, 11, 0.12)`,
              border: `1px solid rgba(245, 158, 11, 0.3)`,
              borderRadius: 6,
              padding: "6px 16px",
            }}
          >
            TAKE ACTION
          </div>
        </div>
      )}

      {/* Slide counter */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 60,
          opacity: counterIn,
          fontSize: 14,
          fontFamily: t.bodyFont,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {slideIndex + 1} / {totalSlides}
      </div>

      {/* Content area */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0 60px 140px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Content slide number watermark */}
        {slideType === "content" && (
          <div
            style={{
              position: "absolute",
              top: -120,
              right: 60,
              fontSize: 200,
              fontFamily: t.headingFont,
              fontWeight: 700,
              color: `rgba(13, 148, 136, ${0.06 * headingIn})`,
              lineHeight: 1,
              pointerEvents: "none",
            }}
          >
            {slideIndex}
          </div>
        )}

        {/* Accent line */}
        <div
          style={{
            width: interpolate(accentLineIn, [0, 1], [0, isCover ? 80 : 50]),
            height: isCover ? 4 : 3,
            background: `linear-gradient(90deg, ${theme.primaryColor}, ${t.primaryGradientEnd})`,
            borderRadius: 2,
            boxShadow: `0 0 ${12 * glowPulse}px ${theme.primaryColor}60`,
          }}
        />

        {/* Heading */}
        <div
          style={{
            fontSize: isCover ? 56 : isCta ? 48 : 44,
            fontFamily: t.headingFont,
            fontWeight: 700,
            color: t.textColor,
            lineHeight: 1.15,
            opacity: headingIn,
            transform: `scale(${headingScale})`,
            transformOrigin: "left bottom",
            textShadow: `0 2px 20px rgba(0,0,0,0.5)`,
            maxWidth: 900,
          }}
        >
          {heading}
        </div>

        {/* Body text in glass panel */}
        {bodyText && (
          <div
            style={{
              opacity: bodyIn,
              transform: `translateY(${interpolate(bodyIn, [0, 1], [20, 0])}px)`,
            }}
          >
            <div
              style={{
                background: t.surfaceColor,
                backdropFilter: `blur(${t.glassBlur}px)`,
                WebkitBackdropFilter: `blur(${t.glassBlur}px)`,
                border: `1px solid ${t.borderColor}`,
                borderRadius: 16,
                padding: "24px 28px",
                maxWidth: 800,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontFamily: t.bodyFont,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.5,
                }}
              >
                {bodyText}
              </div>
            </div>
          </div>
        )}

        {/* CTA button */}
        {isCta && (
          <div
            style={{
              opacity: bodyIn,
              transform: `translateY(${interpolate(bodyIn, [0, 1], [15, 0])}px)`,
              marginTop: 8,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                background: theme.primaryColor,
                color: "#ffffff",
                fontSize: 16,
                fontFamily: t.bodyFont,
                fontWeight: 800,
                letterSpacing: "0.15em",
                textTransform: "uppercase" as const,
                padding: "18px 40px",
                borderRadius: 50,
                boxShadow: `0 0 ${20 * glowPulse}px ${theme.primaryColor}50`,
              }}
            >
              BOOK NOW &rarr;
            </div>
          </div>
        )}
      </div>

      {/* Brand mark */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 60,
          opacity: counterIn * 0.6,
          fontSize: 11,
          fontFamily: t.bodyFont,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase" as const,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        COLLECTIVE FAMILY CHIROPRACTIC
      </div>

      {/* Film grain */}
      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
