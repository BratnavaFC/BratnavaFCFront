export type TeamColorInfo = {
    name?: string | null;
    hex?: string | null;
};

export function normalizeHex(value?: string | null): string | null {
    if (!value) return null;
    const raw = value.trim();
    if (!raw) return null;
    const hex = raw.startsWith("#") ? raw.slice(1) : raw;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        return `#${hex.split("").map((c) => `${c}${c}`).join("")}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
    return null;
}

export function readableTextColor(hex?: string | null): "#0f172a" | "#ffffff" {
    const normalized = normalizeHex(hex);
    if (!normalized) return "#ffffff";

    const r = parseInt(normalized.slice(1, 3), 16) / 255;
    const g = parseInt(normalized.slice(3, 5), 16) / 255;
    const b = parseInt(normalized.slice(5, 7), 16) / 255;

    const linear = [r, g, b].map((channel) =>
        channel <= 0.03928
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4),
    );
    const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    return luminance > 0.55 ? "#0f172a" : "#ffffff";
}

export function teamLabel(team: "A" | "B", info?: TeamColorInfo | null): string {
    return info?.name?.trim() || `Time ${team}`;
}

export function teamButtonStyle(hex?: string | null): CSSProperties {
    const backgroundColor = normalizeHex(hex);
    if (!backgroundColor) return {};
    return {
        backgroundColor,
        color: readableTextColor(backgroundColor),
        borderColor: backgroundColor,
    };
}
import type { CSSProperties } from "react";
