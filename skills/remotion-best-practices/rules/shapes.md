---
name: shapes
description: SVG shape components for Remotion using @remotion/shapes
metadata:
  tags: shapes, svg, circle, rect, triangle, star, polygon, ellipse, pie
---

# SVG Shapes

`@remotion/shapes` provides components that render SVG shapes. Useful for programmatic shape creation, animated backgrounds, and geometric motion graphics.

## Prerequisites

```bash
npx remotion add @remotion/shapes
```

## Components

### Circle

```tsx
import { Circle } from "@remotion/shapes";

<Circle radius={100} fill="green" stroke="red" strokeWidth={1} />
```

Props: `radius`, `fill`, `stroke`, `strokeWidth`

### Rect

```tsx
import { Rect } from "@remotion/shapes";

<Rect width={200} height={200} fill="red" />
```

Props: `width`, `height`, `fill`, `stroke`, `strokeWidth`, `cornerRadius`

### Triangle

Renders an equilateral triangle (all sides equal length).

```tsx
import { Triangle } from "@remotion/shapes";

<Triangle length={100} fill="red" direction="up" />
```

Props: `length`, `direction` (`"up"` | `"down"` | `"left"` | `"right"`), `fill`, `stroke`, `strokeWidth`

### Ellipse

```tsx
import { Ellipse } from "@remotion/shapes";

<Ellipse rx={100} ry={50} fill="blue" />
```

Props: `rx`, `ry`, `fill`, `stroke`, `strokeWidth`

### Star

```tsx
import { Star } from "@remotion/shapes";

<Star points={5} innerRadius={40} outerRadius={100} fill="gold" />
```

Props: `points`, `innerRadius`, `outerRadius`, `fill`, `stroke`, `strokeWidth`, `cornerRadius`

### Polygon

```tsx
import { Polygon } from "@remotion/shapes";

<Polygon points={6} radius={100} fill="purple" />
```

Props: `points`, `radius`, `fill`, `stroke`, `strokeWidth`, `cornerRadius`

### Pie

```tsx
import { Pie } from "@remotion/shapes";

<Pie radius={100} progress={0.75} fill="teal" />
```

Props: `radius`, `progress` (0-1), `fill`, `stroke`, `strokeWidth`, `closePath`, `counterClockwise`, `rotation`

## Animation Pattern

Animate shapes using `useCurrentFrame()` + `spring()` or `interpolate()`:

```tsx
import { Pie } from "@remotion/shapes";
import { useCurrentFrame, useVideoConfig, spring, AbsoluteFill } from "remotion";

const AnimatedPie: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Pie radius={100} progress={progress} fill="#0d9488" />
    </AbsoluteFill>
  );
};
```

## Tips

- All shape components render as SVG elements.
- Combine with `@remotion/paths` for path-based animations on the generated shapes.
- Use `evolvePath()` from `@remotion/paths` with shapes for stroke drawing effects.
