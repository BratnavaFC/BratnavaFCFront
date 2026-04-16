import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Film, Heart, Loader2, RefreshCw, LayoutGrid, ListOrdered, Play, Download, Bookmark, X, ChevronLeft, ChevronRight } from "lucide-react";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { getResponseMessage } from "../api/apiResponse";
import type { LikedReplayClipDto } from "../domains/matches/matchTypes";

// ── helpers ───────────────────────────────────────────────────────────────────

function downloadClip(clip: LikedReplayClipDto, _groupId: string) {
    const time = new Date(clip.recordedAt)
        .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .replace(/:/g, "-");
    const a = document.createElement("a");
    a.href = clip.videoUrl;
    a.download = `${clip.eventType}_${time}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.round(s) % 60).padStart(2, "0")}`;
}

type ClipState = { likeCount: number; isLikedByMe: boolean; isFavoritedByMe: boolean };

// ── Lazy video thumbnail ──────────────────────────────────────────────────────

function LazyThumb({ src, onDuration }: { src: string; onDuration: (s: number) => void }) {
    const ref   = useRef<HTMLVideoElement>(null);
    const [rdy, setRdy] = useState(false);
    useEffect(() => {
        const el = ref.current; if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setRdy(true); obs.disconnect(); } }, { rootMargin: "200px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <video ref={ref} src={rdy ? `${src}#t=0.5` : undefined} preload="metadata" muted playsInline
            onLoadedMetadata={(e) => onDuration((e.currentTarget as HTMLVideoElement).duration)}
            className="w-full h-full object-cover" />
    );
}

// ── VideoCard ─────────────────────────────────────────────────────────────────

