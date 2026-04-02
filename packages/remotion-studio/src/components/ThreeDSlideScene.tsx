import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import type { ResolvedTheme } from "../schemas/theme";

type AccentObjectType = "torus" | "sphere" | "octahedron" | "icosahedron" | "none";

type ThreeDSlideSceneProps = {
  theme: ResolvedTheme;
  accentObject?: AccentObjectType;
  slideType: "cover" | "content" | "cta";
};

function AccentMesh({
  type,
  primaryColor,
  frame,
}: {
  type: AccentObjectType;
  primaryColor: string;
  frame: number;
}) {
  const color = useMemo(() => new THREE.Color(primaryColor), [primaryColor]);
  const rotationY = frame * 0.008;
  const rotationX = frame * 0.004;
  const floatY = Math.sin(frame * 0.03) * 0.15;

  const materialProps = useMemo(
    () => ({
      color,
      transparent: true,
      opacity: 0.55,
      wireframe: false,
      roughness: 0.15,
      metalness: 0.9,
    }),
    [color],
  );

  const position: [number, number, number] = [2.2, floatY - 0.5, -2];

  switch (type) {
    case "torus":
      return (
        <mesh position={position} rotation={[rotationX, rotationY, 0]}>
          <torusGeometry args={[1.2, 0.4, 32, 64]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      );
    case "sphere":
      return (
        <mesh position={position} rotation={[0, rotationY, 0]}>
          <sphereGeometry args={[1.2, 64, 64]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      );
    case "octahedron":
      return (
        <mesh position={position} rotation={[rotationX, rotationY, 0]}>
          <octahedronGeometry args={[1.3]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      );
    case "icosahedron":
      return (
        <mesh position={position} rotation={[rotationX, rotationY, 0]}>
          <icosahedronGeometry args={[1.2]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      );
    default:
      return null;
  }
}

function WireframeAccent({
  primaryColor,
  frame,
}: {
  primaryColor: string;
  frame: number;
}) {
  const color = useMemo(() => new THREE.Color(primaryColor), [primaryColor]);
  const rotationY = frame * 0.005;
  const rotationZ = frame * 0.003;

  return (
    <mesh position={[-2.5, 1.5, -3]} rotation={[0.3, rotationY, rotationZ]}>
      <icosahedronGeometry args={[0.8]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.15}
        wireframe
      />
    </mesh>
  );
}

export const ThreeDSlideScene: React.FC<ThreeDSlideSceneProps> = ({
  theme,
  accentObject = "torus",
  slideType,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const primaryColor = useMemo(
    () => new THREE.Color(theme.primaryColor),
    [theme.primaryColor],
  );

  const accentColor = useMemo(
    () => new THREE.Color(theme.primaryGradientEnd),
    [theme.primaryGradientEnd],
  );

  // Subtle camera orbit
  const cameraX = Math.sin(frame * 0.006) * 0.3;
  const cameraY = Math.cos(frame * 0.004) * 0.15;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ position: [cameraX, cameraY, 5], fov: 50 }}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {/* Ambient base light */}
      <ambientLight intensity={0.25} />

      {/* Key light - dramatic from upper right */}
      <directionalLight
        position={[4, 5, 3]}
        intensity={1.0}
        color={primaryColor}
      />

      {/* Fill light - softer from left */}
      <directionalLight
        position={[-3, 2, 2]}
        intensity={0.5}
        color={accentColor}
      />

      {/* Rim light from behind */}
      <pointLight
        position={[0, -2, -4]}
        intensity={0.6}
        color={primaryColor}
        distance={12}
      />

      {/* Main accent object */}
      {accentObject !== "none" && (
        <AccentMesh
          type={accentObject}
          primaryColor={theme.primaryColor}
          frame={frame}
        />
      )}

      {/* Secondary wireframe accent (cover and cta only) */}
      {(slideType === "cover" || slideType === "cta") && (
        <WireframeAccent
          primaryColor={theme.primaryColor}
          frame={frame}
        />
      )}

      {/* Ambient floating particles (small spheres) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + frame * 0.002;
        const radius = 3.5 + Math.sin(i * 1.7) * 0.8;
        const y = Math.sin(frame * 0.02 + i * 0.8) * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              y,
              Math.sin(angle) * radius - 3,
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial
              color={primaryColor}
              emissive={primaryColor}
              emissiveIntensity={1.0}
              transparent
              opacity={0.7}
            />
          </mesh>
        );
      })}
    </ThreeCanvas>
  );
};
