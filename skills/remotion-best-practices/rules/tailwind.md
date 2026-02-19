---
name: tailwind
description: Using TailwindCSS in Remotion.
metadata:
---

You can and should use TailwindCSS in Remotion, if TailwindCSS is installed in the project.

Don't use `transition-*` or `animate-*` classes - always animate using the `useCurrentFrame()` hook.  

## Setup

For Tailwind CSS v4 with Vite, use the `@tailwindcss/vite` plugin:

```bash
npm install tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

```css
/* src/style.css */
@import "tailwindcss";
```

Import the CSS file in your Root component or entry point.

For Tailwind CSS v3 with Webpack (older Remotion setups), install `@remotion/tailwind`:

```bash
npx remotion add @remotion/tailwind
```

Then add it to your Remotion config:

```ts
// remotion.config.ts
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind";

Config.overrideWebpackConfig((config) => enableTailwind(config));
```