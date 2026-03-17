import { useEffect, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { PlayerInMatchDto, PlayerWeightDto, TeamOptionDto } from "../matchTypes";
import { cls, fmtWeight } from "../matchUtils";
import { useAccountStore } from "../../../auth/accountStore";
import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHex(v: string): string {
    const s = (v ?? "").trim();
    if (!s) return "#e2e8f0";
    return s.startsWith("#") ? s : `#${s}`;
}

function isWhiteHex(hex: string): boolean {
    const h = normalizeHex(hex).replace("#", "").toLowerCase();
    return h === "ffffff" || h === "fff";
}

/** Color-codes the balance diff: green = great, amber = ok, red = unbalanced */
function diffColor(diff: number): string {
    if (diff <= 0.05) return "#16a34a";
    if (diff <= 0.15) return "#d97706";
    return "#dc2626";
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamGenCarousel
// ─────────────────────────────────────────────────────────────────────────────

export function TeamGenCarousel({
    options,
    selectedIndex,
    onSelect,
    adminView,
    byPlayerId,
    teamAHex,
    teamAName,
    teamBHex,
    teamBName,
    onMoveToTeam,
    onSwapInOption,
}: {
    options: TeamOptionDto[];
    selectedIndex: number;
    onSelect: (idx: number) => void;
    adminView: boolean;
    byPlayerId: Map<string, PlayerInMatchDto>;
    teamAHex?: string;
    teamAName?: string;
    teamBHex?: string;
    teamBName?: string;
    onMoveToTeam?: (playerId: string, team: "A" | "B") => void;
    onSwapInOption?: (playerAId: string, playerBId: string) => void;
}) {
    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

    const safeIdx = Math.max(0, Math.min(selectedIndex, options.length - 1));
    const opt = options[safeIdx];

    const aHex = normalizeHex(teamAHex ?? "");
    const bHex = normalizeHex(teamBHex ?? "");
    const aName = teamAName || "Time A";
    const bName = teamBName || "Time B";
    const aHasColor = (teamAHex ?? "").trim().length > 0;
    const bHasColor = (teamBHex ?? "").trim().length > 0;

    // ── Selection state (move / swap) ────────────────────────────────────────
    const [sel1Id, setSel1Id] = useState<string | null>(null);
    const [sel1Team, setSel1Team] = useState<"A" | "B" | null>(null);
    const [sel2Id, setSel2Id] = useState<string | null>(null);

    // Clear selection when navigating between carousel options
    useEffect(() => {
        setSel1Id(null);
        setSel1Team(null);
        setSel2Id(null);
    }, [safeIdx]);

    function handleTeamPlayerClick(playerId: string, team: "A" | "B") {
        if (sel1Id === playerId) { setSel1Id(null); setSel1Team(null); setSel2Id(null); return; }
        if (sel2Id === playerId) { setSel2Id(null); return; }
        if (!sel1Id) { setSel1Id(playerId); setSel1Team(team); return; }
        if (sel1Team === team) { setSel1Id(playerId); setSel2Id(null); return; }
        // Different team → set as second selection
        setSel2Id(playerId);
    }

    function doCarouselSwap() {
        if (!sel1Id || !sel2Id || !onSwapInOption) return;
        onSwapInOption(sel1Id, sel2Id);
        setSel1Id(null); setSel1Team(null); setSel2Id(null);
    }

    function clearSel() { setSel1Id(null); setSel1Team(null); setSel2Id(null); }

    const canMoveToA = !!sel1Id && sel1Team === "B" && !sel2Id && !!onMoveToTeam;
    const canMoveToB = !!sel1Id && sel1Team === "A" && !sel2Id && !!onMoveToTeam;
    const canSwapNow = !!sel1Id && !!sel2Id && !!onSwapInOption;
    const aButtonColor = aHasColor && !isWhiteHex(aHex) ? aHex : "#1d4ed8";
    const bButtonColor = bHasColor && !isWhiteHex(bHex) ? bHex : "#1d4ed8";

    // ── Team renderer ─────────────────────────────────────────────────────────
    const renderTeam = (
        hex: string,
        name: string,
        hasColor: boolean,
        list: PlayerWeightDto[],
        teamKey: "A" | "B"
    ) => {
        const white = isWhiteHex(hex);
        const canInteract = adminView && (!!onMoveToTeam || !!onSwapInOption);
        return (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Team header */}
                <div
                    className="flex items-center justify-between px-3 py-2.5"
                    style={
                        hasColor
                            ? { backgroundColor: hex + "18", borderBottom: `2px solid ${hex}` }
                            : { borderBottom: "2px solid #e2e8f0" }
                    }
                >
                    <div className="flex items-center gap-1.5">
                        {hasColor && (
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                    backgroundColor: hex,
                                    outline: white ? "1px solid #cbd5e1" : "none",
                                    outlineOffset: "1px",
                                }}
                            />
                        )}
                        <span
                            className="text-sm font-semibold"
                            style={{ color: hasColor && !white ? hex : "#0f172a" }}
                        >
                            {name}
                        </span>
                    </div>
                    <span className="text-xs text-slate-400">{list.length}j</span>
                </div>

                {/* Player list */}
                <ul className="divide-y divide-slate-50">
                    {list.map((x) => {
                        const player = byPlayerId.get(x.playerId);
                        const playerName = player?.playerName ?? x.playerId;
                        const isGk = !!player?.isGoalkeeper;
                        const isSel1 = sel1Id === x.playerId;
                        const isSel2 = sel2Id === x.playerId;
                        const isOpposite = canInteract && sel1Id !== null && sel1Team !== teamKey && !isSel1;
                        return (
                            <li
                                key={x.playerId}
                                onClick={canInteract ? () => handleTeamPlayerClick(x.playerId, teamKey) : undefined}
                                className={cls(
                                    "flex items-center gap-2.5 px-3 py-2 transition-colors select-none",
                                    canInteract && "cursor-pointer",
                                    isSel1
                                        ? "bg-amber-50 border-l-[3px] border-amber-400"
                                        : isSel2
                                        ? "bg-emerald-50 border-l-[3px] border-emerald-400"
                                        : isOpposite
                                        ? "hover:bg-emerald-50"
                                        : canInteract
                                        ? "hover:bg-slate-50"
                                        : ""
                                )}
                            >
                                <span
                                    className={cls(
                                        "w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                                        isSel1
                                            ? "bg-amber-400 text-white"
                                            : isSel2
                                            ? "bg-emerald-400 text-white"
                                            : "bg-slate-100 text-slate-500"
                                    )}
                                >
                                    {playerName.charAt(0).toUpperCase()}
                                </span>
                                <span
                                    className={cls(
                                        "truncate flex-1 text-sm font-medium",
                                        isSel1 ? "text-amber-700" : isSel2 ? "text-emerald-700" : "text-slate-900"
                                    )}
                                >
                                    {playerName}
                                    <span title={isGk ? "Goleiro" : "Jogador"} className="ml-1 text-xs">
                                        <IconRenderer value={resolveIcon(_icons, isGk ? 'goalkeeper' : 'player')} size={13} />
                                    </span>
                                </span>
                                {adminView && (
                                    <span className="text-xs font-mono text-slate-400 shrink-0">
                                        {fmtWeight(x.weight)}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                    {list.length === 0 && (
                        <li className="px-3 py-3 text-xs text-slate-400">Nenhum jogador</li>
                    )}
                </ul>
            </div>
        );
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                <div className="font-semibold text-slate-900 text-sm flex-1">Opções geradas</div>

                {/* Pagination controls */}
                <div className="flex items-center gap-1.5">
                    <button
                        disabled={safeIdx <= 0}
                        onClick={() => onSelect(safeIdx - 1)}
                        className={cls(
                            "w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors",
                            safeIdx <= 0 && "opacity-40 pointer-events-none"
                        )}
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <span className="text-xs font-semibold text-slate-700 min-w-[44px] text-center tabular-nums">
                        {safeIdx + 1} / {options.length}
                    </span>
                    <button
                        disabled={safeIdx >= options.length - 1}
                        onClick={() => onSelect(safeIdx + 1)}
                        className={cls(
                            "w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors",
                            safeIdx >= options.length - 1 && "opacity-40 pointer-events-none"
                        )}
                    >
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Dot indicators */}
                <div className="flex items-center justify-center gap-1.5">
                    {options.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => onSelect(i)}
                            title={`Opção ${i + 1}`}
                            className={cls(
                                "rounded-full transition-all duration-200",
                                i === safeIdx
                                    ? "w-5 h-2 bg-slate-800"
                                    : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
                            )}
                        />
                    ))}
                </div>

                {/* Admin balance metrics — compact single row */}
                {adminView && (
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden text-xs divide-x divide-slate-100">
                        <div className="flex-1 px-3 py-2">
                            <div className="text-slate-400 mb-0.5">A weight</div>
                            <div className="font-semibold text-slate-900 tabular-nums">
                                {fmtWeight(opt.teamAWeight)}
                            </div>
                        </div>
                        <div className="flex-1 px-3 py-2">
                            <div className="text-slate-400 mb-0.5">B weight</div>
                            <div className="font-semibold text-slate-900 tabular-nums">
                                {fmtWeight(opt.teamBWeight)}
                            </div>
                        </div>
                        <div className="flex-1 px-3 py-2">
                            <div className="text-slate-400 mb-0.5">Diff</div>
                            <div
                                className="font-semibold tabular-nums"
                                style={{ color: diffColor(opt.balanceDiff) }}
                            >
                                {fmtWeight(opt.balanceDiff)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Admin explanation */}
                {adminView && opt.explanation && (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-1 text-xs text-slate-700">
                        <p><span className="font-semibold text-indigo-700">Resumo: </span>{opt.explanation.resumo}</p>
                        <p><span className="font-semibold text-indigo-700">Time A: </span>{opt.explanation.analiseTimeA}</p>
                        <p><span className="font-semibold text-indigo-700">Time B: </span>{opt.explanation.analiseTimeB}</p>
                        <p><span className="font-semibold text-indigo-700">Conclusão: </span>{opt.explanation.conclusao}</p>
                    </div>
                )}

                {/* 3-button action bar — above team panels */}
                {adminView && (onMoveToTeam || onSwapInOption) && (
                    <div className="flex items-center justify-center gap-2">
                        <button
                            disabled={!canMoveToA}
                            onClick={() => { onMoveToTeam!(sel1Id!, "A"); clearSel(); }}
                            title={`→ ${aName}`}
                            className={cls(
                                "flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-all",
                                canMoveToA
                                    ? "cursor-pointer shadow-sm hover:brightness-110 active:brightness-95"
                                    : "opacity-30 cursor-not-allowed"
                            )}
                            style={{ backgroundColor: aButtonColor, color: "white" }}
                        >
                            {"<< "}{aName}
                        </button>
                        <button
                            disabled={!canSwapNow}
                            onClick={doCarouselSwap}
                            title="Trocar jogadores"
                            className={cls(
                                "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                                canSwapNow
                                    ? "cursor-pointer shadow-sm hover:brightness-110 active:brightness-95 bg-emerald-500 text-white"
                                    : "opacity-30 cursor-not-allowed bg-emerald-500 text-white"
                            )}
                        >
                            <ArrowLeftRight size={14} />
                        </button>
                        <button
                            disabled={!canMoveToB}
                            onClick={() => { onMoveToTeam!(sel1Id!, "B"); clearSel(); }}
                            title={`→ ${bName}`}
                            className={cls(
                                "flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-all",
                                canMoveToB
                                    ? "cursor-pointer shadow-sm hover:brightness-110 active:brightness-95"
                                    : "opacity-30 cursor-not-allowed"
                            )}
                            style={{ backgroundColor: bButtonColor, color: "white" }}
                        >
                            {bName}{" >>"}
                        </button>
                    </div>
                )}

                {/* Team panels */}
                <div className="grid md:grid-cols-2 gap-3">
                    {renderTeam(aHex, aName, aHasColor, opt.teamA, "A")}
                    {renderTeam(bHex, bName, bHasColor, opt.teamB, "B")}
                </div>

                {/* Unassigned players */}
                {(opt.unassigned?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-amber-100">
                            <span className="text-sm font-semibold text-amber-800">
                                Não atribuídos
                            </span>
                            <span className="text-xs text-amber-600">{opt.unassigned.length}j</span>
                        </div>
                        <ul className="divide-y divide-amber-50/60">
                            {opt.unassigned.map((x) => {
                                const player = byPlayerId.get(x.playerId);
                                const playerName = player?.playerName ?? x.playerId;
                                const isGk = !!player?.isGoalkeeper;
                                return (
                                    <li
                                        key={x.playerId}
                                        className="flex items-center gap-2 px-3 py-2"
                                    >
                                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {playerName.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="truncate flex-1 text-sm font-medium text-slate-900">
                                            {playerName}
                                            {isGk && (
                                                <span title="Goleiro" className="ml-1 text-xs">
                                                    🧤
                                                </span>
                                            )}
                                        </span>
                                        {adminView && (
                                            <span className="text-xs font-mono text-amber-600 shrink-0">
                                                {fmtWeight(x.weight)}
                                            </span>
                                        )}
                                        {onMoveToTeam && adminView && (
                                            <>
                                                <button
                                                    onClick={() => onMoveToTeam(x.playerId, "A")}
                                                    title={`Mover para ${aName}`}
                                                    className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border-2 bg-white transition-colors hover:brightness-95"
                                                    style={{
                                                        color:
                                                            aHasColor && !isWhiteHex(aHex)
                                                                ? aHex
                                                                : "#1d4ed8",
                                                        borderColor:
                                                            aHasColor && !isWhiteHex(aHex)
                                                                ? aHex
                                                                : "#3b82f6",
                                                    }}
                                                >
                                                    → A
                                                </button>
                                                <button
                                                    onClick={() => onMoveToTeam(x.playerId, "B")}
                                                    title={`Mover para ${bName}`}
                                                    className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border-2 bg-white transition-colors hover:brightness-95"
                                                    style={{
                                                        color:
                                                            bHasColor && !isWhiteHex(bHex)
                                                                ? bHex
                                                                : "#1d4ed8",
                                                        borderColor:
                                                            bHasColor && !isWhiteHex(bHex)
                                                                ? bHex
                                                                : "#3b82f6",
                                                    }}
                                                >
                                                    → B
                                                </button>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
