import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import svgr from "vite-plugin-svgr";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze";

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      svgr(),
      react(),
      mode === "development" && componentTagger(),
      analyze && visualizer({ filename: "dist/stats.html", open: false, gzipSize: true, brotliSize: true }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
