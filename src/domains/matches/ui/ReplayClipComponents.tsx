/**
 * Shared replay components used by both ReplaySection (MatchDetails)
 * and ReplayVaultPage. ReplaySection is the canonical reference.
 */

import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Download, Heart, Play, X } from "lucide-react";
import type { ReplayClipDto } from "../matchTypes";
import { MatchesApi } from "../../../api/endpoints";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClipState    = { likeCount: number; isLikedByMe: boolean; isFavoritedByMe: boolean };
export type ClipStateMap = Record<string, ClipState>;

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type Speed   = (typeof SPEEDS)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function downloadClip(clip: ReplayClipDto, groupId: string) {
    const time = new Date(clip.uploadedAt)
        .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .replace(/:/g, "-");
    const filename = `${clip.eventType}_${time}.mp4`;
    const res  = await MatchesApi.downloadReplay(groupId, clip.id);
    const blob = new Blob([res.data], { type: "video/mp4" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}

export function formatDuration(seconds: number) {
    const s   = Math.round(seconds);
    const m   = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, "0")}`;
}

// ── Lazy thumbnail ────────────────────────────────────────────────────────────

export function LazyVideoThumb({
    src,
    onDuration,
}: {
    src: string;
    onDuration: (s: number) => void;
}) {
    const ref   = useRef<HTMLVideoElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) { setReady(true); observer.disconnect(); }
            },
            { rootMargin: "300px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <video
            ref={ref}
            src={ready ? `${src}#t=0.5` : undefined}
            className="w-full h-full object-cover"
            preload={ready ? "metadata" : "none"}
            muted
            playsInline
            onLoadedMetadata={(e) => {
                const d = (e.target as HTMLVideoElement).duration;
                if (d && isFinite(d)) onDuration(d);
            }}
        />
    );
}

// ── Video Card ────────────────────────────────────────────────────────────────

