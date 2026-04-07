import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Bookmark, Film, Heart,
    LayoutGrid, ListOrdered, Loader2, RefreshCw, Star,
} from "lucide-react";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { getResponseMessage } from "../api/apiResponse";
import type { LikedReplayClipDto } from "../domains/matches/matchTypes";
import { type ClipStateMap, VideoCard, Lightbox } from "../domains/matches/ui/ReplayClipComponents";

// ── Tab: Curtidos (admin = all, user = own likes) ─────────────────────────────

type SortMode = "likes" | "match";

function LikedTab({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
    const [clips,   setClips]   = useState<LikedReplayClipDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode,    setMode]    = useState<SortMode>("match");
    const [lbIdx,   setLbIdx]   = useState<number | null>(null);
    const [states,  setStates]  = useState<ClipStateMap>({});

    async function load() {
        setLoading(true);
        try {
            const res  = isAdmin
                ? await MatchesApi.likedReplays(groupId)
                : await MatchesApi.myLikes(groupId);
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

    const byLikes = [...clips].sort((a, b) => (states[b.id]?.likeCount ?? 0) - (states[a.id]?.likeCount ?? 0));
    const byMatch = (() => {
        const map = new Map<string, LikedReplayClipDto[]>();
        clips.forEach((c) => { const arr = map.get(c.matchId) ?? []; arr.push(c); map.set(c.matchId, arr); });
        return [...map.entries()]
            .map(([matchId, cs]) => ({
                matchId,
                clips: [...cs].sort((a, b) => (states[b.id]?.likeCount ?? 0) - (states[a.id]?.likeCount ?? 0)),
                totalLikes: cs.reduce((s, c) => s + (states[c.id]?.likeCount ?? 0), 0),
                date: cs[0]?.uploadedAt ?? "",
            }))
            .sort((a, b) => b.totalLikes - a.totalLikes);
    })();
    const flatForLb = mode === "likes" ? byLikes : byMatch.flatMap((g) => g.clips);

    return (
        <div className="space-y-5">
            {/* Sub-header controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {loading
                        ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                        : `${clips.length} vídeo${clips.length !== 1 ? "s" : ""} com curtida${clips.length !== 1 ? "s" : ""}`}
                </p>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <button type="button" onClick={() => setMode("match")}
                            {...(mode === "match" ? { className: "flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-colors bg-slate-900 dark:bg-white text-white dark:text-slate-900" } : { className: "flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" })}>
                            <LayoutGrid size={13} /> Por partida
                        </button>
                        <button type="button" onClick={() => setMode("likes")}
                            {...(mode === "likes" ? { className: "flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-colors bg-slate-900 dark:bg-white text-white dark:text-slate-900" } : { className: "flex items-center gap-1.5 text-xs font-medium px-3 py-2 transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" })}>
                            <ListOrdered size={13} /> Por curtidas
                        </button>
                    </div>
                    <button type="button" onClick={load} disabled={loading}
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
                        <div key={group.matchId}>
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {group.clips.map((clip) => {
                                    const flatIdx = flatForLb.findIndex((c) => c.id === clip.id);
                                    return (
                                        <VideoCard key={clip.id} clip={clip} groupId={groupId}
                                            globalIndex={flatIdx >= 0 ? flatIdx : 0}
                                            state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
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

            {/* By likes */}
            {!loading && clips.length > 0 && mode === "likes" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {byLikes.map((clip, i) => (
                        <VideoCard key={clip.id} clip={clip} groupId={groupId}
                            globalIndex={i}
                            state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
                            onPlay={() => setLbIdx(i)}
                            onLike={() => toggleLike(clip.id)}
                            onFavorite={() => toggleFavorite(clip.id)} />
                    ))}
                </div>
            )}

            {lbIdx !== null && (
                <Lightbox clips={flatForLb} index={lbIdx} groupId={groupId}
                    clipStates={states}
                    onClose={() => setLbIdx(null)}
                    onPrev={() => setLbIdx((i) => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setLbIdx((i) => Math.min(flatForLb.length - 1, (i ?? 0) + 1))}
                    onLike={toggleLike} onFavorite={toggleFavorite} />
            )}
        </div>
    );
}

// ── Tab: Favoritos (all users) ─────────────────────────────────────────────────

function FavoritesTab({ groupId }: { groupId: string }) {
    const [clips,   setClips]   = useState<LikedReplayClipDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [lbIdx,   setLbIdx]   = useState<number | null>(null);
    const [states,  setStates]  = useState<ClipStateMap>({});

    async function load() {
        setLoading(true);
        try {
            const res  = await MatchesApi.myFavorites(groupId);
            const list = Array.isArray(res.data.data) ? res.data.data : [];
            setClips(list);
            setStates(Object.fromEntries(list.map((c) => [c.id, { likeCount: c.likeCount, isLikedByMe: c.isLikedByMe, isFavoritedByMe: c.isFavoritedByMe }])));
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar favoritos."));
        } finally {
            setLoading(false);
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

    const byMatch = (() => {
        const map = new Map<string, LikedReplayClipDto[]>();
        clips.forEach((c) => { const arr = map.get(c.matchId) ?? []; arr.push(c); map.set(c.matchId, arr); });
        return [...map.entries()]
            .map(([matchId, cs]) => ({ matchId, clips: cs, date: cs[0]?.uploadedAt ?? "" }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    })();
    const flat = byMatch.flatMap((g) => g.clips);

    return (
        <div className="space-y-5">
            {/* Sub-header controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {loading
                        ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                        : `${clips.length} vídeo${clips.length !== 1 ? "s" : ""} favoritado${clips.length !== 1 ? "s" : ""}`}
                </p>
                <button type="button" onClick={load} disabled={loading}
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
                        <div key={group.matchId}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b" }}>
                                    <Bookmark size={11} style={{ fill: "#f59e0b" }} />
                                    {group.clips.length} favorito{group.clips.length !== 1 ? "s" : ""}
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {new Date(group.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                                {group.clips.map((clip) => {
                                    const flatIdx = flat.findIndex((c) => c.id === clip.id);
                                    return (
                                        <VideoCard key={clip.id} clip={clip} groupId={groupId}
                                            globalIndex={flatIdx >= 0 ? flatIdx : 0}
                                            state={states[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: true }}
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

            {lbIdx !== null && (
                <Lightbox clips={flat} index={lbIdx} groupId={groupId}
                    clipStates={states}
                    onClose={() => setLbIdx(null)}
                    onPrev={() => setLbIdx((i) => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setLbIdx((i) => Math.min(flat.length - 1, (i ?? 0) + 1))}
                    onLike={toggleLike} onFavorite={toggleFavorite} />
            )}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type TabId = "liked" | "favorites";

export default function ReplayVaultPage() {
    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);
    const roles   = useAccountStore((s) => s.accounts.find((a) => a.userId === s.activeAccountId)?.roles ?? []);
    const isAdminOrGod = roles.includes("Admin") || roles.includes("GodMode");

    const [tab, setTab] = useState<TabId>("liked");

    return (
        <div className="space-y-5">
            {/* Header banner */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                <div className="relative flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                        <Film size={26} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black leading-tight">Replays</h1>
                        <p className="text-sm text-white/50 mt-0.5">
                            {!groupId ? "Selecione um grupo" : "Vídeos curtidos e favoritados"}
                        </p>
                    </div>
                </div>
            </div>

            {/* No group selected */}
            {!groupId && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Film size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Selecione um grupo no Dashboard.</p>
                </div>
            )}

            {groupId && !isAdminOrGod && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
                    <Film size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Acesso restrito</p>
                    <p className="text-xs mt-1 opacity-60">Esta seção está disponível apenas para administradores.</p>
                </div>
            )}

            {groupId && isAdminOrGod && (
                <>
                    {/* Tab bar */}
                    <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setTab("liked")}
                            className={[
                                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px",
                                tab === "liked"
                                    ? "border-rose-500 text-rose-500"
                                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                            ].join(" ")}
                        >
                            <Heart size={15} style={{ fill: tab === "liked" ? "#f43f5e" : "none", color: tab === "liked" ? "#f43f5e" : "currentColor" }} />
                            {isAdminOrGod ? "Curtidos" : "Meus Curtidos"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab("favorites")}
                            className={[
                                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px",
                                tab === "favorites"
                                    ? "border-amber-500 text-amber-500"
                                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                            ].join(" ")}
                        >
                            <Star size={15} style={{ fill: tab === "favorites" ? "#f59e0b" : "none", color: tab === "favorites" ? "#f59e0b" : "currentColor" }} />
                            Meus Favoritos
                        </button>
                    </div>

                    {/* Tab content */}
                    {tab === "liked" && <LikedTab groupId={groupId} isAdmin={isAdminOrGod} />}
                    {tab === "favorites" && <FavoritesTab groupId={groupId} />}
                </>
            )}
        </div>
    );
}
