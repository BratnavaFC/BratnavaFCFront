import { useCallback, useRef, useState } from "react";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MatchesApi } from "../../../api/endpoints";
import type { ReplayClipDto } from "../matchTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

type EventType = "Gol" | "Jogada";

type FileEntry = {
    file:      File;
    id:        string;
    eventType: EventType;
    status:    "pending" | "uploading" | "done" | "error";
    error?:    string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Natural sort so "Clip 2" < "Clip 3" < "Clip 10"
function naturalSort(a: File, b: File): number {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────

type DropZoneProps = {
    eventType: EventType;
    color:     string; // tailwind bg class for accent
    onFiles:   (files: File[], eventType: EventType) => void;
    disabled?: boolean;
};

function DropZone({ eventType, color, onFiles, disabled }: DropZoneProps) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((files: FileList | File[]) => {
        const valid = Array.from(files).filter((f) => f.type.startsWith("video/"));
        if (valid.length > 0) onFiles(valid, eventType);
    }, [eventType, onFiles]);

    return (
        <div className="flex-1 min-w-0">
            {/* Label */}
            <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{eventType}s</span>
            </div>

            {/* Drop area */}
            <div
                onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (!disabled) handleFiles(e.dataTransfer.files);
                }}
                onClick={() => !disabled && inputRef.current?.click()}
                className={[
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 transition-all",
                    disabled
                        ? "opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700"
                        : dragging
                          ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 cursor-pointer"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer",
                ].join(" ")}
            >
                <Upload size={18} className="text-slate-400" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
                    Clique ou arraste<br />vídeos de {eventType.toLowerCase()}s
                </p>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
        </div>
    );
}

// ── File Row ──────────────────────────────────────────────────────────────────