export function VideoCard({
    clip,
    globalIndex,
    groupId,
    state,
    onPlay,
    onLike,
    onFavorite,
}: {
    clip: ReplayClipDto;
    globalIndex: number;
    groupId: string;
    state: ClipState;
    onPlay: () => void;
    onLike: () => void;
    onFavorite: () => void;
}) {
    const isGol = clip.eventType === "Gol";
    const [duration, setDuration] = useState<number | null>(null);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onPlay}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPlay()}
            className="group relative w-full rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 transition-all duration-200 hover:shadow-xl cursor-pointer"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}
        >
            <div className="relative aspect-video bg-slate-900 overflow-hidden">
                {/* Thumbnail */}
                <div className="absolute inset-0 opacity-55 group-hover:opacity-70 transition-opacity duration-300">
                    <LazyVideoThumb src={clip.videoUrl} onDuration={setDuration} />
                </div>

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full scale-150 opacity-0 group-hover:opacity-100 group-hover:scale-[2] transition-all duration-400 blur-lg bg-white/15" />
                        <div className="relative w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-white/25 group-hover:scale-110 transition-all duration-200">
                            <Play size={17} className="text-white fill-white ml-0.5" />
                        </div>
                    </div>
                </div>

                {/* Event type badge — top left */}
                <div className="absolute top-2 left-2">
                    <span style={{
                        fontSize: 9, fontWeight: 900, letterSpacing: "0.1em",
                        padding: "2px 7px", borderRadius: 999, border: "1px solid",
                        textTransform: "uppercase" as const,
                        background: isGol ? "rgba(16,185,129,0.85)" : "rgba(59,130,246,0.85)",
                        color: "#fff",
                        borderColor: isGol ? "rgba(52,211,153,0.4)" : "rgba(96,165,250,0.4)",
                    }}>
                        {isGol ? "GOL" : "JOGADA"}
                    </span>
                </div>

                {/* Clip index — top right */}
                <div className="absolute top-2 right-2">
                    <span className="text-[9px] font-semibold text-white/50 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                        #{globalIndex + 1}
                    </span>
                </div>

                {/* Bottom bar */}
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2.5 py-2">
                    {/* Like + favorite */}
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onLike(); }}
                            className="flex items-center gap-1 transition-transform active:scale-90" title="Like">
                            <Heart size={14} style={{ fill: state.isLikedByMe ? "#f43f5e" : "none", color: state.isLikedByMe ? "#f43f5e" : "rgba(255,255,255,0.7)", filter: state.isLikedByMe ? "drop-shadow(0 0 4px rgba(244,63,94,0.6))" : "none", transition: "all 0.15s" }} />
                            {state.likeCount > 0 && (
                                <span style={{ fontSize: 10, color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{state.likeCount}</span>
                            )}
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onFavorite(); }}
                            className="transition-transform active:scale-90" title="Favoritar">
                            <Bookmark size={14} style={{ fill: state.isFavoritedByMe ? "#f59e0b" : "none", color: state.isFavoritedByMe ? "#f59e0b" : "rgba(255,255,255,0.7)", filter: state.isFavoritedByMe ? "drop-shadow(0 0 4px rgba(245,158,11,0.6))" : "none", transition: "all 0.15s" }} />
                        </button>
                    </div>

                    {/* Timestamp */}
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                        {formatTime(clip.uploadedAt)}
                    </span>

                    {/* Duration + download */}
                    <div className="flex items-center gap-1.5">
                        {duration !== null && (
                            <span className="tabular-nums" style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: 5 }}>
                                {formatDuration(duration)}
                            </span>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); downloadClip(clip, groupId); }}
                            className="flex items-center justify-center rounded-md" title="Baixar vídeo"
                            style={{ width: 24, height: 24, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                            <Download size={12} className="text-white" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

export function Lightbox({
    clips,
    index,
    groupId,
    clipStates,
    onClose,
    onPrev,
    onNext,
    onLike,
    onFavorite,
}: {
    clips: ReplayClipDto[];
    index: number;
    groupId: string;
    clipStates: ClipStateMap;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onLike: (clipId: string) => void;
    onFavorite: (clipId: string) => void;
}) {
    const clip      = clips[index];
    const isGol     = clip.eventType === "Gol";
    const canPrev   = index > 0;
    const canNext   = index < clips.length - 1;
    const state     = clipStates[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false };
    const touchStartX = useRef<number>(0);
    const videoRef    = useRef<HTMLVideoElement>(null);

    const [speed, setSpeed] = useState<Speed>(() => {
        const saved = localStorage.getItem("replay_speed");
        const n = saved ? parseFloat(saved) : 1;
        return (SPEEDS.includes(n as Speed) ? n : 1) as Speed;
    });

    function applySpeed(s: Speed) {
        setSpeed(s);
        localStorage.setItem("replay_speed", String(s));
        if (videoRef.current) videoRef.current.playbackRate = s;
    }

    useEffect(() => {
        if (videoRef.current) videoRef.current.playbackRate = speed;
    }, [speed]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft"  && canPrev) onPrev();
            if (e.key === "ArrowRight" && canNext) onNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose, onPrev, onNext, canPrev, canNext]);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(10px)" }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-5xl"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                    const dx = e.changedTouches[0].clientX - touchStartX.current;
                    if (dx > 50 && canPrev) onPrev();
                    if (dx < -50 && canNext) onNext();
                }}
            >
                {/* Top bar — 1 linha sempre */}
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={[
                            "text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full border uppercase shrink-0",
                            isGol ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-blue-500/20 text-blue-400 border-blue-500/30",
                        ].join(" ")}>
                            {isGol ? "GOL" : "JOGADA"}
                        </span>
                        <span className="text-sm text-white/50 tabular-nums truncate">{formatTime(clip.uploadedAt)}</span>
                        <span className="text-xs text-white/25 font-mono shrink-0">{index + 1}&thinsp;/&thinsp;{clips.length}</span>
                    </div>
                    <button type="button" onClick={onClose} title="Fechar (ESC)"
                        className="flex items-center justify-center rounded-lg text-white/40 hover:text-white active:scale-95 transition-all shrink-0"
                        style={{ width: 32, height: 32, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                        <X size={15} />
                    </button>
                </div>

                {/* Video player */}
                <video
                    ref={videoRef}
                    key={clip.id}
                    src={clip.videoUrl}
                    className="w-full rounded-2xl bg-black shadow-2xl"
                    controls
                    autoPlay
                    playsInline
                    onLoadedMetadata={() => { if (videoRef.current) videoRef.current.playbackRate = speed; }}
                    onEnded={canNext ? onNext : undefined}
                />

                {/* Speed controls + ações desktop */}
                <div className="flex items-center justify-between mt-3 px-1 gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Velocidade</span>
                        <select
                            value={speed}
                            onChange={(e) => applySpeed(Number(e.target.value) as Speed)}
                            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", outline: "none" }}
                        >
                            {SPEEDS.map((s) => (
                                <option key={s} value={s} style={{ background: "#1e293b", color: "#fff" }}>{s}×</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => onLike(clip.id)} title="Curtir"
                            className="flex items-center justify-center rounded-xl transition-all active:scale-95"
                            style={{ width: 32, height: 30, background: state.isLikedByMe ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${state.isLikedByMe ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.14)"}`, color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.5)" }}>
                            <Heart size={13} style={{ fill: state.isLikedByMe ? "#f43f5e" : "none", color: state.isLikedByMe ? "#f43f5e" : "inherit", transition: "all 0.15s" }} />
                        </button>
                        <button type="button" onClick={() => onFavorite(clip.id)} title={state.isFavoritedByMe ? "Remover favorito" : "Favoritar"}
                            className="flex items-center justify-center rounded-xl transition-all active:scale-95"
                            style={{ width: 32, height: 30, background: state.isFavoritedByMe ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${state.isFavoritedByMe ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.14)"}`, color: state.isFavoritedByMe ? "#fcd34d" : "rgba(255,255,255,0.5)" }}>
                            <Bookmark size={13} style={{ fill: state.isFavoritedByMe ? "#f59e0b" : "none", color: state.isFavoritedByMe ? "#f59e0b" : "inherit", transition: "all 0.15s" }} />
                        </button>
                        <button type="button" onClick={() => downloadClip(clip, groupId)} title="Baixar"
                            className="flex items-center justify-center rounded-xl transition-colors"
                            style={{ width: 32, height: 30, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.5)" }}>
                            <Download size={13} />
                        </button>
                    </div>
                </div>

                {/* Bottom navigation */}
                <div className="flex items-center justify-between mt-4 gap-4">
                    <button type="button" onClick={onPrev} disabled={!canPrev}
                        className="flex items-center gap-2 text-sm font-medium rounded-xl transition-all disabled:cursor-not-allowed"
                        style={{ padding: "8px 16px", background: canPrev ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.28)", color: canPrev ? "#fff" : "rgba(255,255,255,0.3)" }}>
                        <ChevronLeft size={15} />Anterior
                    </button>

                    {clips.length <= 20 ? (
                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
                            {clips.map((_, i) => (
                                <div key={i} className="rounded-full transition-all duration-200"
                                    style={{ width: i === index ? 16 : 7, height: 7, backgroundColor: i === index ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)" }} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center gap-3">
                            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full bg-white/50 transition-all duration-200"
                                    style={{ width: `${((index + 1) / clips.length) * 100}%` }} />
                            </div>
                        </div>
                    )}

                    <button type="button" onClick={onNext} disabled={!canNext}
                        className="flex items-center gap-2 text-sm font-medium rounded-xl transition-all disabled:cursor-not-allowed"
                        style={{ padding: "8px 16px", background: canNext ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.28)", color: canNext ? "#fff" : "rgba(255,255,255,0.3)" }}>
                        Próximo<ChevronRight size={15} />
                    </button>
                </div>
            </div>

            {/* Side arrows (large screens) */}
            {canPrev && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 hidden lg:flex w-11 h-11 rounded-full bg-white/10 border border-white/15 items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all">
                    <ChevronLeft size={20} />
                </button>
            )}
            {canNext && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onNext(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 hidden lg:flex w-11 h-11 rounded-full bg-white/10 border border-white/15 items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all">
                    <ChevronRight size={20} />
                </button>
            )}
        </div>
    );
}
