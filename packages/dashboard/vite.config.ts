import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3001,
    host: "0.0.0.0",
    fs: {
      allow: [
        // Allow serving files from the dashboard package
        ".",
        // Allow serving Remotion component files from the sibling package
        path.resolve(__dirname, "../remotion-studio/src"),
        // Allow node_modules
        path.resolve(__dirname, "../../node_modules"),
      ],
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@remotion-studio": path.resolve(__dirname, "../remotion-studio/src"),
    },
  },
});
