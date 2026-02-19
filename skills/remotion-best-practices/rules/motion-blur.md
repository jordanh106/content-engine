---
name: motion-blur
description: Motion blur and trail effects using @remotion/motion-blur
metadata:
  tags: motion-blur, trail, camera, blur, effects
---

# Motion Blur

`@remotion/motion-blur` provides higher-order components that create motion blur and trail effects. Available from v3.2.39.

## Prerequisites

```bash
npx remotion add @remotion/motion-blur
```

## Components

### Trail

Duplicates children with time offsets to create a trailing effect behind fast-moving elements.

```tsx
import { Trail } from "@remotion/motion-blur";
import { AbsoluteFill } from "remotion";

export const MyComposition: React.FC = () => {
  return (
    <Trail layers={50} lagInFrames={0.1} trailOpacity={1}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <MovingElement />
      </AbsoluteFill>
    </Trail>
  );
};
```

| Prop | Type | Description |
|------|------|-------------|
| `layers` | number | Number of duplicate layers rendered behind the content |
| `lagInFrames` | number | Frame delay between each layer. Supports decimals (e.g., 0.1) |
| `trailOpacity` | number | Maximum opacity for trail layers (0-1). Layers interpolate from 0 to this value |

### CameraMotionBlur

Simulates film camera motion blur by rendering multiple frames at different time offsets and averaging them.

```tsx
import { CameraMotionBlur } from "@remotion/motion-blur";
import { AbsoluteFill } from "remotion";

export const MyComposition: React.FC = () => {
  return (
    <CameraMotionBlur shutterAngle={180} samples={10}>
      <AbsoluteFill>
        <FastMovingContent />
      </AbsoluteFill>
    </CameraMotionBlur>
  );
};
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shutterAngle` | number | 180 | Controls blur intensity. Lower = less blur, higher = more blur. Common film range: 90-180 degrees |
| `samples` | number | 10 | Number of frames averaged together. Higher = smoother blur but reduced image quality. Recommended: 5-10 |

## Important Notes

- **Children must be absolutely positioned.** Always wrap content in `<AbsoluteFill>` to prevent layout issues.
- **CameraMotionBlur is destructive to colors.** Inspect output quality carefully, especially with text and sharp edges.
- **Keep `samples` as low as possible** while maintaining acceptable visual quality. Higher values significantly impact render time.
- Trail is better for stylized trailing effects. CameraMotionBlur is better for realistic film-like blur.
