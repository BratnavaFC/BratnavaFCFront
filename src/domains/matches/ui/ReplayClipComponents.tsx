/**
 * Shared replay components used by both ReplaySection (MatchDetails)
 * and ReplayVaultPage. ReplaySection is the canonical reference.
 */

import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Download, Heart, Link, Loader2, Maximize2, Minimize2, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ReplayClipDto, ClipLikerDto } from "../matchTypes";
import { MatchesApi } from "../../../api/endpoints";
import ReplayPlayer, { type ReplayPlayerHandle } from "./ReplayPlayer";
import { toUtcDate } from "../../../utils/dateUtils";
import { teamLabel } from "../../../utils/teamColorUtils";

// ── Stream URL helper ──────────────────────────────────────────────────────────
// Usa a URL presignada direta do R2. Se o iOS Safari voltar a dar problema
// (CORS / Range requests), reverter para o proxy:
//   return `${apiBaseUrl}/api/matches/group/${groupId}/replays/${clipId}/stream?t=${encodeURIComponent(token)}`;

function useStreamUrl(_groupId: string, _clipId: string, videoUrl: string): string {
    return videoUrl;
}

function isGoalType(type: string) {
    return type === "Gol" || type === "GolTimeA" || type === "GolTimeB";
}

function eventLabel(type: string, teamAName?: string | null, teamBName?: string | null) {
    if (type === "GolTimeA") return `GOL ${teamLabel("A", { name: teamAName })}`.toUpperCase();
    if (type === "GolTimeB") return `GOL ${teamLabel("B", { name: teamBName })}`.toUpperCase();
    if (type === "Gol") return "GOL";
    return "JOGADA";
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClipState    = { likeCount: number; isLikedByMe: boolean; isFavoritedByMe: boolean };
export type ClipStateMap = Record<string, ClipState>;
export type LikersData   = ClipLikerDto[] | "loading";
// SPEEDS/Speed migraram para ReplayPlayer.tsx (dono dos controles de velocidade).

// ── Likers popover ────────────────────────────────────────────────────────────

export function LikersPopover({ anchorRect, data, onClose }: {
    anchorRect: { top: number; right: number; bottom: number; left: number };
    data:       LikersData | undefined;
    onClose:    () => void;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const total = Array.isArray(data) ? data.length : 0;
    void anchorRect;

    return (
        <>
            <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" style={{ zIndex: 200 }} onClick={onClose} />
            <div className="fixed inset-x-3 bottom-3 mx-auto max-w-[390px] overflow-hidden rounded-3xl shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2"
                style={{ zIndex: 201, background: "linear-gradient(180deg,#111827,#0f172a)", border: "1px solid rgba(255,255,255,0.13)" }}>
                <div className="flex items-center gap-3 px-5 py-4"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg,#fb7185,#e11d48)" }}>
                        <Heart size={19} style={{ fill: "#fff", color: "#fff" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black text-white leading-tight">Curtido por</h3>
                        <p className="text-xs font-semibold text-white/50">
                            {data === "loading" || data === undefined
                                ? "Carregando curtidas..."
                                : total === 1 ? "1 curtida neste replay" : `${total} curtidas neste replay`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="h-9 w-9 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.11)" }}>
                        <X size={16} />
                    </button>
                </div>
                <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: "min(62vh, 430px)" }}>
                    {(data === "loading" || data === undefined) ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 size={22} className="animate-spin" style={{ color: "rgba(255,255,255,0.45)" }} />
                        </div>
                    ) : data.length === 0 ? (
                        <p className="text-center py-10 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                            Nenhuma curtida ainda
                        </p>
                    ) : data.map((l) => (
                        <div key={l.userId} className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                                style={{ background: "linear-gradient(135deg,rgba(244,63,94,0.95),rgba(139,92,246,0.95))", color: "#fff" }}>
                                {l.userName[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate text-white">{l.userName}</p>
                                <p className="text-[11px] font-semibold text-white/40">curtiu este replay</p>
                            </div>
                            <div className="h-8 w-8 rounded-full flex items-center justify-center"
                                style={{ background: "rgba(244,63,94,0.16)" }}>
                                <Heart size={15} style={{ fill: "#fb7185", color: "#fb7185" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function downloadClip(clip: ReplayClipDto, groupId: string) {
    const time = toUtcDate(clip.recordedAt)
        .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .replace(/:/g, "-");
    const filename = `${clip.eventType}_${time}.mp4`;
    try {
        const res  = await MatchesApi.downloadReplay(groupId, clip.id);
        const blob = new Blob([res.data], { type: "video/mp4" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
        toast.error("Não foi possível baixar o vídeo.");
    }
}

export function formatTime(iso: string) {
    return toUtcDate(iso).toLocaleTimeString("pt-BR", {
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
    isAdmin,
    onPlay,
    onLike,
    onFavorite,
    onDelete,
    onShare,
    onShowLikers,
    teamAName,
    teamBName,
}: {
    clip: ReplayClipDto;
    globalIndex: number;
    groupId: string;
    state: ClipState;
    isAdmin?: boolean;
    onPlay: () => void;
    onLike: () => void;
    onFavorite: () => void;
    onDelete?: () => void;
    onShare?: () => void;
    onShowLikers?: (rect: DOMRect) => void;
    teamAName?: string | null;
    teamBName?: string | null;
}) {
    const isGol    = isGoalType(clip.eventType);
    const streamUrl = useStreamUrl(groupId, clip.id, clip.videoUrl);
    const [confirmDelete, setConfirmDelete] = useState(false);

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
                    <LazyVideoThumb src={streamUrl} onDuration={() => {}} />
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
                        {eventLabel(clip.eventType, teamAName ?? (clip as any).teamAColorName, teamBName ?? (clip as any).teamBColorName)}
                    </span>
                </div>

                {/* Clip index / delete — top right */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                            title="Excluir vídeo"
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
                            style={{ width: 20, height: 20, background: "rgba(239,68,68,0.75)", backdropFilter: "blur(4px)" }}
                        >
                            <Trash2 size={10} className="text-white" />
                        </button>
                    )}
                    <span className="text-[9px] font-semibold text-white/50 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                        #{globalIndex + 1}
                    </span>
                </div>

                {/* Delete confirmation overlay */}
                {isAdmin && confirmDelete && (
                    <div
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl"
                        style={{ background: "rgba(0,0,0,0.88)" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Trash2 size={22} className="text-red-400" />
                        <p className="text-white text-xs font-semibold">Excluir este vídeo?</p>
                        <p className="text-white/40 text-[10px] text-center px-4">Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-2 mt-1">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                                className="text-xs font-semibold px-4 py-1.5 rounded-lg"
                                style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); onDelete?.(); }}
                                className="text-xs font-semibold px-4 py-1.5 rounded-lg"
                                style={{ background: "rgba(239,68,68,0.85)", color: "#fff" }}
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                )}

                {/* Bottom bar */}
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2.5 py-2">
                    {/* Like + favorite */}
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onLike(); }}
                            className="flex items-center gap-1 rounded-full px-2.5 py-1 transition-transform active:scale-90" title="Curtir"
                            style={{ background: state.isLikedByMe ? "rgba(244,63,94,0.22)" : "rgba(0,0,0,0.48)", border: `1px solid ${state.isLikedByMe ? "rgba(244,63,94,0.45)" : "rgba(255,255,255,0.14)"}`, backdropFilter: "blur(5px)" }}>
                            <Heart size={14} style={{ fill: state.isLikedByMe ? "#f43f5e" : "none", color: state.isLikedByMe ? "#f43f5e" : "rgba(255,255,255,0.8)", filter: state.isLikedByMe ? "drop-shadow(0 0 4px rgba(244,63,94,0.6))" : "none", transition: "all 0.15s" }} />
                        </button>
                        {onShowLikers ? (
                            <button type="button"
                                onClick={(e) => { e.stopPropagation(); onShowLikers(e.currentTarget.getBoundingClientRect()); }}
                                title="Ver quem curtiu"
                                className="rounded-full px-2 py-1 transition-transform active:scale-90"
                                style={{ background: "rgba(0,0,0,0.48)", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(5px)" }}>
                                <span style={{ fontSize: 10, color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.78)", fontWeight: 800 }}>
                                    {state.likeCount}
                                </span>
                            </button>
                        ) : (
                            <span style={{ fontSize: 10, color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{state.likeCount}</span>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); onFavorite(); }}
                            className="rounded-full px-2.5 py-1 transition-transform active:scale-90" title="Favoritar"
                            style={{ background: state.isFavoritedByMe ? "rgba(245,158,11,0.22)" : "rgba(0,0,0,0.48)", border: `1px solid ${state.isFavoritedByMe ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.14)"}`, backdropFilter: "blur(5px)" }}>
                            <Bookmark size={14} style={{ fill: state.isFavoritedByMe ? "#f59e0b" : "none", color: state.isFavoritedByMe ? "#f59e0b" : "rgba(255,255,255,0.7)", filter: state.isFavoritedByMe ? "drop-shadow(0 0 4px rgba(245,158,11,0.6))" : "none", transition: "all 0.15s" }} />
                        </button>
                    </div>

                    {/* Timestamp */}
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                        {formatTime(clip.recordedAt)}
                    </span>

                    {/* Share + download */}
                    <div className="flex items-center gap-1.5">
                        {onShare && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onShare(); }}
                                className="flex items-center justify-center rounded-md" title="Compartilhar vídeo"
                                style={{ width: 24, height: 24, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                                <Link size={12} className="text-white" />
                            </button>
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
    isAdmin,
    onClose,
    onPrev,
    onNext,
    onLike,
    onFavorite,
    onDelete,
    onShare,
    onShowLikers,
    teamAName,
    teamBName,
}: {
    clips: ReplayClipDto[];
    index: number;
    groupId: string;
    clipStates: ClipStateMap;
    isAdmin?: boolean;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onLike: (clipId: string) => void;
    onFavorite: (clipId: string) => void;
    onDelete?: (clipId: string) => void;
    onShare?: (clipId: string) => void;
    onShowLikers?: (clipId: string, rect: DOMRect) => void;
    teamAName?: string | null;
    teamBName?: string | null;
}) {
    const clip      = clips[index];
    const isGol     = isGoalType(clip.eventType);
    const canPrev   = index > 0;
    const canNext   = index < clips.length - 1;
    const state     = clipStates[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false };
    const streamUrl = useStreamUrl(groupId, clip.id, clip.videoUrl);
    const touchStartX    = useRef<number>(0);
    const playerRef      = useRef<ReplayPlayerHandle>(null);
    const containerRef   = useRef<HTMLDivElement>(null);
    const videoWrapperRef= useRef<HTMLDivElement>(null);
    const getVideo       = () => playerRef.current?.video ?? null;
    // Pinch-to-zoom: use refs to avoid re-renders on every touchmove
    const zoomRef        = useRef(1);
    const panRef         = useRef({ x: 0, y: 0 });
    const [zoom, setZoom]= useState(1); // drives conditional rendering
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState(false);

    // Tela cheia é do ReplayPlayer (fullscreen no container do player para preencher
    // a tela). O Lightbox só encaminha via ref e reflete o estado no ícone da top bar.
    const toggleFullscreen = () => playerRef.current?.toggleFullscreen();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // espaço, vírgula, ponto, L e F são tratados dentro do ReplayPlayer
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft"  && canPrev) onPrev();
            if (e.key === "ArrowRight" && canNext) onNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose, onPrev, onNext, canPrev, canNext]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { setConfirmDelete(false); }, [clip.id]);

    // Reset zoom when navigating to another clip
    useEffect(() => {
        zoomRef.current    = 1;
        panRef.current     = { x: 0, y: 0 };
        setZoom(1);
        const v = getVideo();
        if (v) v.style.transform = "";
    }, [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Pinch-to-zoom with passive:false (required for preventDefault to work)
    useEffect(() => {
        const wrapper = videoWrapperRef.current;
        if (!wrapper) return;
        let pinchStartDist = 0;
        let pinchStartZoom = 1;
        let panStartX = 0, panStartY = 0;

        function getDist(t: TouchList) {
            return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        }
        function applyTransform() {
            const v = getVideo();
            if (!v) return;
            const z = zoomRef.current;
            const { x, y } = panRef.current;
            v.style.transformOrigin = "center center";
            v.style.transform = z === 1 ? "" : `scale(${z}) translate(${x / z}px, ${y / z}px)`;
        }
        function onStart(e: TouchEvent) {
            if (e.touches.length === 2) {
                pinchStartDist = getDist(e.touches);
                pinchStartZoom = zoomRef.current;
                e.preventDefault();
            } else if (e.touches.length === 1 && zoomRef.current > 1) {
                panStartX = e.touches[0].clientX - panRef.current.x;
                panStartY = e.touches[0].clientY - panRef.current.y;
                e.preventDefault();
            }
        }
        function onMove(e: TouchEvent) {
            if (e.touches.length === 2) {
                const newZoom = Math.max(1, Math.min(4, pinchStartZoom * (getDist(e.touches) / pinchStartDist)));
                zoomRef.current = newZoom;
                applyTransform();
                setZoom(newZoom);
                e.preventDefault();
            } else if (e.touches.length === 1 && zoomRef.current > 1) {
                panRef.current = { x: e.touches[0].clientX - panStartX, y: e.touches[0].clientY - panStartY };
                applyTransform();
                e.preventDefault();
            }
        }
        function onEnd() {
            if (zoomRef.current < 1.05) {
                zoomRef.current = 1;
                panRef.current  = { x: 0, y: 0 };
                setZoom(1);
                const v = getVideo();
                if (v) v.style.transform = "";
            }
        }
        wrapper.addEventListener("touchstart", onStart, { passive: false });
        wrapper.addEventListener("touchmove",  onMove,  { passive: false });
        wrapper.addEventListener("touchend",   onEnd);
        return () => {
            wrapper.removeEventListener("touchstart", onStart);
            wrapper.removeEventListener("touchmove",  onMove);
            wrapper.removeEventListener("touchend",   onEnd);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Track fullscreen changes (Android/desktop + iOS webkitEnterFullscreen)
    useEffect(() => {
        function onFsChange() {
            setIsFullscreen(!!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement
            ));
        }
        function onVideoFsBegin() { setIsFullscreen(true); }
        function onVideoFsEnd()   { setIsFullscreen(false); }

        const video = getVideo();
        document.addEventListener("fullscreenchange",        onFsChange);
        document.addEventListener("webkitfullscreenchange",  onFsChange);
        video?.addEventListener("webkitbeginfullscreen", onVideoFsBegin);
        video?.addEventListener("webkitendfullscreen",   onVideoFsEnd);
        return () => {
            document.removeEventListener("fullscreenchange",       onFsChange);
            document.removeEventListener("webkitfullscreenchange", onFsChange);
            video?.removeEventListener("webkitbeginfullscreen", onVideoFsBegin);
            video?.removeEventListener("webkitendfullscreen",   onVideoFsEnd);
        };
    }, []);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(10px)" }}
            onClick={onClose}
        >
            <div className="flex min-h-full items-center justify-center p-4">
            <div
                className="relative w-full max-w-5xl"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                    // Ignore multi-touch (pinch) e não navega em tela cheia
                    // (lá o arraste posiciona o foco no modo preencher).
                    if (e.touches.length !== 1 || zoom > 1 || isFullscreen) return;
                    touchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                    if (e.changedTouches.length !== 1 || zoom > 1 || isFullscreen) return;
                    const dx = e.changedTouches[0].clientX - touchStartX.current;
                    if (Math.abs(dx) < 10) return;
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
                            {eventLabel(clip.eventType, teamAName ?? (clip as any).teamAColorName, teamBName ?? (clip as any).teamBColorName)}
                        </span>
                        <span className="text-sm text-white/50 tabular-nums truncate">{formatTime(clip.recordedAt)}</span>
                        <span className="text-xs text-white/25 font-mono shrink-0">{index + 1}&thinsp;/&thinsp;{clips.length}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Botão tela cheia — visível e com label no mobile */}
                        <button type="button" onClick={toggleFullscreen}
                            title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
                            className="flex items-center gap-1.5 rounded-lg text-white font-medium active:scale-95 transition-all"
                            style={{ padding: "6px 10px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            <span className="text-xs hidden sm:inline">{isFullscreen ? "Minimizar" : "Tela cheia"}</span>
                        </button>
                        <button type="button" onClick={onClose} title="Fechar (ESC)"
                            className="flex items-center justify-center rounded-lg text-white/60 hover:text-white active:scale-95 transition-all"
                            style={{ width: 32, height: 32, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.20)" }}>
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Player profissional — sem remontar entre clips (fullscreen persiste). */}
                {/* videoWrapperRef: recebe os eventos de pinch-to-zoom com passive:false */}
                <div ref={videoWrapperRef} className="relative">
                    <ReplayPlayer
                        ref={playerRef}
                        src={streamUrl}
                        clipKey={clip.id}
                        maxHeight="min(calc(100svh - 300px), calc(100vh - 300px))"
                        onEnded={canNext ? onNext : undefined}
                    />
                    {/* Zoom indicator */}
                    {zoom > 1.05 && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none"
                            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, letterSpacing: "0.03em" }}>
                            {zoom.toFixed(1)}×
                        </div>
                    )}
                </div>

                {/* Ações sociais */}
                <div className="flex items-center justify-end flex-wrap mt-3 px-1 gap-x-2 gap-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Like button — heart toggles, count opens likers */}
                        <div className="flex items-center rounded-xl"
                            style={{ background: state.isLikedByMe ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${state.isLikedByMe ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.14)"}` }}>
                            <button type="button" onClick={() => onLike(clip.id)} title="Curtir"
                                className="flex items-center gap-1.5 justify-center rounded-l-xl transition-all active:scale-95"
                                style={{ height: 34, padding: "0 10px", color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.62)" }}>
                                <Heart size={13} style={{ fill: state.isLikedByMe ? "#f43f5e" : "none", color: state.isLikedByMe ? "#f43f5e" : "inherit", transition: "all 0.15s" }} />
                                <span className="text-xs font-bold hidden sm:inline">{state.isLikedByMe ? "Curtido" : "Curtir"}</span>
                            </button>
                            {onShowLikers ? (
                                <button type="button"
                                    onClick={(e) => onShowLikers(clip.id, e.currentTarget.getBoundingClientRect())}
                                    className="flex items-center justify-center text-xs font-bold rounded-r-xl transition-all active:scale-95"
                                    title="Ver quem curtiu"
                                    style={{ height: 34, minWidth: 76, padding: "0 10px", borderLeft: `1px solid ${state.isLikedByMe ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.1)"}`, color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.62)" }}>
                                    {state.likeCount} curtida{state.likeCount !== 1 ? "s" : ""}
                                </button>
                            ) : (
                                <span className="text-xs font-bold"
                                    style={{ height: 34, minWidth: 76, padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: `1px solid ${state.isLikedByMe ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.1)"}`, color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.5)" }}>
                                    {state.likeCount} curtida{state.likeCount !== 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                        <button type="button" onClick={() => onFavorite(clip.id)} title={state.isFavoritedByMe ? "Remover favorito" : "Favoritar"}
                            className="flex items-center justify-center rounded-xl transition-all active:scale-95"
                            style={{ width: 32, height: 30, background: state.isFavoritedByMe ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${state.isFavoritedByMe ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.14)"}`, color: state.isFavoritedByMe ? "#fcd34d" : "rgba(255,255,255,0.5)" }}>
                            <Bookmark size={13} style={{ fill: state.isFavoritedByMe ? "#f59e0b" : "none", color: state.isFavoritedByMe ? "#f59e0b" : "inherit", transition: "all 0.15s" }} />
                        </button>
                        {onShare && (
                            <button type="button" onClick={() => onShare(clip.id)} title="Compartilhar link"
                                className="flex items-center justify-center rounded-xl transition-all active:scale-95"
                                style={{ width: 32, height: 30, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.5)" }}>
                                <Link size={13} />
                            </button>
                        )}
                        <button type="button" onClick={() => downloadClip(clip, groupId)} title="Baixar"
                            className="flex items-center justify-center rounded-xl transition-colors"
                            style={{ width: 32, height: 30, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.5)" }}>
                            <Download size={13} />
                        </button>
                        {isAdmin && (
                            <button type="button" onClick={() => setConfirmDelete((v) => !v)} title="Excluir vídeo"
                                className="flex items-center justify-center rounded-xl transition-all"
                                style={{ width: 32, height: 30, background: confirmDelete ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.10)", border: `1px solid ${confirmDelete ? "rgba(239,68,68,0.6)" : "rgba(239,68,68,0.25)"}`, color: "rgba(239,68,68,0.75)" }}>
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Confirmação de exclusão */}
                {isAdmin && confirmDelete && (
                    <div className="mt-2 px-1 flex items-center justify-end gap-3 rounded-xl py-2.5"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <span className="text-xs text-red-400 font-medium">Excluir este vídeo permanentemente?</span>
                        <button type="button" onClick={() => setConfirmDelete(false)}
                            className="text-xs font-semibold px-3 py-1 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                            Cancelar
                        </button>
                        <button type="button" onClick={() => { setConfirmDelete(false); onDelete?.(clip.id); }}
                            className="text-xs font-semibold px-3 py-1 rounded-lg"
                            style={{ background: "rgba(239,68,68,0.8)", color: "#fff" }}>
                            Excluir
                        </button>
                    </div>
                )}

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
        </div>
    );
}
