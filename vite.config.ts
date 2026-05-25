/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/BratnavaFCFront/",
    test: {
        environment: "jsdom",
        globals: true,
    },
});