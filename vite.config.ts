/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/BratnavaFCFront/",
    server: { port: Number(process.env.PORT) || 5173 },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ['./src/__tests__/setup.ts'],
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
    },
});