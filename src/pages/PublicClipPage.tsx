import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { PublicApi } from "../api/endpoints";
import type { PublicClipDto } from "../domains/matches/matchTypes";
import ReplayPlayer from "../domains/matches/ui/ReplayPlayer";
import { teamLabel } from "../utils/teamColorUtils";

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

    useEffect(() => {
        if (!clipId) return;
        PublicApi.getClip(clipId)
            .then((r) => setClip(r.data))
            .catch(() => setError("Vídeo não encontrado ou link inválido."))
            .finally(() => setLoading(false));
    }, [clipId]);

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

    const isGol = clip.eventType === "Gol" || clip.eventType === "GolTimeA" || clip.eventType === "GolTimeB";
    const teamAName = teamLabel("A", { name: clip.teamAColorName, hex: clip.teamAColorHex });
    const teamBName = teamLabel("B", { name: clip.teamBColorName, hex: clip.teamBColorHex });
    const eventLabel = clip.eventType === "GolTimeA"
        ? `Gol ${teamAName}`
        : clip.eventType === "GolTimeB"
            ? `Gol ${teamBName}`
            : clip.eventType === "Jogada"
                ? "Jogada"
                : clip.eventType;

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
                        {eventLabel}
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

                {/* Player */}
                <div className="shadow-2xl rounded-2xl overflow-hidden">
                    <ReplayPlayer src={clip.videoUrl} clipKey={clipId ?? clip.videoUrl} maxHeight="min(70svh, 70vh)" />
                </div>

                <p className="text-[11px] text-slate-600 text-center mt-4">
                    Conteúdo compartilhado via BratnavaFC
                </p>
            </div>
        </div>
    );
}
