---
name: paths
description: SVG path manipulation and animation using @remotion/paths
metadata:
  tags: paths, svg, morph, interpolate, stroke, drawing, evolve
---

# SVG Path Utilities

`@remotion/paths` provides functions for SVG path manipulation, morphing, and stroke drawing animations. No external dependencies. Can be used independently of Remotion.

## Prerequisites

```bash
npx remotion add @remotion/paths
```

## Key Functions

### interpolatePath(value, firstPath, secondPath)

Morph between two SVG paths. Returns an interpolated path string.

```tsx
import { interpolatePath } from "@remotion/paths";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const progress = spring({ frame, fps, config: { damping: 200 } });

const d = interpolatePath(
  progress,
  "M 0 0 L 100 0 L 100 100 L 0 100 Z",  // Square
  "M 50 0 L 100 100 L 0 100 Z",           // Triangle
);

return <svg><path d={d} fill="#0d9488" /></svg>;
```

- `value = 0` returns `firstPath`
- `value = 1` returns `secondPath`
- Values between produce a smooth morph

### evolvePath(progress, path)

Animate a stroke drawing effect. Returns `{ strokeDasharray, strokeDashoffset }` to apply to an SVG path.

```tsx
import { evolvePath } from "@remotion/paths";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const progress = spring({ frame, fps, config: { damping: 200 } });

const path = "M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80";
const evolution = evolvePath(progress, path);

return (
  <svg viewBox="0 0 200 200">
    <path
      d={path}
      fill="none"
      stroke="#0d9488"
      strokeWidth={4}
      strokeDasharray={evolution.strokeDasharray}
      strokeDashoffset={evolution.strokeDashoffset}
    />
  </svg>
);
```

- `progress = 0` hides the path entirely
- `progress = 1` shows the full path
- Values > 1 cause the start to "devolve" (erase from beginning)
- Values < 0 evolve from the end

### getLength(path)

Get the total length of an SVG path.

```tsx
import { getLength } from "@remotion/paths";

const length = getLength("M 0 0 L 100 0"); // Returns 100
```

### getPointAtLength(path, length)

Get the x/y coordinates at a specific length along a path.

```tsx
import { getPointAtLength } from "@remotion/paths";

const point = getPointAtLength("M 0 0 L 100 0", 50);
// Returns { x: 50, y: 0 }
```

Useful for animating elements that follow a path.

### getSubpaths(path)

Split a path into its individual subpaths.

```tsx
import { getSubpaths } from "@remotion/paths";

const parts = getSubpaths("M 0 0 L 100 0 M 200 200 L 300 300");
// Returns ["M 0 0 L 100 0", "M 200 200 L 300 300"]
```

## Animation Patterns

### Stroke Drawing

Use `evolvePath()` with `spring()` for a hand-drawn reveal:

```tsx
const progress = spring({ frame, fps, config: { damping: 200 } });
const { strokeDasharray, strokeDashoffset } = evolvePath(progress, svgPath);
```

### Path Morphing

Use `interpolatePath()` with `spring()` to morph between shapes:

```tsx
const progress = spring({ frame, fps, config: { damping: 12 } });
const d = interpolatePath(progress, circlePath, starPath);
```

### Follow a Path

Use `getPointAtLength()` to move an element along a path:

```tsx
const totalLength = getLength(curvePath);
const currentLength = interpolate(frame, [0, durationInFrames], [0, totalLength]);
const { x, y } = getPointAtLength(curvePath, currentLength);
```
