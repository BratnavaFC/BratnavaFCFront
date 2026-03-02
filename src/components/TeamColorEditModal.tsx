import React, { useEffect, useMemo } from "react";
import { X, Palette } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Field } from "../components/Field";
import { UniformPreview } from "../domains/teamcolors/UniformPreview";

type Props = {
    open: boolean;
    mode: "create" | "edit";
    title?: string;

    name: string;
    hexValue: string;
    setName: (v: string) => void;
    setHexValue: (v: string) => void;

    onSave: () => Promise<void> | void;
    onClose: () => void;

    isMobile?: boolean;
    saving?: boolean;
};

function normalizeHex(input: string) {
    const v = (input ?? "").trim();
    if (!v) return "#e2e8f0";
    return v.startsWith("#") ? v : `#${v}`;
}

export function TeamColorEditModal({
    open,
    mode,
    title,
    name,
    hexValue,
    setName,
    setHexValue,
    onSave,
    onClose,
    isMobile,
    saving,
}: Props) {
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const preview = useMemo(
        () => ({
            name: name?.trim() ? name.trim() : "—",
            hexValue: normalizeHex(hexValue),
        }),
        [name, hexValue]
    );

    if (!open) return null;

    const hex = preview.hexValue;

    return (
        <div className="fixed inset-0 z-[110]">
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                aria-label="Fechar"
            />

            <div
                className={[
                    "absolute left-1/2 w-[92vw] max-w-2xl -translate-x-1/2 shadow-2xl overflow-hidden",
                    isMobile
                        ? "bottom-0 rounded-t-3xl"
                        : "top-1/2 -translate-y-1/2 rounded-2xl",
                ].join(" ")}
                style={{ border: `1.5px solid ${hex}55` }}
            >
                {/* color strip */}
                <div className="h-1" style={{ background: hex }} />

                {/* header — dark gradient */}
                <div
                    className="px-5 py-4 flex items-center justify-between gap-3"
                    style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                            style={{
                                background: `${hex}28`,
                                border: `1px solid ${hex}60`,
                            }}
                        >
                            <Palette size={16} style={{ color: hex }} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                                {title ?? (mode === "create" ? "Nova cor" : "Editar cor")}
                            </div>
                            <div className="text-base font-semibold text-white truncate mt-0.5">
                                {preview.name}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                        aria-label="Fechar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* body */}
                <div className="bg-white">
                    <div className="grid md:grid-cols-2">

                        {/* ── left: form ──────────────────────────────── */}
                        <div className="p-5 space-y-4">
                            {/* live preview mini-card */}
                            <div
                                className="rounded-xl overflow-hidden"
                                style={{ border: `1.5px solid ${hex}40` }}
                            >
                                {/* mini jersey stage */}
                                <div
                                    className="flex items-center justify-center py-5"
                                    style={{
                                        background: "linear-gradient(160deg, #ffffff 0%, #000000 100%)",
                                    }}
                                >
                                    <div style={{ width: "38%", maxWidth: 88 }}>
                                        <UniformPreview hex={hex} />
                                    </div>
                                </div>

                                {/* color info bar */}
                                <div
                                    className="px-3 py-2 flex items-center gap-2.5 bg-slate-50"
                                    style={{ borderTop: `1px solid ${hex}30` }}
                                >
                                    <div
                                        className="h-5 w-5 rounded shrink-0"
                                        style={{
                                            background: hex,
                                            boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
                                        }}
                                    />
                                    <span className="text-xs font-mono text-slate-500 tracking-wide">
                                        {hex.toUpperCase()}
                                    </span>
                                    <span className="ml-auto text-xs text-slate-500 font-medium truncate max-w-[110px]">
                                        {preview.name}
                                    </span>
                                </div>
                            </div>

                            <Field label="Nome">
                                <input
                                    className="input"
                                    value={name}
                                    placeholder="Ex: Vermelho Sangue"
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={!!saving}
                                />
                            </Field>

                            <Field label="Hex (RGB)">
                                <div className="relative">
                                    <input
                                        className="input font-mono pr-10"
                                        value={hexValue}
                                        placeholder="#111827"
                                        onChange={(e) => setHexValue(e.target.value)}
                                        disabled={!!saving}
                                    />
                                    <div
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded pointer-events-none"
                                        style={{
                                            background: hex,
                                            boxShadow: "0 0 0 1px rgba(0,0,0,0.12)",
                                        }}
                                    />
                                </div>
                            </Field>

                            <div className="text-xs text-slate-400">
                                {mode === "create"
                                    ? "Cria uma nova cor no grupo."
                                    : "Atualiza nome e cor do uniforme selecionado."}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    className="btn"
                                    onClick={onClose}
                                    disabled={!!saving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={onSave}
                                    disabled={!!saving}
                                >
                                    {saving ? "Salvando..." : "Salvar"}
                                </button>
                            </div>
                        </div>

                        {/* ── right: color picker ─────────────────────── */}
                        <div
                            className="p-5 flex flex-col items-center justify-center gap-3 border-l border-slate-100"
                            style={{ minHeight: 240 }}
                        >
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest self-start">
                                Escolher cor
                            </div>
                            <HexColorPicker
                                color={hex}
                                onChange={setHexValue}
                                style={{ width: "100%", maxWidth: 240 }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
