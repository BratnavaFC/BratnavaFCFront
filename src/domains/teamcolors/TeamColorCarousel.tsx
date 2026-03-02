import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UniformPreview } from "./UniformPreview";

type Item = any;

type Props = {
    items: Item[];
    selectedId: string | null;
    onSelectedIdChange: (id: string) => void;

    /** se true, não mostra pills/selecionado e CTA de "clique" vira "visualizar" */
    readOnly?: boolean;

    /** compacta medidas para smartphone */
    isMobile?: boolean;

    /** ao clicar no card, abre um preview/modal (opcional) */
    onPreview?: (item: Item) => void;
};

export function TeamColorCarousel({
    items,
    selectedId,
    onSelectedIdChange,
    readOnly,
    isMobile,
    onPreview,
}: Props) {
    const count = items?.length ?? 0;

    const initialIndex = useMemo(() => {
        if (!count) return 0;
        const selectedIdx = selectedId
            ? items.findIndex((i: any) => i.id === selectedId)
            : -1;
        if (selectedIdx >= 0) return selectedIdx;
        const activeIdx = items.findIndex((i: any) => i.isActive);
        return activeIdx >= 0 ? activeIdx : 0;
    }, [items, selectedId, count]);

    const [index, setIndex] = useState(initialIndex);

    useEffect(() => {
        if (!count) return;
        setIndex(initialIndex);
    }, [count, initialIndex]);

    useEffect(() => {
        if (!count) return;
        const id = items[index]?.id;
        if (id && id !== selectedId) onSelectedIdChange(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, count]);

    const canNav = count > 1;

    function prev() {
        if (!canNav) return;
        setIndex((i) => (i - 1 + count) % count);
    }

    function next() {
        if (!canNav) return;
        setIndex((i) => (i + 1) % count);
    }

    function relPos(i: number) {
        const raw = i - index;
        const alt = raw > 0 ? raw - count : raw + count;
        return Math.abs(raw) <= Math.abs(alt) ? raw : alt;
    }

    if (!count) return <div className="muted">Nenhuma cor cadastrada.</div>;

    // layout dimensions — tall enough so nothing clips
    const frameH = isMobile ? 268 : 302;
    const cardW  = isMobile ? 220 : 250;
    const xStep  = isMobile ? 192 : 228;

    return (
        <div className="relative select-none">
            {/* ── carousel track ─────────────────────────────────────── */}
            <div className="overflow-hidden">
                <div className="relative" style={{ height: frameH }}>
                    {items.map((c: any, i: number) => {
                        const pos      = relPos(i);
                        const isCenter = pos === 0;
                        const clamped  = Math.max(-2, Math.min(2, pos));
                        const x        = clamped * xStep;
                        const scale    = isCenter ? 1 : Math.abs(clamped) === 1 ? 0.88 : 0.74;
                        const opacity  = Math.abs(clamped) <= 1 ? 1 : 0;
                        const z        = isCenter ? 30 : Math.abs(clamped) === 1 ? 20 : 0;
                        const isSelected = selectedId === c.id;
                        const hex = c.hexValue ?? "#e2e8f0";

                        return (
                            <div
                                key={c.id}
                                className="absolute left-1/2 top-0 -translate-x-1/2 transition-all duration-300 ease-out"
                                style={{
                                    width: cardW,
                                    transform: `translateX(${x}px) translateX(-50%) scale(${scale})`,
                                    opacity,
                                    zIndex: z,
                                    pointerEvents: opacity === 0 ? "none" : "auto",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIndex(i);
                                        if (onPreview) onPreview(c);
                                    }}
                                    className="w-full text-left focus:outline-none"
                                    style={{
                                        borderRadius: 14,
                                        overflow: "hidden",
                                        boxShadow: isCenter
                                            ? `0 8px 32px -4px ${hex}66, 0 2px 10px rgba(0,0,0,0.18)`
                                            : "0 2px 8px rgba(0,0,0,0.08)",
                                        border: isSelected
                                            ? `2px solid ${hex}`
                                            : "2px solid #e2e8f0",
                                        transition: "box-shadow 0.3s, border-color 0.3s",
                                    }}
                                >
                                    {/* ── top color strip ─────────────── */}
                                    <div
                                        className="h-1.5 w-full"
                                        style={{ background: hex }}
                                    />

                                    {/* ── dark jersey stage ───────────── */}
                                    <div
                                        className="flex items-center justify-center"
                                        style={{
                                            background: "linear-gradient(160deg, #ffffff 0%, #000000 100%)",
                                            height: isMobile ? 136 : 152,
                                        }}
                                    >
                                        <div style={{ width: "62%" }}>
                                            <UniformPreview hex={hex} />
                                        </div>
                                    </div>

                                    {/* ── info section ────────────────── */}
                                    <div className="bg-white px-3 pt-2.5 pb-3">
                                        {/* name + status */}
                                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <div className="text-sm font-semibold text-slate-900 truncate">
                                                {c.name}
                                            </div>
                                            {!readOnly && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {c.isActive && (
                                                        <span
                                                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                                                            style={{
                                                                background: `${hex}1a`,
                                                                color: hex,
                                                                border: `1px solid ${hex}55`,
                                                            }}
                                                        >
                                                            Ativo
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none bg-slate-900 text-white">
                                                            Sel.
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* hex row */}
                                        <div className="mt-2 flex items-center gap-2">
                                            <div
                                                className="h-5 w-5 rounded shrink-0"
                                                style={{
                                                    background: hex,
                                                    boxShadow: "0 0 0 1px rgba(0,0,0,0.12)",
                                                }}
                                            />
                                            <span className="text-xs font-mono text-slate-500 tracking-wide">
                                                {hex.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* cta hint */}
                                        <div className="mt-2 text-[10px] text-slate-400 tracking-widest uppercase">
                                            {readOnly ? "Toque para visualizar" : "Clique para selecionar"}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── nav + dot indicators ─────────────────────────────── */}
            <div className="mt-3 flex items-center justify-between gap-4">
                <button
                    type="button"
                    onClick={prev}
                    disabled={!canNav}
                    className="h-9 w-9 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Anterior"
                >
                    <ChevronLeft size={18} />
                </button>

                {/* animated dot indicators */}
                <div className="flex items-center gap-1.5">
                    {items.map((_: any, i: number) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setIndex(i)}
                            className="rounded-full transition-all duration-300"
                            style={{
                                width: i === index ? 20 : 7,
                                height: 7,
                                background: i === index
                                    ? (items[index]?.hexValue ?? "#0f172a")
                                    : "#cbd5e1",
                            }}
                            aria-label={`Cor ${i + 1}`}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={next}
                    disabled={!canNav}
                    className="h-9 w-9 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Próximo"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
