import React, { useEffect, useMemo } from "react";
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

    return (
        <div className="fixed inset-0 z-[110]">
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 bg-black/40"
                aria-label="Fechar"
            />

            <div
                className={[
                    "absolute left-1/2 w-[92vw] max-w-2xl -translate-x-1/2 bg-white shadow-xl border border-slate-200",
                    isMobile
                        ? "bottom-0 rounded-t-3xl"
                        : "top-1/2 -translate-y-1/2 rounded-3xl",
                ].join(" ")}
            >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm text-slate-500">
                            {title ?? (mode === "create" ? "Nova cor" : "Editar cor")}
                        </div>
                        <div className="font-semibold truncate">{preview.name}</div>
                    </div>

                    <button className="btn" onClick={onClose}>
                        Fechar
                    </button>
                </div>

                <div className="p-4">
                    {/* preview */}
                    <div className="flex items-center gap-3">
                        <div className="w-28 shrink-0">
                            <UniformPreview hex={preview.hexValue} />
                        </div>
                        <div className="flex flex-col gap-2 min-w-0">
                            <div className="text-sm text-slate-700 font-semibold">
                                Preview (edição)
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="pill">{preview.name}</span>
                                <span className="pill">{preview.hexValue}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-3">
                            <Field label="Nome">
                                <input
                                    className="input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </Field>

                            <Field label="Hex (RGB)">
                                <input
                                    className="input"
                                    value={hexValue}
                                    onChange={(e) => setHexValue(e.target.value)}
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-2 pt-2">
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

                            <div className="text-xs text-slate-500">
                                {mode === "create"
                                    ? "Cria uma nova cor no grupo."
                                    : "Atualiza nome/hex da cor selecionada."}
                            </div>
                        </div>

                        <div className="min-h-[240px]">
                            <HexColorPicker color={preview.hexValue} onChange={setHexValue} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}