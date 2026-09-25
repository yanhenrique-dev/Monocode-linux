import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async ({ mode }) => {
  const stable = mode === "stable";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(dirname, "src"),
      },
    },
    clearScreen: false,
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          manualChunks: {
            mermaid: ["mermaid"],
            xterm: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-webgl"],
            streamdown: ["streamdown", "@streamdown/code"],
            codemirror: ["codemirror", "@codemirror/state", "@codemirror/view"],
          },
        },
      },
    },
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: stable
        ? false
        : host
          ? {
              protocol: "ws",
              host,
              port: 1421,
            }
          : undefined,
      watch: {
        ignored: stable ? ["**/*"] : ["**/src-tauri/**"],
      },
    },
  };
});