function VideoCard({
    clip, groupId, state,
    onPlay, onLike, onFavorite,
}: {
    clip: LikedReplayClipDto; groupId: string;
    state: ClipState;
    onPlay: () => void; onLike: () => void; onFavorite: () => void;
}) {
    const [dur, setDur] = useState<number | null>(null);
    const isGol = clip.eventType === "Gol";

    return (
        <div
            className="group relative overflow-hidden rounded-xl cursor-pointer select-none"
            style={{ aspectRatio: "16/9", background: "#0f172a" }}
            onClick={onPlay}
        >
            {/* Like badge — top-left */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{ background: "rgba(244,63,94,0.85)", backdropFilter: "blur(4px)" }}>
                <Heart size={10} style={{ fill: "#fff", color: "#fff" }} />
                <span className="text-[10px] font-bold text-white">{state.likeCount}</span>
            </div>

            {/* Event type */}
            <div className="absolute top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: isGol ? "rgba(16,185,129,0.85)" : "rgba(59,130,246,0.85)", color: "#fff", backdropFilter: "blur(4px)" }}>
                {isGol ? "⚽ Gol" : "✨ Jogada"}
            </div>

            <LazyThumb src={clip.videoUrl} onDuration={setDur} />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="rounded-full flex items-center justify-center"
                    style={{ width: 44, height: 44, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)", border: "2px solid rgba(255,255,255,0.4)" }}>
                    <Play size={18} className="text-white" fill="white" />
                </div>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5"
                style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onLike(); }} className="transition-transform active:scale-90">
                        <Heart size={12} style={{ fill: state.isLikedByMe ? "#f43f5e" : "none", color: state.isLikedByMe ? "#f43f5e" : "rgba(255,255,255,0.7)", transition: "all 0.15s" }} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onFavorite(); }} className="transition-transform active:scale-90">
                        <Bookmark size={12} style={{ fill: state.isFavoritedByMe ? "#f59e0b" : "none", color: state.isFavoritedByMe ? "#f59e0b" : "rgba(255,255,255,0.7)", transition: "all 0.15s" }} />
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    {dur !== null && (
                        <span className="tabular-nums" style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.65)", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", padding: "1px 5px", borderRadius: 5 }}>
                            {formatDuration(dur)}
                        </span>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadClip(clip, groupId); }}
                        className="flex items-center justify-center rounded-md"
                        title="Baixar" style={{ width: 20, height: 20, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                        <Download size={10} className="text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

type Speed = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;
const SPEEDS: Speed[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function Lightbox({ clips, index, groupId, states, onClose, onPrev, onNext, onLike, onFavorite }:
    { clips: LikedReplayClipDto[]; index: number; groupId: string; states: Record<string, ClipState>;
      onClose: () => void; onPrev: () => void; onNext: () => void;
      onLike: (id: string) => void; onFavorite: (id: string) => void; }) {
    const clip    = clips[index];
    const state   = states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false };
    const videoRef = useRef<HTMLVideoElement>(null);
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

    useEffect(() => { videoRef.current?.play().catch(() => {}); }, [index]);
    useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed]);
    // onLoadedMetadata on the video element handles the actual application per clip
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") onPrev();
            if (e.key === "ArrowRight") onNext();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, onPrev, onNext]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.96)" }}>
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">{clip.eventType === "Gol" ? "⚽ Gol" : "✨ Jogada"}</span>
                    <span className="text-xs text-white/40">{new Date(clip.recordedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-xs text-white/30">{index + 1} / {clips.length}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onLike(clip.id)}
                        className="flex items-center gap-1.5 text-sm font-semibold rounded-xl transition-all active:scale-95"
                        style={{ padding: "5px 12px", background: state.isLikedByMe ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.08)", border: `1px solid ${state.isLikedByMe ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.18)"}`, color: state.isLikedByMe ? "#fda4af" : "rgba(255,255,255,0.6)" }}>
                        <Heart size={14} style={{ fill: state.isLikedByMe ? "#f43f5e" : "none", color: state.isLikedByMe ? "#f43f5e" : "inherit", transition: "all 0.15s" }} />
                        {state.likeCount > 0 ? state.likeCount : "Like"}
                    </button>
                    <button type="button" onClick={() => onFavorite(clip.id)}
                        className="flex items-center gap-1.5 text-sm font-semibold rounded-xl transition-all active:scale-95"
                        style={{ padding: "5px 12px", background: state.isFavoritedByMe ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.08)", border: `1px solid ${state.isFavoritedByMe ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.18)"}`, color: state.isFavoritedByMe ? "#fcd34d" : "rgba(255,255,255,0.6)" }}>
                        <Bookmark size={14} style={{ fill: state.isFavoritedByMe ? "#f59e0b" : "none", color: state.isFavoritedByMe ? "#f59e0b" : "inherit", transition: "all 0.15s" }} />
                        {state.isFavoritedByMe ? "Favoritado" : "Favoritar"}
                    </button>
                    <button type="button" onClick={() => downloadClip(clip, groupId)}
                        className="flex items-center gap-1.5 text-xs font-medium rounded-xl transition-colors"
                        style={{ padding: "5px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.6)" }}>
                        <Download size={13} /> Baixar
                    </button>
                    <button type="button" onClick={onClose} className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors">
                        <X size={16} /><span className="text-xs">ESC</span>
                    </button>
                </div>
            </div>

            {/* Video area */}
            <div className="flex-1 flex items-center justify-center relative min-h-0 px-4 py-4">
                <button type="button" onClick={onPrev} disabled={index === 0}
                    className="absolute left-2 z-10 flex items-center justify-center rounded-full transition-all"
                    style={{ width: 44, height: 44, background: index === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: index === 0 ? "rgba(255,255,255,0.2)" : "#fff" }}>
                    <ChevronLeft size={22} />
                </button>
                <video key={clip.id} ref={videoRef} src={clip.videoUrl} controls autoPlay playsInline
                    onLoadedMetadata={() => { if (videoRef.current) videoRef.current.playbackRate = speed; }}
                    onEnded={index < clips.length - 1 ? onNext : undefined}
                    className="max-h-full max-w-full rounded-xl shadow-2xl" style={{ maxHeight: "calc(100vh - 180px)" }} />
                <button type="button" onClick={onNext} disabled={index === clips.length - 1}
                    className="absolute right-2 z-10 flex items-center justify-center rounded-full transition-all"
                    style={{ width: 44, height: 44, background: index === clips.length - 1 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: index === clips.length - 1 ? "rgba(255,255,255,0.2)" : "#fff" }}>
                    <ChevronRight size={22} />
                </button>
            </div>

            {/* Speed bar */}
            <div className="flex items-center justify-center gap-1 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {SPEEDS.map((s) => (
                    <button key={s} type="button" onClick={() => applySpeed(s)}
                        className="rounded-lg text-xs font-semibold transition-all"
                        style={{ padding: "4px 10px", background: speed === s ? "rgba(255,255,255,0.2)" : "transparent", color: speed === s ? "#fff" : "rgba(255,255,255,0.35)", border: speed === s ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent" }}>
                        {s}x
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SortMode = "likes" | "match";

export default function ReplayLikesPage() {
    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);
    const [clips,    setClips]    = useState<LikedReplayClipDto[]>([]);
    const [loading,  setLoading]  = useState(false);
    const [mode,     setMode]     = useState<SortMode>("match");
    const [lbIdx,    setLbIdx]    = useState<number | null>(null);
    const [states,   setStates]   = useState<Record<string, ClipState>>({});

    async function load() {
        if (!groupId) return;
        setLoading(true);
        try {
            const res  = await MatchesApi.likedReplays(groupId);
            const list = Array.isArray(res.data.data) ? res.data.data : [];
            setClips(list);
            setStates(Object.fromEntries(list.map((c) => [c.id, { likeCount: c.likeCount, isLikedByMe: c.isLikedByMe, isFavoritedByMe: c.isFavoritedByMe }])));
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar vídeos curtidos."));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [groupId]);

    async function toggleLike(clipId: string) {
        if (!groupId) return;
        setStates((p) => {
            const c = p[clipId]; if (!c) return p;
            return { ...p, [clipId]: { ...c, isLikedByMe: !c.isLikedByMe, likeCount: c.isLikedByMe ? c.likeCount - 1 : c.likeCount + 1 } };
        });
        try {
            const r = await MatchesApi.toggleLike(groupId, clipId);
            setStates((p) => ({ ...p, [clipId]: { ...p[clipId], isLikedByMe: r.data.isLiked, likeCount: r.data.likeCount } }));
        } catch {
            setStates((p) => {
                const c = p[clipId]; if (!c) return p;
                return { ...p, [clipId]: { ...c, isLikedByMe: !c.isLikedByMe, likeCount: c.isLikedByMe ? c.likeCount - 1 : c.likeCount + 1 } };
            });
        }
    }

    async function toggleFavorite(clipId: string) {
        if (!groupId) return;
        setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        try {
            const r = await MatchesApi.toggleFavorite(groupId, clipId);
            setStates((p) => ({ ...p, [clipId]: { ...p[clipId], isFavoritedByMe: r.data.isFavorited } }));
        } catch {
            setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        }
    }

    // Sorted flat list (for "by likes" mode)
    const byLikes = [...clips].sort((a, b) => (states[b.id]?.likeCount ?? 0) - (states[a.id]?.likeCount ?? 0));

    // Grouped by matchId (for "by match" mode) — ordered by most total likes per match
    const byMatch = (() => {
        const map = new Map<string, LikedReplayClipDto[]>();
        clips.forEach((c) => {
            const arr = map.get(c.matchId) ?? [];
            arr.push(c); map.set(c.matchId, arr);
        });
        return [...map.entries()]
            .map(([matchId, cs]) => ({
                matchId,
                clips: [...cs].sort((a, b) => (states[b.id]?.likeCount ?? 0) - (states[a.id]?.likeCount ?? 0)),
                totalLikes: cs.reduce((s, c) => s + (states[c.id]?.likeCount ?? 0), 0),
                date: cs[0]?.recordedAt ?? "",
            }))
            .sort((a, b) => b.totalLikes - a.totalLikes);
    })();

    // Flat list used by the lightbox (same order as displayed)
    const flatForLb = mode === "likes" ? byLikes : byMatch.flatMap((g) => g.clips);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="relative rounded-2xl bg-gradient-to-br from-rose-900 via-slate-900 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                            <Film size={26} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black leading-tight">Vídeos Curtidos</h1>
                            <p className="text-sm text-white/50 mt-0.5">
                                {loading
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                                    : !groupId ? "Selecione um grupo"
                                    : `${clips.length} vídeo${clips.length !== 1 ? "s" : ""} com curtida${clips.length !== 1 ? "s" : ""}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Mode toggle */}
                        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
                            <button type="button" onClick={() => setMode("match")}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-colors"
                                style={{ background: mode === "match" ? "rgba(255,255,255,0.18)" : "transparent", color: mode === "match" ? "#fff" : "rgba(255,255,255,0.45)" }}>
                                <LayoutGrid size={13} /> Por partida
                            </button>
                            <button type="button" onClick={() => setMode("likes")}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-colors"
                                style={{ background: mode === "likes" ? "rgba(255,255,255,0.18)" : "transparent", color: mode === "likes" ? "#fff" : "rgba(255,255,255,0.45)" }}>
                                <ListOrdered size={13} /> Por curtidas
                            </button>
                        </div>
                        {groupId && (
                            <button type="button" onClick={load} disabled={loading}
                                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* No group */}
            {!groupId && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Film size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Selecione um grupo no Dashboard.</p>
                </div>
            )}

            {/* Loading */}
            {loading && groupId && (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ aspectRatio: "16/9" }} />
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && groupId && clips.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Heart size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum vídeo curtido ainda</p>
                    <p className="text-xs mt-1 opacity-60">Os vídeos com curtidas aparecerão aqui.</p>
                </div>
            )}

            {/* Content — BY MATCH */}
            {!loading && groupId && clips.length > 0 && mode === "match" && (
                <div className="space-y-6">
                    {byMatch.map((group) => (
                        <div key={group.matchId}>
                            {/* Match header */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e" }}>
                                    <Heart size={11} style={{ fill: "#f43f5e" }} />
                                    {group.totalLikes} curtida{group.totalLikes !== 1 ? "s" : ""} · {group.clips.length} vídeo{group.clips.length !== 1 ? "s" : ""}
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {new Date(group.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                                {group.clips.map((clip) => {
                                    const flatIdx = flatForLb.findIndex((c) => c.id === clip.id);
                                    return (
                                        <VideoCard key={clip.id} clip={clip} groupId={groupId!} state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
                                            onPlay={() => setLbIdx(flatIdx >= 0 ? flatIdx : 0)}
                                            onLike={() => toggleLike(clip.id)}
                                            onFavorite={() => toggleFavorite(clip.id)} />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Content — BY LIKES */}
            {!loading && groupId && clips.length > 0 && mode === "likes" && (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                    {byLikes.map((clip, i) => (
                        <VideoCard key={clip.id} clip={clip} groupId={groupId!} state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
                            onPlay={() => setLbIdx(i)}
                            onLike={() => toggleLike(clip.id)}
                            onFavorite={() => toggleFavorite(clip.id)} />
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lbIdx !== null && groupId && (
                <Lightbox clips={flatForLb} index={lbIdx} groupId={groupId}
                    states={states}
                    onClose={() => setLbIdx(null)}
                    onPrev={() => setLbIdx((i) => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setLbIdx((i) => Math.min(flatForLb.length - 1, (i ?? 0) + 1))}
                    onLike={toggleLike} onFavorite={toggleFavorite} />
            )}
        </div>
    );
}
