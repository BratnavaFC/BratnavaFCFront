import { useCallback, useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import type { ReplayClipDto } from "../matchTypes";

type Props = {
    clips: ReplayClipDto[];
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function VideoCard({ clip, onPlay }: { clip: ReplayClipDto; onPlay: () => void }) {
    return (
        <button
            type="button"
            onClick={onPlay}
            className="group w-full text-left rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <video
                    src={`${clip.videoUrl}#t=0.5`}
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-60 transition-opacity"
                    preload="metadata"
                    muted
                    playsInline
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all">
                        <Play size={18} className="text-white fill-white ml-0.5" />
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="px-3 py-2 bg-white dark:bg-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatTime(clip.uploadedAt)}
                </div>
            </div>
        </button>
    );
}

function ClipGroup({ title, items, onPlay }: {
    title: string;
    items: ReplayClipDto[];
    onPlay: (clip: ReplayClipDto) => void;
}) {
    if (items.length === 0) return null;
    return (
        <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                {title} ({items.length})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((c) => (
                    <VideoCard key={c.id} clip={c} onPlay={() => onPlay(c)} />
                ))}
            </div>
        </div>
    );
}

export function ReplaySection({ clips }: Props) {
    const [active, setActive] = useState<ReplayClipDto | null>(null);

    const close = useCallback(() => setActive(null), []);

    useEffect(() => {
        if (!active) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [active, close]);

    const gols    = clips.filter((c) => c.eventType === "Gol");
    const jogadas = clips.filter((c) => c.eventType === "Jogada");

    if (clips.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Nenhum replay disponível.
            </p>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <ClipGroup title="Gols"    items={gols}    onPlay={setActive} />
                <ClipGroup title="Jogadas" items={jogadas} onPlay={setActive} />
            </div>

            {/* ── Modal player ───────────────────────────────────────── */}
            {active && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={close}
                >
                    <div
                        className="relative w-full max-w-4xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Fechar */}
                        <button
                            type="button"
                            onClick={close}
                            className="absolute -top-10 right-0 flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
                        >
                            <X size={15} />
                            Fechar (ESC)
                        </button>

                        <video
                            key={active.id}
                            src={active.videoUrl}
                            className="w-full rounded-xl bg-black shadow-2xl"
                            controls
                            autoPlay
                            playsInline
                        />
                    </div>
                </div>
            )}
        </>
    );
}
