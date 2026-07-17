import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Loader2, AlertCircle, Play,
    ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { PublicApi } from "../api/endpoints";
import type { PublicClipDto, PublicMatchReplaysDto } from "../domains/matches/matchTypes";
import ReplayPlayer from "../domains/matches/ui/ReplayPlayer";
import { teamButtonStyle, teamLabel } from "../utils/teamColorUtils";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
}

function ColorDot({ hex, name }: { hex: string | null; name: string | null }) {
    return (
        <span className="flex items-center gap-1.5">
            {hex && (
                <span
                    className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                    style={{ background: hex }}
                />
            )}
            <span className="font-semibold text-white">{name ?? "Time"}</span>
        </span>
    );
}

function isGoalType(type: string) {
    return type === "Gol" || type === "GolTimeA" || type === "GolTimeB";
}

function isPlayType(type: string) {
    return type === "Jogada";
}

function clipLabel(type: string, teamAName: string, teamBName: string) {
    if (type === "GolTimeA") return `Gol ${teamAName}`;
    if (type === "GolTimeB") return `Gol ${teamBName}`;
    return type;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function PublicLightbox({
    clips,
    index,
    onClose,
    onPrev,
    onNext,
    teamAName,
    teamBName,
}: {
    clips: PublicClipDto[];
    index: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    teamAName: string;
    teamBName: string;
}) {
    const clip = clips[index];
    const isGol = isGoalType(clip.eventType);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")      onClose();
            else if (e.key === "ArrowLeft")  onPrev();
            else if (e.key === "ArrowRight") onNext();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, onPrev, onNext]);

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
            {/* Close */}
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
            >
                <X size={16} className="text-white" />
            </button>

            {/* Badge */}
            <div className="flex items-center gap-2 mb-4">
                <span className={[
                    "text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide",
                    isGol
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                ].join(" ")}>
                    {clipLabel(clip.eventType, teamAName, teamBName)}
                </span>
                {isGol && clip.goalNumber != null && clip.totalGoals != null && (
                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
                        Gol {clip.goalNumber} de {clip.totalGoals}
                    </span>
                )}
                <span className="text-[11px] text-slate-500 ml-2">
                    {index + 1} / {clips.length}
                </span>
            </div>

            {/* Player */}
            <div className="w-full max-w-3xl">
                <ReplayPlayer src={clip.videoUrl} clipKey={String(index)} maxHeight="min(70svh, 70vh)" />
            </div>

            {/* Nav */}
            <div className="flex items-center gap-6 mt-5">
                <button
                    type="button"
                    onClick={onPrev}
                    disabled={index === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 text-sm text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={15} /> Anterior
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    disabled={index === clips.length - 1}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 text-sm text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    Próximo <ChevronRight size={15} />
                </button>
            </div>
        </div>
    );
}

// ── Clip card ─────────────────────────────────────────────────────────────────

