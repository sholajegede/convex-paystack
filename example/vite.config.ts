import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production builds are served from sholajegede.com/demos/convex-paystack, so assets
// resolve under that path. Local dev keeps the root path.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/demos/convex-paystack/" : "/",
  envDir: "../",
  plugins: [react()],
  resolve: {
    conditions: ["@convex-dev/component-source"],
  },
}));
