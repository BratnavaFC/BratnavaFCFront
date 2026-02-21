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
            // variável CSS LOCAL (cada preview tem a sua)
            style={{ ["--kit" as any]: color }}
        >
            <svg viewBox="0 0 220 220" className="w-full h-auto">
                {/* camisa (exemplo) */}
                <path
                    d="M60 55 L90 35 L110 55 L130 35 L160 55 L145 85 L145 175 L75 175 L75 85 Z"
                    fill="var(--kit)"
                    stroke="#0f172a"
                    strokeWidth="4"
                    strokeLinejoin="round"
                />

                {/* detalhes (exemplo) */}
                <path
                    d="M90 35 L110 55 L130 35"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}