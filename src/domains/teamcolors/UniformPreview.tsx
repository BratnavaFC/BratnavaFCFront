import React, { useMemo } from "react";

type Props = {
    hex: string;
    className?: string;
};

function normalizeHex(input: string) {
    const v = (input ?? "").trim();
    if (!v) return "#e2e8f0";
    return v.startsWith("#") ? v : `#${v}`;
}

export function UniformPreview({ hex, className }: Props) {
    const color = useMemo(() => normalizeHex(hex), [hex]);

    return (
        <div
            className={className}
            style={{ ["--kit" as any]: color }}
        >
            <svg viewBox="0 0 240 220" className="w-full h-auto">

                {/* Camisa clean */}
                <path
                    d="
            M80 55
            L105 40
            L120 55
            L135 40
            L160 55
            L185 70
            L170 95
            L160 90
            L160 185
            L80 185
            L80 90
            L70 95
            L55 70
            Z
          "
                    fill="var(--kit)"
                    stroke="#0f172a"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />

                {/* Gola simples */}
                <path
                    d="M105 40 L120 60 L135 40"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="2"
                    strokeLinecap="round"
                />

            </svg>
        </div>
    );
}