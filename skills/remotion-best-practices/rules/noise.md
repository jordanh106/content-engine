---
name: noise
description: Procedural noise generation for visual effects using @remotion/noise
metadata:
  tags: noise, perlin, simplex, procedural, effects, background
---

# Procedural Noise

`@remotion/noise` provides simplex noise functions for creating organic, procedural visual effects like animated backgrounds, textures, and natural motion.

## Prerequisites

```bash
npx remotion add @remotion/noise
```

## Functions

All functions return a value between `-1` and `1`. Pass the same `seed` to get deterministic results for the same coordinates.

### noise2D(seed, x, y)

Two-dimensional noise. Use for flat textures and backgrounds.

```tsx
import { noise2D } from "@remotion/noise";

const value = noise2D("my-seed", x, y); // Returns -1 to 1
```

### noise3D(seed, x, y, z)

Three-dimensional noise. Use the third dimension for time (frame-based animation).

```tsx
import { noise3D } from "@remotion/noise";
import { useCurrentFrame, useVideoConfig } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Animate noise over time using frame as the z-axis
const value = noise3D("my-seed", x * 0.01, y * 0.01, frame / fps);
```

### noise4D(seed, x, y, z, w)

Four-dimensional noise. Use for complex animated textures where you need both spatial and temporal variation.

```tsx
import { noise4D } from "@remotion/noise";

const value = noise4D("my-seed", x, y, z, frame / fps);
```

## Animation Pattern

Use `useCurrentFrame()` as one of the noise dimensions to animate over time:

```tsx
import { noise2D } from "@remotion/noise";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";

const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const gridSize = 20;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);

  const cells = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const value = noise2D("bg", x * 0.1 + frame * 0.02, y * 0.1);
      const opacity = (value + 1) / 2; // Map -1..1 to 0..1
      cells.push(
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: x * gridSize,
            top: y * gridSize,
            width: gridSize,
            height: gridSize,
            backgroundColor: `rgba(13, 148, 136, ${opacity * 0.3})`,
          }}
        />,
      );
    }
  }

  return <AbsoluteFill>{cells}</AbsoluteFill>;
};
```

## Tips

- Scale input coordinates (multiply by 0.01-0.1) to control noise frequency. Smaller multipliers produce smoother, larger patterns.
- Use different seeds for independent noise fields.
- Map the -1 to 1 output to your desired range with `interpolate()` or manual math.