function PublicClipCard({
    clip,
    index,
    onPlay,
    teamAName,
    teamBName,
}: {
    clip: PublicClipDto;
    index: number;
    onPlay: (idx: number) => void;
    teamAName: string;
    teamBName: string;
}) {
    const isGol = isGoalType(clip.eventType);

    return (
        <div
            className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer group hover:border-slate-600 transition"
            style={{ aspectRatio: "16/9" }}
            onClick={() => onPlay(index)}
        >
            <video
                src={clip.videoUrl}
                className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition"
                preload="metadata"
                muted
            />

            {/* Play */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-105 transition">
                    <Play size={18} className="text-white ml-0.5" fill="white" />
                </div>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-2.5 pb-2 pt-6 bg-gradient-to-t from-black/80 to-transparent">
                <span className={[
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    isGol ? "bg-emerald-500/30 text-emerald-300" : "bg-blue-500/30 text-blue-300",
                ].join(" ")}>
                    {isGol && clip.goalNumber != null ? `Gol ${clip.goalNumber}` : clipLabel(clip.eventType, teamAName, teamBName)}
                </span>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicMatchReplaysPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const [data, setData]       = useState<PublicMatchReplaysDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);
    const [filter, setFilter]   = useState<"all" | "Gol" | "GolTimeA" | "GolTimeB" | "Jogada">("all");
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    useEffect(() => {
        if (!matchId) return;
        PublicApi.getMatchReplays(matchId)
            .then((r) => setData(r.data))
            .catch(() => setError("Partida não encontrada ou link inválido."))
            .finally(() => setLoading(false));
    }, [matchId]);

    const filtered = useMemo(() => {
        if (!data) return [];
        if (filter === "Gol")    return data.clips.filter((c) => isGoalType(c.eventType));
        if (filter === "GolTimeA") return data.clips.filter((c) => c.eventType === "GolTimeA");
        if (filter === "GolTimeB") return data.clips.filter((c) => c.eventType === "GolTimeB");
        if (filter === "Jogada") return data.clips.filter((c) => isPlayType(c.eventType));
        return data.clips;
    }, [data, filter]);

    const openLightbox  = useCallback((idx: number) => setLightboxIdx(idx), []);
    const closeLightbox = useCallback(() => setLightboxIdx(null), []);
    const prevClip = useCallback(() => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)), []);
    const nextClip = useCallback(() => setLightboxIdx((i) => (i !== null && i < filtered.length - 1 ? i + 1 : i)), [filtered.length]);

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <Loader2 size={32} className="text-slate-400 animate-spin" />
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm text-slate-300">{error ?? "Erro desconhecido."}</p>
        </div>
    );

    const totalGoals   = data.clips.filter((c) => isGoalType(c.eventType)).length;
    const totalGoalsA  = data.clips.filter((c) => c.eventType === "GolTimeA").length;
    const totalGoalsB  = data.clips.filter((c) => c.eventType === "GolTimeB").length;
    const totalJogadas = data.clips.filter((c) => isPlayType(c.eventType)).length;
    const hasSplitGoals = totalGoalsA > 0 || totalGoalsB > 0;
    const teamAName = teamLabel("A", { name: data.teamAColorName, hex: data.teamAColorHex });
    const teamBName = teamLabel("B", { name: data.teamBColorName, hex: data.teamBColorHex });
    const filterOptions = hasSplitGoals
        ? (["all", "Jogada", "Gol", "GolTimeA", "GolTimeB"] as const)
        : (["all", "Jogada", "Gol"] as const);
    const hasScore     = data.teamAGoals != null && data.teamBGoals != null;

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* ── Header ── */}
            <div className="border-b border-slate-800 bg-slate-900/50">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    {/* Brand */}
                    <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-4">
                        BratnavaFC · Replays
                    </p>

                    {/* Scoreboard */}
                    {hasScore && (
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <ColorDot hex={data.teamAColorHex} name={data.teamAColorName} />

                            <div className="flex items-center gap-2 px-5 py-2 bg-slate-800 rounded-2xl border border-slate-700">
                                <span className="text-3xl font-black tabular-nums">{data.teamAGoals}</span>
                                <span className="text-slate-500 text-lg font-light">×</span>
                                <span className="text-3xl font-black tabular-nums">{data.teamBGoals}</span>
                            </div>

                            <ColorDot hex={data.teamBColorHex} name={data.teamBColorName} />
                        </div>
                    )}

                    {/* Date & place */}
                    <p className="text-center text-xs text-slate-400 capitalize">
                        {formatDate(data.playedAt)}
                        {data.placeName && <> · {data.placeName}</>}
                    </p>

                    {/* Stats row */}
                    <div className="flex items-center justify-center gap-4 mt-3">
                        <span className="text-xs text-slate-500">{data.clips.length} vídeo{data.clips.length !== 1 ? "s" : ""}</span>
                        {totalGoals > 0 && (
                            <span className="text-[11px] bg-emerald-900/40 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                                {totalGoals} gol{totalGoals !== 1 ? "s" : ""}
                            </span>
                        )}
                        {totalJogadas > 0 && (
                            <span className="text-[11px] bg-blue-900/40 text-blue-400 border border-blue-800 px-2.5 py-0.5 rounded-full">
                                {totalJogadas} jogada{totalJogadas !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {data.clips.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-12">
                        Nenhum replay disponível para esta partida.
                    </p>
                ) : (
                    <>
                        {/* Filter tabs */}
                        {totalGoals > 0 && totalJogadas > 0 && (
                            <div className="flex items-center gap-1 mb-5">
                                {filterOptions.map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setFilter(f)}
                                        className={[
                                            "px-4 py-1.5 rounded-full text-sm font-semibold transition border",
                                            filter === f
                                                ? "bg-white text-slate-900 border-white"
                                                : "bg-transparent text-white/70 border-white/30 hover:bg-white/10",
                                        ].join(" ")}
                                        style={filter === f && f === "GolTimeA" ? teamButtonStyle(data.teamAColorHex)
                                            : filter === f && f === "GolTimeB" ? teamButtonStyle(data.teamBColorHex)
                                            : undefined}
                                    >
                                        {f === "all" ? `Todos (${data.clips.length})`
                                            : f === "Jogada" ? `Jogadas (${totalJogadas})`
                                            : f === "Gol" ? `Gols (${totalGoals})`
                                            : f === "GolTimeA" ? `${teamAName} (${totalGoalsA})`
                                            : `${teamBName} (${totalGoalsB})`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {filtered.map((clip, i) => (
                                <PublicClipCard
                                    key={clip.id}
                                    clip={clip}
                                    index={i}
                                    onPlay={openLightbox}
                                    teamAName={teamAName}
                                    teamBName={teamBName}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Lightbox */}
            {lightboxIdx !== null && (
                <PublicLightbox
                    clips={filtered}
                    index={lightboxIdx}
                    onClose={closeLightbox}
                    onPrev={prevClip}
                    onNext={nextClip}
                    teamAName={teamAName}
                    teamBName={teamBName}
                />
            )}

            <p className="text-center text-[10px] text-slate-700 pb-6">
                Conteúdo compartilhado via BratnavaFC
            </p>
        </div>
    );
}
