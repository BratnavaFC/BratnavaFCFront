import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { ReplayClipDto } from "../matchTypes";
import { MatchesApi } from "../../../api/endpoints";
import { type ClipStateMap, VideoCard, Lightbox } from "./ReplayClipComponents";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
type Filter = "all" | "Gol" | "Jogada";

// ── Clip interaction state ────────────────────────────────────────────────────

function buildInitialState(clips: ReplayClipDto[]): ClipStateMap {
    return Object.fromEntries(clips.map((c) => [c.id, {
        likeCount:       c.likeCount,
        isLikedByMe:     c.isLikedByMe,
        isFavoritedByMe: c.isFavoritedByMe,
    }]));
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                active
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
            ].join(" ")}
        >
            {label}
            <span
                className={[
                    "text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                    active
                        ? "bg-white/20 dark:bg-slate-900/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                ].join(" ")}
            >
                {count}
            </span>
        </button>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────

type Props = { clips: ReplayClipDto[]; groupId: string; isAdmin?: boolean };

export function ReplaySection({ clips, groupId, isAdmin }: Props) {
    const [filter, setFilter]               = useState<Filter>("all");
    const [page, setPage]                   = useState(1);
    const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
    const [clipStates, setClipStates]       = useState<ClipStateMap>(() => buildInitialState(clips));
    const [deletedIds, setDeletedIds]       = useState<Set<string>>(new Set());

    // Sync state when clips prop changes (e.g. refresh)
    useEffect(() => { setClipStates(buildInitialState(clips)); }, [clips]);

    const toggleLike = useCallback(async (clipId: string) => {
        setClipStates((prev) => {
            const cur = prev[clipId];
            if (!cur) return prev;
            return {
                ...prev,
                [clipId]: {
                    ...cur,
                    isLikedByMe: !cur.isLikedByMe,
                    likeCount:   cur.isLikedByMe ? cur.likeCount - 1 : cur.likeCount + 1,
                },
            };
        });
        try {
            const res = await MatchesApi.toggleLike(groupId, clipId);
            setClipStates((prev) => ({
                ...prev,
                [clipId]: { ...prev[clipId], isLikedByMe: res.data.isLiked, likeCount: res.data.likeCount },
            }));
        } catch {
            setClipStates((prev) => {
                const cur = prev[clipId];
                if (!cur) return prev;
                return {
                    ...prev,
                    [clipId]: {
                        ...cur,
                        isLikedByMe: !cur.isLikedByMe,
                        likeCount:   cur.isLikedByMe ? cur.likeCount - 1 : cur.likeCount + 1,
                    },
                };
            });
        }
    }, [groupId]);

    const toggleFavorite = useCallback(async (clipId: string) => {
        setClipStates((prev) => {
            const cur = prev[clipId];
            if (!cur) return prev;
            return { ...prev, [clipId]: { ...cur, isFavoritedByMe: !cur.isFavoritedByMe } };
        });
        try {
            const res = await MatchesApi.toggleFavorite(groupId, clipId);
            setClipStates((prev) => ({
                ...prev,
                [clipId]: { ...prev[clipId], isFavoritedByMe: res.data.isFavorited },
            }));
        } catch {
            setClipStates((prev) => {
                const cur = prev[clipId];
                if (!cur) return prev;
                return { ...prev, [clipId]: { ...cur, isFavoritedByMe: !cur.isFavoritedByMe } };
            });
        }
    }, [groupId]);

    const handleDelete = useCallback(async (clipId: string) => {
        try {
            await MatchesApi.deleteReplay(groupId, clipId);
            setDeletedIds((prev) => new Set([...prev, clipId]));
            setLightboxIdx(null);
            toast.success("Vídeo excluído.");
        } catch {
            toast.error("Falha ao excluir o vídeo.");
        }
    }, [groupId]);

    const visibleClips = useMemo(() => clips.filter((c) => !deletedIds.has(c.id)), [clips, deletedIds]);
    const gols    = useMemo(() => visibleClips.filter((c) => c.eventType === "Gol"),    [visibleClips]);
    const jogadas = useMemo(() => visibleClips.filter((c) => c.eventType === "Jogada"), [visibleClips]);

    const filtered = useMemo(() => {
        if (filter === "Gol")    return gols;
        if (filter === "Jogada") return jogadas;
        return visibleClips;
    }, [filter, visibleClips, gols, jogadas]);

    useEffect(() => { setPage(1); }, [filter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, page]);

    const openLightbox  = useCallback((filteredIdx: number) => { setLightboxIdx(filteredIdx); }, []);
    const closeLightbox = useCallback(() => setLightboxIdx(null), []);
    const prevClip      = useCallback(() => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)), []);
    const nextClip      = useCallback(() => setLightboxIdx((i) => (i !== null && i < filtered.length - 1 ? i + 1 : i)), [filtered.length]);

    if (visibleClips.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Nenhum replay disponível.
            </p>
        );
    }

    return (
        <>
            {/* ── Filter tabs ── */}
            <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl w-fit mb-5">
                <Tab label="Todos"   count={visibleClips.length}    active={filter === "all"}     onClick={() => setFilter("all")} />
                {gols.length    > 0 && <Tab label="Gols"    count={gols.length}    active={filter === "Gol"}    onClick={() => setFilter("Gol")} />}
                {jogadas.length > 0 && <Tab label="Jogadas" count={jogadas.length} active={filter === "Jogada"} onClick={() => setFilter("Jogada")} />}
            </div>

            {/* ── Grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {paged.map((clip, i) => {
                    const globalIdx = (page - 1) * PAGE_SIZE + i;
                    return (
                        <VideoCard
                            key={clip.id}
                            clip={clip}
                            globalIndex={globalIdx}
                            groupId={groupId}
                            state={clipStates[clip.id] ?? { likeCount: 0, isLikedByMe: false, isFavoritedByMe: false }}
                            isAdmin={isAdmin}
                            onPlay={() => openLightbox(globalIdx)}
                            onLike={() => toggleLike(clip.id)}
                            onFavorite={() => toggleFavorite(clip.id)}
                            onDelete={() => handleDelete(clip.id)}
                        />
                    );
                })}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={14} />
                        Anterior
                    </button>

                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                    </span>

                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Próxima
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {/* ── Lightbox ── */}
            {lightboxIdx !== null && (
                <Lightbox
                    clips={filtered}
                    index={lightboxIdx}
                    groupId={groupId}
                    clipStates={clipStates}
                    isAdmin={isAdmin}
                    onClose={closeLightbox}
                    onPrev={prevClip}
                    onNext={nextClip}
                    onLike={toggleLike}
                    onFavorite={toggleFavorite}
                    onDelete={handleDelete}
                />
            )}
        </>
    );
}
