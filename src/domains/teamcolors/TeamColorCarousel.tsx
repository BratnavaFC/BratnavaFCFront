import React, { useEffect, useMemo, useState } from "react";
import { UniformPreview } from "./UniformPreview";

type Item = any;

type Props = {
    items: Item[];
    selectedId: string | null;
    onSelectedIdChange: (id: string) => void;
};

export function TeamColorCarousel({ items, selectedId, onSelectedIdChange }: Props) {
    const count = items?.length ?? 0;

    const initialIndex = useMemo(() => {
        if (!count) return 0;

        const selectedIdx = selectedId ? items.findIndex(i => i.id === selectedId) : -1;
        if (selectedIdx >= 0) return selectedIdx;

        const activeIdx = items.findIndex(i => i.isActive);
        return activeIdx >= 0 ? activeIdx : 0;
    }, [items, selectedId, count]);

    const [index, setIndex] = useState(initialIndex);

    useEffect(() => {
        if (!count) return;
        setIndex(initialIndex);
    }, [count, initialIndex]);

    // quando index muda, sincroniza selectedId
    useEffect(() => {
        if (!count) return;
        const id = items[index]?.id;
        if (id && id !== selectedId) onSelectedIdChange(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, count]);

    const canNav = count > 1;

    function prev() {
        if (!canNav) return;
        setIndex(i => (i - 1 + count) % count);
    }

    function next() {
        if (!canNav) return;
        setIndex(i => (i + 1) % count);
    }

    function relPos(i: number) {
        const raw = i - index;
        const alt = raw > 0 ? raw - count : raw + count;
        return Math.abs(raw) <= Math.abs(alt) ? raw : alt;
    }

    if (!count) return <div className="muted">Nenhuma cor cadastrada.</div>;

    return (
        <div className="relative">
            <div className="overflow-hidden">
                <div className="relative h-[260px]">
                    {items.map((c, i) => {
                        const pos = relPos(i);
                        const isCenter = pos === 0;

                        const clamped = Math.max(-2, Math.min(2, pos));
                        const x = clamped * 220;
                        const scale = isCenter ? 1 : Math.abs(clamped) === 1 ? 0.88 : 0.75;
                        const opacity = Math.abs(clamped) <= 1 ? 1 : 0;
                        const z = isCenter ? 30 : Math.abs(clamped) === 1 ? 20 : 0;

                        const isSelected = selectedId === c.id;

                        return (
                            <div
                                key={c.id}
                                className="absolute left-1/2 top-0 w-[240px] -translate-x-1/2 transition-all duration-300 ease-out"
                                style={{
                                    transform: `translateX(${x}px) translateX(-50%) scale(${scale})`,
                                    opacity,
                                    zIndex: z,
                                    pointerEvents: opacity === 0 ? "none" : "auto",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setIndex(i)}
                                    className={[
                                        "w-full text-left border rounded-2xl p-3 bg-white shadow-sm transition",
                                        isCenter ? "shadow-md" : "",
                                        isSelected ? "ring-2 ring-slate-200 border-slate-400" : "border-slate-200",
                                        "focus:outline-none focus:ring-2 focus:ring-slate-300",
                                    ].join(" ")}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-semibold truncate">{c.name}</div>
                                        <div className="flex items-center gap-2">
                                            {c.isActive ? <span className="pill">Ativo</span> : null}
                                            {isSelected ? <span className="pill">Selecionado</span> : null}
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <UniformPreview hex={c.hexValue ?? "#e2e8f0"} />
                                    </div>

                                    <div className="mt-2 flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg border" style={{ background: c.hexValue }} />
                                        <div className="text-sm text-slate-600">{c.hexValue}</div>
                                    </div>

                                    <div className="mt-3 text-xs text-slate-500">
                                        Clique para selecionar
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
                <button className="btn" onClick={prev} disabled={!canNav}>
                    ◀
                </button>

                <div className="text-sm text-slate-600">
                    {index + 1} / {count}
                </div>

                <button className="btn" onClick={next} disabled={!canNav}>
                    ▶
                </button>
            </div>
        </div>
    );
}