import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".tsx", ".jsx", ".json"],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("tesseract.js")) {
              return "vendor-tesseract";
            }
            if (id.includes("@dnd-kit")) {
              return "vendor-dnd";
            }
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }
            if (id.includes("lucide-react") || id.includes("sonner")) {
              return "vendor-ui";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