function FileRow({
    entry,
    accentColor,
    onRemove,
    disabled,
}: {
    entry:       FileEntry;
    accentColor: string;
    onRemove:    () => void;
    disabled:    boolean;
}) {
    return (
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            {/* Type dot */}
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${accentColor}`} />

            {/* Status icon */}
            <div className="shrink-0">
                {entry.status === "uploading" && <Loader2 size={14} className="text-slate-400 animate-spin" />}
                {entry.status === "done"      && <CheckCircle size={14} className="text-emerald-500" />}
                {entry.status === "error"     && <AlertCircle size={14} className="text-red-500" />}
                {entry.status === "pending"   && <span className="block w-3.5 h-3.5" />}
            </div>

            {/* Name + size */}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                    {entry.file.name}
                </p>
                {entry.status === "error" ? (
                    <p className="text-[11px] text-red-500 truncate">{entry.error}</p>
                ) : (
                    <p className="text-[11px] text-slate-400">
                        {formatBytes(entry.file.size)}
                        {entry.status === "done" && " · Enviado"}
                    </p>
                )}
            </div>

            {/* Remove */}
            {entry.status === "pending" && (
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={disabled}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-40"
                >
                    <X size={11} className="text-slate-400" />
                </button>
            )}
        </div>
    );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
    groupId:    string;
    matchId:    string;
    onClose:    () => void;
    onUploaded: (clip: ReplayClipDto) => void;
};

// ── Main Component ────────────────────────────────────────────────────────────

export function UploadReplayModal({ groupId, matchId, onClose, onUploaded }: Props) {
    const [entries,   setEntries]   = useState<FileEntry[]>([]);
    const [uploading, setUploading] = useState(false);

    const addFiles = useCallback((files: File[], eventType: EventType) => {
        const sorted = [...files].sort(naturalSort);
        setEntries((prev) => {
            const newEntries = sorted.map((f) => ({
                file:      f,
                id:        uid(),
                eventType,
                status:    "pending" as const,
            }));
            // Insere mantendo a ordem por tipo: todos os do mesmo tipo juntos, ordenados
            const others = prev.filter((e) => e.eventType !== eventType);
            const same   = prev.filter((e) => e.eventType === eventType);
            const merged = [...same, ...newEntries].sort((a, b) => naturalSort(a.file, b.file));
            // Reconstrói: Gols primeiro, depois Jogadas, cada grupo em ordem
            return eventType === "Gol"
                ? [...merged, ...others]
                : [...others, ...merged];
        });
    }, []);

    const removeEntry = (id: string) =>
        setEntries((prev) => prev.filter((e) => e.id !== id));

    const handleUpload = async () => {
        // Processa em ordem: Gols (por nome) → Jogadas (por nome)
        // Isso garante que RecordedAt no banco siga a ordem cronológica dos clips
        const pending = entries
            .filter((e) => e.status === "pending")
            .sort((a, b) => {
                if (a.eventType !== b.eventType)
                    return a.eventType === "Gol" ? -1 : 1;
                return naturalSort(a.file, b.file);
            });
        if (pending.length === 0) return;

        setUploading(true);

        for (const entry of pending) {
            setEntries((prev) =>
                prev.map((e) => e.id === entry.id ? { ...e, status: "uploading" } : e),
            );
            try {
                const res  = await MatchesApi.uploadReplay(groupId, matchId, entry.file, entry.eventType);
                const clip = (res.data as any)?.data ?? res.data;
                setEntries((prev) =>
                    prev.map((e) => e.id === entry.id ? { ...e, status: "done" } : e),
                );
                if (clip) onUploaded(clip);
            } catch (err: any) {
                const msg = err?.response?.data?.error ?? "Falha no upload.";
                setEntries((prev) =>
                    prev.map((e) =>
                        e.id === entry.id ? { ...e, status: "error", error: msg } : e,
                    ),
                );
                toast.error(`${entry.file.name}: ${msg}`);
            }
        }

        setUploading(false);
    };

    const gols    = entries.filter((e) => e.eventType === "Gol");
    const jogadas = entries.filter((e) => e.eventType === "Jogada");
    const pending = entries.filter((e) => e.status === "pending").length;
    const done    = entries.filter((e) => e.status === "done").length;
    const allDone = entries.length > 0 && entries.every((e) => e.status === "done" || e.status === "error");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Upload de Replays</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">Adicione gols e jogadas da partida</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={uploading}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40"
                    >
                        <X size={15} className="text-slate-500" />
                    </button>
                </div>

                {/* ── Drop zones ── */}
                <div className="px-5 pt-4 shrink-0">
                    <div className="flex gap-3">
                        <DropZone
                            eventType="Gol"
                            color="bg-emerald-500"
                            onFiles={addFiles}
                            disabled={uploading}
                        />
                        <DropZone
                            eventType="Jogada"
                            color="bg-blue-500"
                            onFiles={addFiles}
                            disabled={uploading}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                        MP4, MOV, WebM, AVI · máx 500 MB por arquivo
                    </p>
                </div>

                {/* ── File list ── */}
                {entries.length > 0 && (
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

                        {/* Gols */}
                        {gols.length > 0 && (
                            <div>
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                    Gols ({gols.length})
                                </p>
                                <div className="space-y-1.5">
                                    {gols.map((e) => (
                                        <FileRow
                                            key={e.id}
                                            entry={e}
                                            accentColor="bg-emerald-500"
                                            onRemove={() => removeEntry(e.id)}
                                            disabled={uploading}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Jogadas */}
                        {jogadas.length > 0 && (
                            <div>
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                    Jogadas ({jogadas.length})
                                </p>
                                <div className="space-y-1.5">
                                    {jogadas.map((e) => (
                                        <FileRow
                                            key={e.id}
                                            entry={e}
                                            accentColor="bg-blue-500"
                                            onRemove={() => removeEntry(e.id)}
                                            disabled={uploading}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400 tabular-nums">
                        {entries.length === 0
                            ? "Nenhum arquivo selecionado"
                            : allDone
                              ? `${done} de ${entries.length} enviado${done !== 1 ? "s" : ""}`
                              : `${pending} arquivo${pending !== 1 ? "s" : ""} aguardando · ${gols.filter(e=>e.status==="pending").length} gols · ${jogadas.filter(e=>e.status==="pending").length} jogadas`}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={uploading}
                            className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40"
                        >
                            {allDone ? "Fechar" : "Cancelar"}
                        </button>
                        {!allDone && (
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading || pending === 0}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Enviando…
                                    </>
                                ) : (
                                    <>
                                        <Upload size={14} />
                                        Enviar {pending > 0 ? `(${pending})` : ""}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
