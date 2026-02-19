---
name: rive
description: Embedding Rive animations in Remotion using @remotion/rive
metadata:
  tags: rive, animation, vector, canvas, interactive
---

# Rive Animations

`@remotion/rive` renders Rive animations synchronized with Remotion's timeline. Rive is a vector animation platform (alternative to Lottie) with runtime interactivity.

Available from Remotion v3.3.75.

## Prerequisites

```bash
npx remotion add @remotion/rive
```

## Basic Usage

```tsx
import { RemotionRiveCanvas } from "@remotion/rive";
import { staticFile } from "remotion";

export const MyComposition: React.FC = () => {
  return <RemotionRiveCanvas src={staticFile("animation.riv")} />;
};
```

Remote URLs are also supported:

```tsx
<RemotionRiveCanvas src="https://example.com/animation.riv" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | string | Required | Path to .riv file (use `staticFile()` or remote URL) |
| `fit` | string | `"contain"` | `"contain"` \| `"cover"` \| `"fill"` \| `"fit-height"` \| `"fit-width"` \| `"none"` \| `"scale-down"` |
| `alignment` | string | `"center"` | Position: `"center"`, `"top-left"`, `"bottom-right"`, etc. |
| `artboard` | string \| number | default | Which artboard to display (by name or index) |
| `animation` | string \| number | default | Which animation to play (by name or index) |
| `onLoad` | function | - | Callback when Rive loads. Receives File object. (v4.0.58+) |
| `enableRiveAssetCdn` | boolean | `true` | Enable Rive Asset CDN. (v4.0.181+) |

## Advanced: Modifying Text at Runtime

Use the `onLoad` callback to modify text runs in the Rive file:

```tsx
import { useCallback } from "react";
import { RemotionRiveCanvas } from "@remotion/rive";

const MyComp: React.FC<{ city: string }> = ({ city }) => {
  const onLoad = useCallback(
    (file: any) => {
      const artboard = file.defaultArtboard();
      const textRun = artboard.textRun("city");
      textRun.text = city;
    },
    [city],
  );

  return <RemotionRiveCanvas src="animation.riv" onLoad={onLoad} />;
};
```

Memoize `onLoad` with `useCallback` to prevent unnecessary re-renders.

## Tips

- Rive animations are automatically synchronized with Remotion's timeline (no manual frame syncing needed).
- Use `artboard` and `animation` props to select specific animations from multi-artboard .riv files.
- Rive files are smaller than Lottie JSON files for equivalent animations.
