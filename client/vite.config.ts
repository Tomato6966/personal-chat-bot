import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

const backendUrl = 'http://localhost:80';
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "build",
    },
    server: {
        proxy: {
            '/api': backendUrl
        }
    }
});
