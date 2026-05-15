import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, Play, Pause, Maximize2 } from "lucide-react";
import { PublicApi } from "../api/endpoints";
import type { PublicClipDto } from "../domains/matches/matchTypes";

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

export default function PublicClipPage() {
    const { clipId } = useParams<{ clipId: string }>();
    const [clip, setClip] = useState<PublicClipDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!clipId) return;
        PublicApi.getClip(clipId)
            .then((r) => setClip(r.data))
            .catch(() => setError("Vídeo não encontrado ou link inválido."))
            .finally(() => setLoading(false));
    }, [clipId]);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play(); setPlaying(true); }
        else          { v.pause(); setPlaying(false); }
    };

    const fullscreen = () => videoRef.current?.requestFullscreen();

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <Loader2 size={32} className="text-slate-400 animate-spin" />
        </div>
    );

    if (error || !clip) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm text-slate-300">{error ?? "Erro desconhecido."}</p>
        </div>
    );

    const isGol = clip.eventType === "Gol";

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            {/* Brand */}
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase mb-6">
                BratnavaFC · Replays
            </p>

            <div className="w-full max-w-2xl">
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3">
                    <span className={[
                        "text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide",
                        isGol
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                    ].join(" ")}>
                        {clip.eventType}
                    </span>

                    {isGol && clip.goalNumber != null && clip.totalGoals != null && (
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
                            Gol {clip.goalNumber} de {clip.totalGoals}
                        </span>
                    )}

                    <span className="ml-auto text-[11px] text-slate-500">
                        {formatDate(clip.recordedAt)}
                    </span>
                </div>

                {/* Video */}
                <div
                    className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl cursor-pointer group"
                    style={{ aspectRatio: "16/9" }}
                    onClick={togglePlay}
                >
                    <video
                        ref={videoRef}
                        src={clip.videoUrl}
                        className="w-full h-full object-contain"
                        playsInline
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                        onEnded={() => setPlaying(false)}
                    />

                    {/* Overlay play/pause */}
                    {!playing && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                <Play size={28} className="text-white ml-1" fill="white" />
                            </div>
                        </div>
                    )}

                    {/* Fullscreen button */}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fullscreen(); }}
                        className="absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>

                <p className="text-[11px] text-slate-600 text-center mt-4">
                    Conteúdo compartilhado via BratnavaFC
                </p>
            </div>
        </div>
    );
}
