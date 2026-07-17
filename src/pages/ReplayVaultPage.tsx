import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
    Bookmark, ChevronDown, Film, Heart,
    LayoutGrid, ListOrdered, Loader2, RefreshCw, Star, Gamepad2,
} from "lucide-react";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { getResponseMessage } from "../api/apiResponse";
import type { PagedResult } from "../api/paged";
import LoadMoreButton from "../components/LoadMoreButton";
import type { LikedReplayClipDto } from "../domains/matches/matchTypes";
import { type ClipStateMap, type LikersData, VideoCard, Lightbox, LikersPopover } from "../domains/matches/ui/ReplayClipComponents";
import { toUtcDate } from "../utils/dateUtils";
import { teamButtonStyle, teamLabel } from "../utils/teamColorUtils";

const PAGE_SIZE = 20;

/** Conjunto de partidas expandidas (todas recolhidas por padrão). */
function useExpandedSet() {
    const [set, setSet] = useState<Set<string>>(new Set());
    const toggle = (id: string) => setSet((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    return [set, toggle] as const;
}

/** Cabeçalho de partida clicável (recolhe/expande) + conteúdo colapsável. */
function MatchSection({ header, expanded, onToggle, children }: {
    header: ReactNode;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div>
            <button type="button" onClick={onToggle}
                className="w-full flex items-center gap-3 mb-3 focus:outline-none">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                {header}
                <ChevronDown size={15}
                    className={`text-slate-400 dark:text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </button>
            {expanded && children}
        </div>
    );
}

// ── Tab: Curtidos (admin = all, user = own likes) ─────────────────────────────

type SortMode = "likes" | "match";

function LikedTab({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
    const [clips,       setClips]       = useState<LikedReplayClipDto[]>([]);
    const [total,       setTotal]       = useState(0);
    const [page,        setPage]        = useState(1);
    const [loading,     setLoading]     = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [mode,        setMode]        = useState<SortMode>("match");
    const [lbIdx,       setLbIdx]       = useState<number | null>(null);
    const [states,      setStates]      = useState<ClipStateMap>({});
    const [likersPanel, setLikersPanel] = useState<{ clipId: string; rect: DOMRect } | null>(null);
    const [likersCache, setLikersCache] = useState<Record<string, LikersData>>({});

    async function load(pageNum = 1, append = false) {
        append ? setLoadingMore(true) : setLoading(true);
        try {
            const res  = isAdmin
                ? await MatchesApi.likedReplays(groupId, pageNum, PAGE_SIZE)
                : await MatchesApi.myLikes(groupId, pageNum, PAGE_SIZE);
            const paged = res.data.data as unknown as PagedResult<LikedReplayClipDto>;
            const list  = paged?.items ?? [];
            setTotal(paged?.total ?? list.length);
            setPage(pageNum);
            setClips(prev => append ? [...prev, ...list] : list);
            const newStates = Object.fromEntries(list.map((c) => [c.id, { likeCount: c.likeCount, isLikedByMe: c.isLikedByMe, isFavoritedByMe: c.isFavoritedByMe }]));
            setStates(prev => append ? { ...prev, ...newStates } : newStates);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar vídeos curtidos."));
        } finally {
            append ? setLoadingMore(false) : setLoading(false);
        }
    }

    useEffect(() => { load(); }, [groupId]);

    async function toggleLike(clipId: string) {
        setStates((p) => {
            const c = p[clipId]; if (!c) return p;
            return { ...p, [clipId]: { ...c, isLikedByMe: !c.isLikedByMe, likeCount: c.isLikedByMe ? c.likeCount - 1 : c.likeCount + 1 } };
        });
        try {
            const r = await MatchesApi.toggleLike(groupId, clipId);
            setStates((p) => ({ ...p, [clipId]: { ...p[clipId], isLikedByMe: r.data.isLiked, likeCount: r.data.likeCount } }));
            if (!r.data.isLiked) setClips((prev) => prev.filter((c) => c.id !== clipId));
        } catch {
            setStates((p) => {
                const c = p[clipId]; if (!c) return p;
                return { ...p, [clipId]: { ...c, isLikedByMe: !c.isLikedByMe, likeCount: c.isLikedByMe ? c.likeCount - 1 : c.likeCount + 1 } };
            });
        }
    }

    async function toggleFavorite(clipId: string) {
        setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        try {
            const r = await MatchesApi.toggleFavorite(groupId, clipId);
            setStates((p) => ({ ...p, [clipId]: { ...p[clipId], isFavoritedByMe: r.data.isFavorited } }));
        } catch {
            setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        }
    }

    async function handleDelete(clipId: string) {
        try {
            await MatchesApi.deleteReplay(groupId, clipId);
            setClips((prev) => prev.filter((c) => c.id !== clipId));
            setLbIdx(null);
            toast.success("Vídeo excluído.");
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao excluir o vídeo."));
        }
    }

    async function openLikers(clipId: string, rect: DOMRect) {
        setLikersPanel({ clipId, rect });
        if (likersCache[clipId] !== undefined) return;
        setLikersCache((p) => ({ ...p, [clipId]: "loading" }));
        try {
            const r    = await MatchesApi.clipLikers(groupId, clipId);
            const list = Array.isArray(r.data.data) ? r.data.data : [];
            setLikersCache((p) => ({ ...p, [clipId]: list }));
        } catch {
            setLikersCache((p) => ({ ...p, [clipId]: [] }));
        }
    }

    const [expanded, toggleMatch] = useExpandedSet();

    const byLikes = [...clips].sort((a, b) => (states[b.id]?.likeCount ?? 0) - (states[a.id]?.likeCount ?? 0));
    const byMatch = (() => {
        const map = new Map<string, LikedReplayClipDto[]>();
        clips.forEach((c) => { const arr = map.get(c.matchId) ?? []; arr.push(c); map.set(c.matchId, arr); });
        return [...map.entries()]
            .map(([matchId, cs]) => ({
                matchId,
                clips: [...cs].sort((a, b) => (states[b.id]?.likeCount ?? 0) - (states[a.id]?.likeCount ?? 0)),
                totalLikes: cs.reduce((s, c) => s + (states[c.id]?.likeCount ?? 0), 0),
                date: cs[0]?.recordedAt ?? "",
            }))
            // Mais recentes primeiro
            .sort((a, b) => toUtcDate(b.date).getTime() - toUtcDate(a.date).getTime());
    })();
    const flatForLb = mode === "likes" ? byLikes : byMatch.flatMap((g) => g.clips);

    return (
        <div className="space-y-5">
            {/* Sub-header controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {loading
                        ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                        : `${clips.length} de ${total} vídeo${total !== 1 ? "s" : ""} com curtida${total !== 1 ? "s" : ""}`}
                </p>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        <button type="button" onClick={() => setMode("match")}
                            className={["flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition border",
                                mode === "match" ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800/50"
                            ].join(" ")}>
                            <LayoutGrid size={13} /> Por partida
                        </button>
                        <button type="button" onClick={() => setMode("likes")}
                            className={["flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition border",
                                mode === "likes" ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800/50"
                            ].join(" ")}>
                            <ListOrdered size={13} /> Por curtidas
                        </button>
                    </div>
                    <button type="button" onClick={() => load()} disabled={loading}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
                    </button>
                </div>
            </div>

            {/* Loading skeleton */}
            {loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ aspectRatio: "16/9" }} />
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && clips.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Heart size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum vídeo curtido ainda</p>
                    <p className="text-xs mt-1 opacity-60">Os vídeos com curtidas aparecerão aqui.</p>
                </div>
            )}

            {/* By match */}
            {!loading && clips.length > 0 && mode === "match" && (
                <div className="space-y-6">
                    {byMatch.map((group) => (
                        <MatchSection key={group.matchId}
                            expanded={expanded.has(group.matchId)}
                            onToggle={() => toggleMatch(group.matchId)}
                            header={<>
                                <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e" }}>
                                    <Heart size={11} style={{ fill: "#f43f5e" }} />
                                    {group.totalLikes} curtida{group.totalLikes !== 1 ? "s" : ""} · {group.clips.length} vídeo{group.clips.length !== 1 ? "s" : ""}
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {toUtcDate(group.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                            </>}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {group.clips.map((clip) => {
                                    const flatIdx = flatForLb.findIndex((c) => c.id === clip.id);
                                    return (
                                        <VideoCard key={clip.id} clip={clip} groupId={groupId}
                                            globalIndex={flatIdx >= 0 ? flatIdx : 0}
                                            state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
                                            isAdmin={isAdmin}
                                            onPlay={() => setLbIdx(flatIdx >= 0 ? flatIdx : 0)}
                                            onLike={() => toggleLike(clip.id)}
                                            onFavorite={() => toggleFavorite(clip.id)}
                                            onDelete={() => handleDelete(clip.id)}
                                            onShowLikers={(rect) => openLikers(clip.id, rect)} />
                                    );
                                })}
                            </div>
                        </MatchSection>
                    ))}
                </div>
            )}

            {/* By likes */}
            {!loading && clips.length > 0 && mode === "likes" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {byLikes.map((clip, i) => (
                        <VideoCard key={clip.id} clip={clip} groupId={groupId}
                            globalIndex={i}
                            state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
                            isAdmin={isAdmin}
                            onPlay={() => setLbIdx(i)}
                            onLike={() => toggleLike(clip.id)}
                            onFavorite={() => toggleFavorite(clip.id)}
                            onDelete={() => handleDelete(clip.id)}
                            onShowLikers={(rect) => openLikers(clip.id, rect)} />
                    ))}
                </div>
            )}

            {!loading && (
                <LoadMoreButton loaded={clips.length} total={total} loading={loadingMore}
                    onClick={() => load(page + 1, true)} />
            )}

            {lbIdx !== null && (
                <Lightbox clips={flatForLb} index={lbIdx} groupId={groupId}
                    clipStates={states}
                    isAdmin={isAdmin}
                    onClose={() => setLbIdx(null)}
                    onPrev={() => setLbIdx((i) => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setLbIdx((i) => Math.min(flatForLb.length - 1, (i ?? 0) + 1))}
                    onLike={toggleLike} onFavorite={toggleFavorite} onDelete={handleDelete}
                    onShowLikers={(clipId, rect) => openLikers(clipId, rect)} />
            )}

            {likersPanel && (
                <LikersPopover
                    anchorRect={likersPanel.rect}
                    data={likersCache[likersPanel.clipId]}
                    onClose={() => setLikersPanel(null)}
                />
            )}
        </div>
    );
}

// ── Tab: Favoritos (all users) ─────────────────────────────────────────────────

function FavoritesTab({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
    const [clips,       setClips]       = useState<LikedReplayClipDto[]>([]);
    const [total,       setTotal]       = useState(0);
    const [page,        setPage]        = useState(1);
    const [loading,     setLoading]     = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lbIdx,       setLbIdx]       = useState<number | null>(null);
    const [states,      setStates]      = useState<ClipStateMap>({});
    const [likersPanel, setLikersPanel] = useState<{ clipId: string; rect: DOMRect } | null>(null);
    const [likersCache, setLikersCache] = useState<Record<string, LikersData>>({});

    async function load(pageNum = 1, append = false) {
        append ? setLoadingMore(true) : setLoading(true);
        try {
            const res   = await MatchesApi.myFavorites(groupId, pageNum, PAGE_SIZE);
            const paged = res.data.data as unknown as PagedResult<LikedReplayClipDto>;
            const list  = paged?.items ?? [];
            setTotal(paged?.total ?? list.length);
            setPage(pageNum);
            setClips(prev => append ? [...prev, ...list] : list);
            const newStates = Object.fromEntries(list.map((c) => [c.id, { likeCount: c.likeCount, isLikedByMe: c.isLikedByMe, isFavoritedByMe: c.isFavoritedByMe }]));
            setStates(prev => append ? { ...prev, ...newStates } : newStates);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar favoritos."));
        } finally {
            append ? setLoadingMore(false) : setLoading(false);
        }
    }

    useEffect(() => { load(); }, [groupId]);

    async function toggleLike(clipId: string) {
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
        setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        try {
            const r = await MatchesApi.toggleFavorite(groupId, clipId);
            setStates((p) => ({ ...p, [clipId]: { ...p[clipId], isFavoritedByMe: r.data.isFavorited } }));
            if (!r.data.isFavorited) {
                setClips((prev) => prev.filter((c) => c.id !== clipId));
            }
        } catch {
            setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        }
    }

    async function handleDelete(clipId: string) {
        try {
            await MatchesApi.deleteReplay(groupId, clipId);
            setClips((prev) => prev.filter((c) => c.id !== clipId));
            setLbIdx(null);
            toast.success("Vídeo excluído.");
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao excluir o vídeo."));
        }
    }

    async function openLikers(clipId: string, rect: DOMRect) {
        setLikersPanel({ clipId, rect });
        if (likersCache[clipId] !== undefined) return;
        setLikersCache((p) => ({ ...p, [clipId]: "loading" }));
        try {
            const r    = await MatchesApi.clipLikers(groupId, clipId);
            const list = Array.isArray(r.data.data) ? r.data.data : [];
            setLikersCache((p) => ({ ...p, [clipId]: list }));
        } catch {
            setLikersCache((p) => ({ ...p, [clipId]: [] }));
        }
    }

    const [expanded, toggleMatch] = useExpandedSet();
    const byMatch = (() => {
        const map = new Map<string, LikedReplayClipDto[]>();
        clips.forEach((c) => { const arr = map.get(c.matchId) ?? []; arr.push(c); map.set(c.matchId, arr); });
        return [...map.entries()]
            .map(([matchId, cs]) => ({ matchId, clips: cs, date: cs[0]?.recordedAt ?? "" }))
            .sort((a, b) => toUtcDate(b.date).getTime() - toUtcDate(a.date).getTime());
    })();
    const flat = byMatch.flatMap((g) => g.clips);

    return (
        <div className="space-y-5">
            {/* Sub-header controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {loading
                        ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                        : `${clips.length} de ${total} vídeo${total !== 1 ? "s" : ""} favoritado${total !== 1 ? "s" : ""}`}
                </p>
                <button type="button" onClick={() => load()} disabled={loading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
                </button>
            </div>

            {/* Loading skeleton */}
            {loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ aspectRatio: "16/9" }} />
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && clips.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Bookmark size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum vídeo favoritado</p>
                    <p className="text-xs mt-1 opacity-60">Favorite vídeos nos detalhes da partida para encontrá-los aqui.</p>
                </div>
            )}

            {!loading && clips.length > 0 && (
                <div className="space-y-6">
                    {byMatch.map((group) => (
                        <MatchSection key={group.matchId}
                            expanded={expanded.has(group.matchId)}
                            onToggle={() => toggleMatch(group.matchId)}
                            header={<>
                                <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b" }}>
                                    <Bookmark size={11} style={{ fill: "#f59e0b" }} />
                                    {group.clips.length} favorito{group.clips.length !== 1 ? "s" : ""}
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {toUtcDate(group.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                            </>}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {group.clips.map((clip) => {
                                    const flatIdx = flat.findIndex((c) => c.id === clip.id);
                                    return (
                                        <VideoCard key={clip.id} clip={clip} groupId={groupId}
                                            globalIndex={flatIdx >= 0 ? flatIdx : 0}
                                            state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: true }}
                                            isAdmin={isAdmin}
                                            onPlay={() => setLbIdx(flatIdx >= 0 ? flatIdx : 0)}
                                            onLike={() => toggleLike(clip.id)}
                                            onFavorite={() => toggleFavorite(clip.id)}
                                            onDelete={() => handleDelete(clip.id)}
                                            onShowLikers={(rect) => openLikers(clip.id, rect)} />
                                    );
                                })}
                            </div>
                        </MatchSection>
                    ))}
                </div>
            )}

            {!loading && (
                <LoadMoreButton loaded={clips.length} total={total} loading={loadingMore}
                    onClick={() => load(page + 1, true)} />
            )}

            {lbIdx !== null && (
                <Lightbox clips={flat} index={lbIdx} groupId={groupId}
                    clipStates={states}
                    isAdmin={isAdmin}
                    onClose={() => setLbIdx(null)}
                    onPrev={() => setLbIdx((i) => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setLbIdx((i) => Math.min(flat.length - 1, (i ?? 0) + 1))}
                    onLike={toggleLike} onFavorite={toggleFavorite} onDelete={handleDelete}
                    onShowLikers={(clipId, rect) => openLikers(clipId, rect)} />
            )}

            {likersPanel && (
                <LikersPopover
                    anchorRect={likersPanel.rect}
                    data={likersCache[likersPanel.clipId]}
                    onClose={() => setLikersPanel(null)}
                />
            )}
        </div>
    );
}

// ── Tab: Jogos (admin only) ────────────────────────────────────────────────────

type EventFilter = "all" | "Gol" | "GolTimeA" | "GolTimeB" | "Jogada";

function isGoalReplay(type: string) {
    return type === "Gol" || type === "GolTimeA" || type === "GolTimeB";
}

function isPlayReplay(type: string) {
    return type === "Jogada";
}

function MatchesTab({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
    const [clips,       setClips]       = useState<LikedReplayClipDto[]>([]);
    const [total,       setTotal]       = useState(0);
    const [page,        setPage]        = useState(1);
    const [loading,     setLoading]     = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lbIdx,       setLbIdx]       = useState<number | null>(null);
    const [states,      setStates]      = useState<ClipStateMap>({});
    const [filter,      setFilter]      = useState<EventFilter>("all");
    const [likersPanel, setLikersPanel] = useState<{ clipId: string; rect: DOMRect } | null>(null);
    const [likersCache, setLikersCache] = useState<Record<string, LikersData>>({});

    async function load(pageNum = 1, append = false) {
        append ? setLoadingMore(true) : setLoading(true);
        try {
            const res   = await MatchesApi.allReplays(groupId, pageNum, PAGE_SIZE);
            const paged = res.data.data as unknown as PagedResult<LikedReplayClipDto>;
            const list  = paged?.items ?? [];
            setTotal(paged?.total ?? list.length);
            setPage(pageNum);
            setClips(prev => append ? [...prev, ...list] : list);
            const newStates = Object.fromEntries(list.map((c) => [c.id, { likeCount: c.likeCount, isLikedByMe: c.isLikedByMe, isFavoritedByMe: c.isFavoritedByMe }]));
            setStates(prev => append ? { ...prev, ...newStates } : newStates);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar vídeos."));
        } finally {
            append ? setLoadingMore(false) : setLoading(false);
        }
    }

    useEffect(() => { load(); }, [groupId]);

    async function toggleLike(clipId: string) {
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
        setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        try {
            const r = await MatchesApi.toggleFavorite(groupId, clipId);
            setStates((p) => ({ ...p, [clipId]: { ...p[clipId], isFavoritedByMe: r.data.isFavorited } }));
        } catch {
            setStates((p) => { const c = p[clipId]; if (!c) return p; return { ...p, [clipId]: { ...c, isFavoritedByMe: !c.isFavoritedByMe } }; });
        }
    }

    async function handleDelete(clipId: string) {
        try {
            await MatchesApi.deleteReplay(groupId, clipId);
            setClips((prev) => prev.filter((c) => c.id !== clipId));
            setLbIdx(null);
            toast.success("Vídeo excluído.");
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao excluir o vídeo."));
        }
    }

    async function openLikers(clipId: string, rect: DOMRect) {
        setLikersPanel({ clipId, rect });
        if (likersCache[clipId] !== undefined) return;
        setLikersCache((p) => ({ ...p, [clipId]: "loading" }));
        try {
            const r    = await MatchesApi.clipLikers(groupId, clipId);
            const list = Array.isArray(r.data.data) ? r.data.data : [];
            setLikersCache((p) => ({ ...p, [clipId]: list }));
        } catch {
            setLikersCache((p) => ({ ...p, [clipId]: [] }));
        }
    }

    const filtered = filter === "all"
        ? clips
        : filter === "Gol"
            ? clips.filter((c) => isGoalReplay(c.eventType))
            : filter === "Jogada"
                ? clips.filter((c) => isPlayReplay(c.eventType))
                : clips.filter((c) => c.eventType === filter);
    const hasSplitGoals = clips.some((c) => c.eventType === "GolTimeA" || c.eventType === "GolTimeB");
    const teamASample = clips.find((c) => c.eventType === "GolTimeA" && (c.teamAColorName || c.teamAColorHex));
    const teamBSample = clips.find((c) => c.eventType === "GolTimeB" && (c.teamBColorName || c.teamBColorHex));
    const teamAFilterName = teamLabel("A", { name: teamASample?.teamAColorName, hex: teamASample?.teamAColorHex });
    const teamBFilterName = teamLabel("B", { name: teamBSample?.teamBColorName, hex: teamBSample?.teamBColorHex });
    const eventFilters: EventFilter[] = hasSplitGoals
        ? ["all", "Jogada", "Gol", "GolTimeA", "GolTimeB"]
        : ["all", "Jogada", "Gol"];

    const [expanded, toggleMatch] = useExpandedSet();
    const byMatch = (() => {
        const map = new Map<string, LikedReplayClipDto[]>();
        filtered.forEach((c) => { const arr = map.get(c.matchId) ?? []; arr.push(c); map.set(c.matchId, arr); });
        return [...map.entries()]
            .map(([matchId, cs]) => ({
                matchId,
                clips: cs,
                date: cs[0]?.recordedAt ?? "",
                goalCount: cs.filter((c) => isGoalReplay(c.eventType)).length,
                goalACount: cs.filter((c) => c.eventType === "GolTimeA").length,
                goalBCount: cs.filter((c) => c.eventType === "GolTimeB").length,
                playCount: cs.filter((c) => isPlayReplay(c.eventType)).length,
                teamAName: teamLabel("A", { name: cs[0]?.teamAColorName, hex: cs[0]?.teamAColorHex }),
                teamAHex: cs[0]?.teamAColorHex,
                teamBName: teamLabel("B", { name: cs[0]?.teamBColorName, hex: cs[0]?.teamBColorHex }),
                teamBHex: cs[0]?.teamBColorHex,
            }))
            .sort((a, b) => toUtcDate(b.date).getTime() - toUtcDate(a.date).getTime());
    })();

    const flat = byMatch.flatMap((g) => g.clips);

    return (
        <div className="space-y-5">
            {/* Sub-header controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {loading
                        ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                        : `${filtered.length} vídeo${filtered.length !== 1 ? "s" : ""} em ${byMatch.length} partida${byMatch.length !== 1 ? "s" : ""}`}
                </p>
                <div className="flex items-center gap-2">
                    {/* Event filter */}
                    <div className="flex gap-1">
                        {eventFilters.map((f) => (
                            <button key={f} type="button" onClick={() => setFilter(f)}
                                className={[
                                    "px-4 py-1.5 rounded-lg text-xs font-semibold transition border",
                                    filter === f
                                        ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800/50",
                                ].join(" ")}
                                style={filter === f && f === "GolTimeA" ? teamButtonStyle(teamASample?.teamAColorHex)
                                    : filter === f && f === "GolTimeB" ? teamButtonStyle(teamBSample?.teamBColorHex)
                                    : undefined}>
                                {f === "all" ? "Tudo"
                                    : f === "Jogada" ? "✨ Jogadas"
                                    : f === "Gol" ? "⚽ Todos os gols"
                                    : f === "GolTimeA" ? `⚽ ${teamAFilterName}`
                                    : `⚽ ${teamBFilterName}`}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => load()} disabled={loading}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
                    </button>
                </div>
            </div>

            {/* Loading skeleton */}
            {loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ aspectRatio: "16/9" }} />
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && clips.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Gamepad2 size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum replay enviado ainda</p>
                    <p className="text-xs mt-1 opacity-60">Os vídeos aparecerão aqui após serem enviados nas partidas.</p>
                </div>
            )}

            {!loading && filtered.length === 0 && clips.length > 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400">
                    <p className="text-sm">Nenhum vídeo do tipo selecionado.</p>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="space-y-6">
                    {byMatch.map((group) => (
                        <MatchSection key={group.matchId}
                            expanded={expanded.has(group.matchId)}
                            onToggle={() => toggleMatch(group.matchId)}
                            header={<>
                                <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1" }}>
                                    <Gamepad2 size={11} />
                                    {group.goalCount > 0 && <span>⚽ {group.goalCount}</span>}
                                    {group.goalACount > 0 && <span>{group.teamAName} {group.goalACount}</span>}
                                    {group.goalBCount > 0 && <span>{group.teamBName} {group.goalBCount}</span>}
                                    {group.playCount > 0 && <span>✨ {group.playCount}</span>}
                                    · {group.clips.length} vídeo{group.clips.length !== 1 ? "s" : ""}
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {toUtcDate(group.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                            </>}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {group.clips.map((clip) => {
                                    const flatIdx = flat.findIndex((c) => c.id === clip.id);
                                    return (
                                        <VideoCard key={clip.id} clip={clip} groupId={groupId}
                                            globalIndex={flatIdx >= 0 ? flatIdx : 0}
                                            state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
                                            isAdmin={isAdmin}
                                            onPlay={() => setLbIdx(flatIdx >= 0 ? flatIdx : 0)}
                                            onLike={() => toggleLike(clip.id)}
                                            onFavorite={() => toggleFavorite(clip.id)}
                                            onDelete={() => handleDelete(clip.id)}
                                            onShowLikers={(rect) => openLikers(clip.id, rect)} />
                                    );
                                })}
                            </div>
                        </MatchSection>
                    ))}
                </div>
            )}

            {!loading && (
                <LoadMoreButton loaded={clips.length} total={total} loading={loadingMore}
                    onClick={() => load(page + 1, true)} />
            )}

            {lbIdx !== null && (
                <Lightbox clips={flat} index={lbIdx} groupId={groupId}
                    clipStates={states}
                    isAdmin={isAdmin}
                    onClose={() => setLbIdx(null)}
                    onPrev={() => setLbIdx((i) => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setLbIdx((i) => Math.min(flat.length - 1, (i ?? 0) + 1))}
                    onLike={toggleLike} onFavorite={toggleFavorite} onDelete={handleDelete}
                    onShowLikers={(clipId, rect) => openLikers(clipId, rect)} />
            )}

            {likersPanel && (
                <LikersPopover
                    anchorRect={likersPanel.rect}
                    data={likersCache[likersPanel.clipId]}
                    onClose={() => setLikersPanel(null)}
                />
            )}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type TabId = "liked" | "favorites" | "matches";

export default function ReplayVaultPage() {
    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);
    const roles   = useAccountStore((s) => s.accounts.find((a) => a.userId === s.activeAccountId)?.roles ?? []);
    const isAdminOrGod = roles.includes("Admin") || roles.includes("GodMode");

    const [tab, setTab] = useState<TabId>("liked");

    return (
        <div className="space-y-5">
            {/* Header banner */}
            <div className="page-header">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                <div className="relative flex items-center gap-3">
                    <div className="page-header-icon">
                        <Film size={18} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black leading-tight">Replays</h1>
                        <p className="text-xs text-white/60 mt-0.5">
                            {!groupId ? "Selecione um grupo" : "Vídeos curtidos e favoritados"}
                        </p>
                    </div>
                </div>
                {groupId && (
                    <div className="relative mt-4 flex gap-1 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setTab("liked")}
                            className={[
                                "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition border",
                                tab === "liked"
                                    ? "bg-white text-slate-900 border-white"
                                    : "bg-transparent text-white/70 border-white/30 hover:bg-white/10",
                            ].join(" ")}
                        >
                            <Heart size={15} />
                            {isAdminOrGod ? "Curtidos" : "Meus Curtidos"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab("favorites")}
                            className={[
                                "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition border",
                                tab === "favorites"
                                    ? "bg-white text-slate-900 border-white"
                                    : "bg-transparent text-white/70 border-white/30 hover:bg-white/10",
                            ].join(" ")}
                        >
                            <Star size={15} />
                            Meus Favoritos
                        </button>
                        {isAdminOrGod && (
                            <button
                                type="button"
                                onClick={() => setTab("matches")}
                                className={[
                                    "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition border",
                                    tab === "matches"
                                        ? "bg-white text-slate-900 border-white"
                                        : "bg-transparent text-white/70 border-white/30 hover:bg-white/10",
                                ].join(" ")}
                            >
                                <Gamepad2 size={15} />
                                Jogos
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* No group selected */}
            {!groupId && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Film size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Selecione um grupo no Dashboard.</p>
                </div>
            )}

            {groupId && (
                <>
                    {/* Tab content */}
                    {tab === "liked" && <LikedTab groupId={groupId} isAdmin={isAdminOrGod} />}
                    {tab === "favorites" && <FavoritesTab groupId={groupId} isAdmin={isAdminOrGod} />}
                    {tab === "matches" && isAdminOrGod && <MatchesTab groupId={groupId} isAdmin={isAdminOrGod} />}
                </>
            )}
        </div>
    );
}
