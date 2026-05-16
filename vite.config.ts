import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [vue(), tailwindcss()],

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },

    // Prevent Vite from obscuring Rust errors
    clearScreen: false,
    server: {
        port: 5173,
        strictPort: true,
        host: host || "0.0.0.0",
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 5174,
            }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
});
