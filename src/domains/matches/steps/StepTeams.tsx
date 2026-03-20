import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Play, RefreshCw, Shuffle } from "lucide-react";
import { useAccountStore } from "../../../auth/accountStore";
import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";
import type {
    ColorMode,
    PlayerInMatchDto,
    StrategyId,
    TeamColorDto,
    TeamOptionDto,
} from "../matchTypes";
import { InviteResponse, STRATEGIES } from "../matchTypes";
import { cls } from "../matchUtils";
import { TeamGenCarousel } from "../ui/TeamGenCarousel";

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

// ─────────────────────────────────────────────────────────────────────────────
// ColorSwatchPicker — visual swatch grid replacing plain <select>
// ─────────────────────────────────────────────────────────────────────────────

function ColorSwatchPicker({
    colors,
    selectedId,
    disabledId,
    readOnly,
    onSelect,
}: {
    colors: TeamColorDto[];
    selectedId: string;
    disabledId?: string;
    readOnly: boolean;
    onSelect: (id: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
                const hex = normalizeHex(c.hexValue);
                const isSelected = selectedId === c.id;
                const isOther = disabledId === c.id;
                const isDisabled = readOnly || (isOther && !isSelected);
                const white = isWhiteHex(hex);

                return (
                    <button
                        key={c.id}
                        title={c.name}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => onSelect(c.id)}
                        className={cls(
                            "relative w-9 h-9 rounded-full border-2 transition-all duration-150",
                            isSelected
                                ? "scale-110 shadow-md ring-2 ring-offset-2 ring-slate-700 border-slate-700"
                                : white
                                ? "border-slate-300"
                                : "border-transparent",
                            !isDisabled && !isSelected && "hover:scale-105 hover:border-slate-400",
                            isDisabled && !isSelected
                                ? "opacity-25 cursor-not-allowed"
                                : "cursor-pointer"
                        )}
                        style={{ backgroundColor: hex }}
                    >
                        {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Check
                                    size={14}
                                    strokeWidth={3}
                                    className={white ? "text-slate-700" : "text-white"}
                                />
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ColorPreviewChip — small colored dot + name + hex
// ─────────────────────────────────────────────────────────────────────────────

function ColorPreviewChip({ hex, name }: { hex: string; name: string }) {
    const safe = normalizeHex(hex);
    const white = isWhiteHex(safe);
    return (
        <div className="mt-2.5 flex items-center gap-2">
            <span
                className="w-5 h-5 rounded-full border-2 shrink-0"
                style={{
                    backgroundColor: safe,
                    borderColor: white ? "#cbd5e1" : safe,
                    boxShadow: white ? "none" : `0 0 0 2px white, 0 0 0 3.5px ${safe}55`,
                }}
            />
            <div>
                <div className="text-xs font-semibold text-slate-700 leading-tight">{name}</div>
                <div className="text-[11px] text-slate-400 font-mono">{safe.toUpperCase()}</div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// StepTeams
// ─────────────────────────────────────────────────────────────────────────────

export function StepTeams({
    admin,
    onRefresh,
    onStart,
    canStartNow,

    strategyType,
    setStrategyType,
    includeGoalkeepers,
    setIncludeGoalkeepers,
    playersPerTeam,
    setPlayersPerTeam,
    onGenerateTeams,

    teamColors,
    colorMode,
    setColorMode,
    colorsLocked,
    allowEditColors,
    setAllowEditColors,
    colorsReadOnly,
    teamAColorId,
    setTeamAColorId,
    teamBColorId,
    setTeamBColorId,
    teamAColor,
    teamBColor,
    currentTeamAColorHex,
    currentTeamAColorName,
    currentTeamBColorHex,
    currentTeamBColorName,
    onApplyManualColors,
    onSetColorsRandomDistinct,

    generatedOptions,
    selectedTeamGenIdx,
    setSelectedTeamGenIdx,
    allPlayers,
    teamsAlreadyAssigned,
    assigningTeams,
    onAssignTeamsFromGenerated,

    sortedTeamAPlayers,
    sortedTeamBPlayers,
    onSwapPlayers,
    onMovePlayerToOtherTeam,
    onMovePlayerToTeam,
    onSwapInOption,
    onAssignUnassigned,
    onSetPlayerRole,
}: {
    admin: boolean;
    onRefresh: () => void;
    onStart: () => void;
    canStartNow: boolean;

    strategyType: StrategyId;
    setStrategyType: (v: StrategyId) => void;
    includeGoalkeepers: boolean;
    setIncludeGoalkeepers: (v: boolean) => void;
    playersPerTeam: number;
    setPlayersPerTeam: (v: number) => void;
    onGenerateTeams: () => void;

    teamColors: TeamColorDto[];
    colorMode: ColorMode;
    setColorMode: (v: ColorMode) => void;
    colorsLocked: boolean;
    allowEditColors: boolean;
    setAllowEditColors: (v: boolean) => void;
    colorsReadOnly: boolean;
    teamAColorId: string;
    setTeamAColorId: (v: string) => void;
    teamBColorId: string;
    setTeamBColorId: (v: string) => void;
    teamAColor: TeamColorDto | null;
    teamBColor: TeamColorDto | null;
    currentTeamAColorHex: string;
    currentTeamAColorName: string;
    currentTeamBColorHex: string;
    currentTeamBColorName: string;
    onApplyManualColors: () => void;
    onSetColorsRandomDistinct: () => void;

    generatedOptions: TeamOptionDto[] | null;
    selectedTeamGenIdx: number;
    setSelectedTeamGenIdx: (v: number) => void;
    allPlayers: PlayerInMatchDto[];
    teamsAlreadyAssigned: boolean;
    assigningTeams: boolean;
    onAssignTeamsFromGenerated: () => void;

    sortedTeamAPlayers: PlayerInMatchDto[];
    sortedTeamBPlayers: PlayerInMatchDto[];
    onSwapPlayers: (id1: string, id2: string) => Promise<void>;
    onMovePlayerToOtherTeam: (playerId: string, fromTeam: "A" | "B") => Promise<void>;
    onMovePlayerToTeam: (playerId: string, team: "A" | "B") => void;
    onSwapInOption: (playerAId: string, playerBId: string) => void;
    onSetPlayerRole?: (matchPlayerId: string, isGoalkeeper: boolean) => Promise<void>;
    onAssignUnassigned: (playerId: string, team: "A" | "B") => Promise<void>;
}) {
    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

    const byPlayerId = useMemo(() => {
        const m = new Map<string, PlayerInMatchDto>();
        for (const p of allPlayers) if (p?.playerId) m.set(p.playerId, p);
        return m;
    }, [allPlayers]);


    const canAssignTeams = useMemo(() => {
        if (!admin) return false;
        const opt =
            generatedOptions?.[
                Math.max(0, Math.min(selectedTeamGenIdx, (generatedOptions?.length ?? 1) - 1))
            ];
        const aLen = opt?.teamA?.length ?? 0;
        const bLen = opt?.teamB?.length ?? 0;
        return aLen > 0 && bLen > 0 && Math.abs(aLen - bLen) <= 1;
    }, [admin, generatedOptions, selectedTeamGenIdx]);

    const aHex = normalizeHex(currentTeamAColorHex);
    const bHex = normalizeHex(currentTeamBColorHex);
    const aName = currentTeamAColorName || "Time A";
    const bName = currentTeamBColorName || "Time B";
    const hasAColor = currentTeamAColorHex.trim().length > 0;
    const hasBColor = currentTeamBColorHex.trim().length > 0;

    // ── Post-assignment player selection (move/swap) ──────────────────────────
    const [sel1, setSel1] = useState<{ id: string; team: "A" | "B" } | null>(null);
    const [sel2Id, setSel2Id] = useState<string | null>(null);
    const [acting, setActing] = useState(false);

    function handlePlayerClick(playerId: string, team: "A" | "B") {
        if (sel1?.id === playerId) { setSel1(null); setSel2Id(null); return; }
        if (sel2Id === playerId) { setSel2Id(null); return; }
        if (!sel1) { setSel1({ id: playerId, team }); return; }
        if (sel1.team === team) { setSel1({ id: playerId, team }); setSel2Id(null); return; }
        setSel2Id(playerId);
    }

    async function doMove() {
        if (!sel1) return;
        setActing(true);
        try { await onMovePlayerToOtherTeam(sel1.id, sel1.team); setSel1(null); setSel2Id(null); }
        finally { setActing(false); }
    }

    async function doSwap() {
        if (!sel1 || !sel2Id) return;
        setActing(true);
        try { await onSwapPlayers(sel1.id, sel2Id); setSel1(null); setSel2Id(null); }
        finally { setActing(false); }
    }

    // ── Assigned-teams panel (shared between admin and non-admin) ────────────
    const canMoveToA = !!sel1 && sel1.team === "B" && !sel2Id;
    const canMoveToB = !!sel1 && sel1.team === "A" && !sel2Id;
    const canSwapPlayers = !!sel1 && !!sel2Id;

    const teamsSetPanel = teamsAlreadyAssigned ? (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <div className="text-sm font-semibold text-slate-900 flex-1">Times definidos</div>
                {admin && (
                    <>
                        {/* 3-button action bar */}
                        <div className="flex items-center rounded-lg overflow-hidden divide-x divide-white/30 shrink-0">
                            <button
                                disabled={acting || !canMoveToA}
                                onClick={doMove}
                                title={`→ ${aName}`}
                                className={cls(
                                    "w-8 h-8 flex items-center justify-center text-xs font-bold transition-all rounded-l-lg",
                                    !acting && canMoveToA
                                        ? "cursor-pointer hover:brightness-110 active:brightness-95 shadow-sm"
                                        : "opacity-30 cursor-not-allowed"
                                )}
                                style={{ backgroundColor: hasAColor && !isWhiteHex(aHex) ? aHex : "#1d4ed8", color: "white" }}
                            >
                                {"<<"}
                            </button>
                            <button
                                disabled={acting || !canSwapPlayers}
                                onClick={doSwap}
                                title="Trocar jogadores"
                                className={cls(
                                    "w-8 h-8 flex items-center justify-center transition-all bg-emerald-500 text-white",
                                    !acting && canSwapPlayers
                                        ? "cursor-pointer hover:brightness-110 active:brightness-95 shadow-sm"
                                        : "opacity-30 cursor-not-allowed"
                                )}
                            >
                                <ArrowLeftRight size={13} />
                            </button>
                            <button
                                disabled={acting || !canMoveToB}
                                onClick={doMove}
                                title={`→ ${bName}`}
                                className={cls(
                                    "w-8 h-8 flex items-center justify-center text-xs font-bold transition-all rounded-r-lg",
                                    !acting && canMoveToB
                                        ? "cursor-pointer hover:brightness-110 active:brightness-95 shadow-sm"
                                        : "opacity-30 cursor-not-allowed"
                                )}
                                style={{ backgroundColor: hasBColor && !isWhiteHex(bHex) ? bHex : "#1d4ed8", color: "white" }}
                            >
                                {">>"}
                            </button>
                        </div>
                        <button
                            disabled={!canStartNow}
                            onClick={onStart}
                            className={cls(
                                "shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                                canStartNow
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            <Play size={12} />
                            Iniciar
                        </button>
                    </>
                )}
            </div>

            {/* Two team columns — stack on mobile, side-by-side on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {/* ── Team A ── */}
                <div>
                    <div
                        className="flex items-center justify-between px-4 py-2.5"
                        style={{
                            backgroundColor: hasAColor ? aHex + "18" : "#f8fafc",
                            borderBottom: `2px solid ${hasAColor ? aHex : "#e2e8f0"}`,
                        }}
                    >
                        <div className="flex items-center gap-2">
                            {hasAColor && (
                                <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{
                                        backgroundColor: aHex,
                                        outline: isWhiteHex(aHex) ? "1.5px solid #cbd5e1" : "none",
                                        outlineOffset: "1px",
                                    }}
                                />
                            )}
                            <span
                                className="text-sm font-bold"
                                style={{ color: hasAColor && !isWhiteHex(aHex) ? aHex : "#0f172a" }}
                            >
                                {aName}
                            </span>
                        </div>
                        <span className="text-xs text-slate-400">{sortedTeamAPlayers.length}j</span>
                    </div>
                    <ul className="divide-y divide-slate-50">
                        {sortedTeamAPlayers.map((p) => {
                            const isSel1 = sel1?.id === p.playerId;
                            const isSel2 = sel2Id === p.playerId;
                            const isSelected = isSel1 || isSel2;
                            const isOpposite = admin && sel1 && sel1.team !== "A" && !isSel1;
                            return (
                                <li
                                    key={p.playerId}
                                    onClick={admin ? () => handlePlayerClick(p.playerId, "A") : undefined}
                                    className={cls(
                                        "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors select-none",
                                        admin && "cursor-pointer",
                                        isSel1 ? "bg-amber-50 border-l-[3px] border-amber-400"
                                        : isSel2 ? "bg-emerald-50 border-l-[3px] border-emerald-400"
                                        : isOpposite ? "hover:bg-emerald-50"
                                        : admin ? "hover:bg-slate-50" : ""
                                    )}
                                >
                                    <span className={cls("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", isSel1 ? "bg-amber-400 text-white" : isSel2 ? "bg-emerald-400 text-white" : "bg-slate-100 text-slate-500")}>
                                        {p.playerName.charAt(0).toUpperCase()}
                                    </span>
                                    <span className={cls("truncate flex-1 font-medium", isSel1 ? "text-amber-700" : isSel2 ? "text-emerald-700" : "text-slate-900")}>
                                        {p.playerName}
                                    </span>
                                    {admin && onSetPlayerRole ? (
                                        <button
                                            title={p.isGoalkeeper ? "Goleiro — clique para jogar na linha nesta partida" : "Linha — clique para jogar como goleiro nesta partida"}
                                            className="shrink-0 text-xs px-1 rounded cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); onSetPlayerRole(p.matchPlayerId, !p.isGoalkeeper); }}
                                        >
                                            <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={14} />
                                        </button>
                                    ) : (
                                        <span title={p.isGoalkeeper ? "Goleiro" : "Jogador"} className="shrink-0 text-xs"><IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} /></span>
                                    )}
                                    {isSelected && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                                </li>
                            );
                        })}
                        {sortedTeamAPlayers.length === 0 && (
                            <li className="px-4 py-3 text-xs text-slate-400">Nenhum jogador</li>
                        )}
                    </ul>
                </div>

                {/* ── Team B ── */}
                <div>
                    <div
                        className="flex items-center justify-between px-4 py-2.5"
                        style={{
                            backgroundColor: hasBColor ? bHex + "18" : "#f8fafc",
                            borderBottom: `2px solid ${hasBColor ? bHex : "#e2e8f0"}`,
                        }}
                    >
                        <div className="flex items-center gap-2">
                            {hasBColor && (
                                <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{
                                        backgroundColor: bHex,
                                        outline: isWhiteHex(bHex) ? "1.5px solid #cbd5e1" : "none",
                                        outlineOffset: "1px",
                                    }}
                                />
                            )}
                            <span
                                className="text-sm font-bold"
                                style={{ color: hasBColor && !isWhiteHex(bHex) ? bHex : "#0f172a" }}
                            >
                                {bName}
                            </span>
                        </div>
                        <span className="text-xs text-slate-400">{sortedTeamBPlayers.length}j</span>
                    </div>
                    <ul className="divide-y divide-slate-50">
                        {sortedTeamBPlayers.map((p) => {
                            const isSel1 = sel1?.id === p.playerId;
                            const isSel2 = sel2Id === p.playerId;
                            const isSelected = isSel1 || isSel2;
                            const isOpposite = admin && sel1 && sel1.team !== "B" && !isSel1;
                            return (
                                <li
                                    key={p.playerId}
                                    onClick={admin ? () => handlePlayerClick(p.playerId, "B") : undefined}
                                    className={cls(
                                        "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors select-none",
                                        admin && "cursor-pointer",
                                        isSel1 ? "bg-amber-50 border-l-[3px] border-amber-400"
                                        : isSel2 ? "bg-emerald-50 border-l-[3px] border-emerald-400"
                                        : isOpposite ? "hover:bg-emerald-50"
                                        : admin ? "hover:bg-slate-50" : ""
                                    )}
                                >
                                    <span className={cls("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", isSel1 ? "bg-amber-400 text-white" : isSel2 ? "bg-emerald-400 text-white" : "bg-slate-100 text-slate-500")}>
                                        {p.playerName.charAt(0).toUpperCase()}
                                    </span>
                                    <span className={cls("truncate flex-1 font-medium", isSel1 ? "text-amber-700" : isSel2 ? "text-emerald-700" : "text-slate-900")}>
                                        {p.playerName}
                                    </span>
                                    {admin && onSetPlayerRole ? (
                                        <button
                                            title={p.isGoalkeeper ? "Goleiro — clique para jogar na linha nesta partida" : "Linha — clique para jogar como goleiro nesta partida"}
                                            className="shrink-0 text-xs px-1 rounded cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); onSetPlayerRole(p.matchPlayerId, !p.isGoalkeeper); }}
                                        >
                                            <IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={14} />
                                        </button>
                                    ) : (
                                        <span title={p.isGoalkeeper ? "Goleiro" : "Jogador"} className="shrink-0 text-xs"><IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} /></span>
                                    )}
                                    {isSelected && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                                </li>
                            );
                        })}
                        {sortedTeamBPlayers.length === 0 && (
                            <li className="px-4 py-3 text-xs text-slate-400">Nenhum jogador</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* ── Unassigned players — only visible after teams have been generated ── */}
            {admin && generatedOptions !== null && allPlayers.some((p) => (p as any).team === 0 && p.inviteResponse === InviteResponse.Accepted) && (
                <div className="border-t border-amber-100 bg-amber-50/60">
                    <div className="flex items-center justify-between px-4 py-2.5">
                        <div>
                            <div className="text-sm font-semibold text-amber-800">Não atribuídos</div>
                        </div>
                        <span className="text-xs text-amber-600">
                            {allPlayers.filter((p) => (p as any).team === 0 && p.inviteResponse === InviteResponse.Accepted).length}j
                        </span>
                    </div>
                    <ul className="divide-y divide-amber-100/60">
                        {(() => {
                            const unassigned = allPlayers.filter(
                                (p) => (p as any).team === 0 && p.inviteResponse === InviteResponse.Accepted
                            );
                            const unassignedRegular = unassigned.filter((p) => !p.isGuest);
                            const unassignedGuests  = unassigned.filter((p) => p.isGuest);

                            function UnassignedRow({ p }: { p: PlayerInMatchDto }) {
                                return (
                                    <li key={p.playerId} className="flex items-center gap-2.5 px-4 py-2.5">
                                        <span className={cls("w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0", p.isGuest ? "bg-amber-100 text-amber-600" : "bg-amber-100 text-amber-700")}>
                                            {p.playerName.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="truncate flex-1 text-sm font-medium text-slate-900">
                                            {p.playerName}
                                            <span title={p.isGoalkeeper ? "Goleiro" : "Jogador"} className="ml-1 text-xs"><IconRenderer value={resolveIcon(_icons, p.isGoalkeeper ? 'goalkeeper' : 'player')} size={13} /></span>
                                        </span>
                                        <button
                                            onClick={() => onAssignUnassigned(p.playerId, "A")}
                                            title={`Atribuir para ${aName}`}
                                            className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border-2 bg-white transition-colors hover:brightness-95"
                                            style={{ color: hasAColor && !isWhiteHex(aHex) ? aHex : "#1d4ed8", borderColor: hasAColor && !isWhiteHex(aHex) ? aHex : "#3b82f6" }}
                                        >
                                            → A
                                        </button>
                                        <button
                                            onClick={() => onAssignUnassigned(p.playerId, "B")}
                                            title={`Atribuir para ${bName}`}
                                            className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border-2 bg-white transition-colors hover:brightness-95"
                                            style={{ color: hasBColor && !isWhiteHex(bHex) ? bHex : "#1d4ed8", borderColor: hasBColor && !isWhiteHex(bHex) ? bHex : "#3b82f6" }}
                                        >
                                            → B
                                        </button>
                                    </li>
                                );
                            }

                            return (
                                <>
                                    {unassignedRegular.map((p) => <UnassignedRow key={p.playerId} p={p} />)}
                                    {unassignedGuests.length > 0 && (
                                        <>
                                            <li className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-amber-50/60 select-none">
                                                Convidados
                                            </li>
                                            {unassignedGuests.map((p) => <UnassignedRow key={p.playerId} p={p} />)}
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </ul>
                </div>
            )}
        </div>
    ) : null;

    // ── Non-admin view ────────────────────────────────────────────────────────
    if (!admin) {
        const hasColors = hasAColor || hasBColor;
        return (
            <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">Times</div>
                    <button className="btn flex items-center gap-1.5 text-sm" onClick={onRefresh}>
                        <RefreshCw size={13} />
                        <span className="hidden sm:inline">Recarregar</span>
                    </button>
                </div>

                {/* Colors VS chip */}
                {hasColors && (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-2 flex-1">
                            <span
                                className="w-5 h-5 rounded-full shrink-0 border-2"
                                style={{
                                    backgroundColor: aHex,
                                    borderColor: isWhiteHex(aHex) ? "#cbd5e1" : aHex,
                                }}
                            />
                            <span
                                className="text-sm font-semibold"
                                style={{ color: isWhiteHex(aHex) ? "#334155" : aHex }}
                            >
                                {aName}
                            </span>
                        </div>
                        <span className="text-xs font-medium text-slate-400">vs</span>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                            <span
                                className="text-sm font-semibold"
                                style={{ color: isWhiteHex(bHex) ? "#334155" : bHex }}
                            >
                                {bName}
                            </span>
                            <span
                                className="w-5 h-5 rounded-full shrink-0 border-2"
                                style={{
                                    backgroundColor: bHex,
                                    borderColor: isWhiteHex(bHex) ? "#cbd5e1" : bHex,
                                }}
                            />
                        </div>
                    </div>
                )}

                {teamsSetPanel ?? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
                        {teamsAlreadyAssigned
                            ? "Carregando times..."
                            : "Times ainda não foram definidos."}
                    </div>
                )}
            </div>
        );
    }

    // ── Admin view ────────────────────────────────────────────────────────────
    return (
        <div className="card p-4 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="font-semibold text-slate-900">MatchMaking</div>
                <button className="btn flex items-center gap-1.5 text-sm" onClick={onRefresh}>
                    <RefreshCw size={13} />
                    <span className="hidden sm:inline">Recarregar</span>
                </button>
            </div>

            {/* Config row — algorithm, PPT, GK + Gerar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                    <div className="label">Algoritmo</div>
                    <select
                        className="input h-9 text-sm"
                        value={strategyType}
                        onChange={(e) => setStrategyType(Number(e.target.value) as StrategyId)}
                    >
                        {STRATEGIES.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <div className="label">Players/Team</div>
                    <input
                        className="input h-9 text-sm"
                        type="number"
                        value={playersPerTeam}
                        onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
                    />
                </label>

                <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={includeGoalkeepers}
                            onChange={(e) => setIncludeGoalkeepers(e.target.checked)}
                        />
                        <span className="text-sm font-medium text-slate-700">Incluir goleiros</span>
                    </label>
                    <button className="btn btn-primary h-9 text-sm" onClick={onGenerateTeams}>
                        Gerar times
                    </button>
                </div>
            </div>

            {/* ── Colors ── */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                {/* Colors header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <div className="text-sm font-semibold text-slate-900">Cores dos times</div>
                        {colorsLocked && !allowEditColors && (
                            <div className="text-xs text-slate-500 mt-0.5">Cores já definidas.</div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {colorsLocked && (
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={allowEditColors}
                                    onChange={(e) => setAllowEditColors(e.target.checked)}
                                />
                                Editar
                            </label>
                        )}

                        {/* Mode toggle pill */}
                        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                            <button
                                type="button"
                                disabled={colorsReadOnly}
                                onClick={() => setColorMode("manual")}
                                className={cls(
                                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                                    colorMode === "manual"
                                        ? "bg-white shadow-sm text-slate-900"
                                        : "text-slate-500 hover:text-slate-700",
                                    colorsReadOnly && "pointer-events-none"
                                )}
                            >
                                Manual
                            </button>
                            <button
                                type="button"
                                disabled={colorsReadOnly}
                                onClick={() => setColorMode("random")}
                                className={cls(
                                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                                    colorMode === "random"
                                        ? "bg-white shadow-sm text-slate-900"
                                        : "text-slate-500 hover:text-slate-700",
                                    colorsReadOnly && "pointer-events-none"
                                )}
                            >
                                Aleatório
                            </button>
                        </div>

                        {colorMode === "random" ? (
                            <button
                                type="button"
                                disabled={colorsReadOnly}
                                onClick={onSetColorsRandomDistinct}
                                className={cls(
                                    "btn h-8 text-xs flex items-center gap-1.5",
                                    colorsReadOnly && "opacity-50 pointer-events-none"
                                )}
                            >
                                <Shuffle size={11} />
                                Sortear
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={colorsReadOnly || !teamAColorId || !teamBColorId}
                                onClick={onApplyManualColors}
                                className={cls(
                                    "btn btn-primary h-8 text-xs",
                                    (colorsReadOnly || !teamAColorId || !teamBColorId) &&
                                        "opacity-50 pointer-events-none"
                                )}
                            >
                                Aplicar cores
                            </button>
                        )}
                    </div>
                </div>

                {colorMode === "manual" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5">
                                Time A
                            </div>
                            <ColorSwatchPicker
                                colors={teamColors}
                                selectedId={teamAColorId}
                                disabledId={teamBColorId}
                                readOnly={colorsReadOnly}
                                onSelect={setTeamAColorId}
                            />
                            {teamAColor ? (
                                <ColorPreviewChip hex={teamAColor.hexValue} name={teamAColor.name} />
                            ) : currentTeamAColorHex ? (
                                <ColorPreviewChip
                                    hex={currentTeamAColorHex}
                                    name={currentTeamAColorName || "Time A"}
                                />
                            ) : null}
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5">
                                Time B
                            </div>
                            <ColorSwatchPicker
                                colors={teamColors}
                                selectedId={teamBColorId}
                                disabledId={teamAColorId}
                                readOnly={colorsReadOnly}
                                onSelect={setTeamBColorId}
                            />
                            {teamBColor ? (
                                <ColorPreviewChip hex={teamBColor.hexValue} name={teamBColor.name} />
                            ) : currentTeamBColorHex ? (
                                <ColorPreviewChip
                                    hex={currentTeamBColorHex}
                                    name={currentTeamBColorName || "Time B"}
                                />
                            ) : null}
                        </div>

                        {teamAColorId && teamBColorId && teamAColorId === teamBColorId && (
                            <div className="md:col-span-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                                ⚠️ As duas cores são iguais — selecione cores diferentes.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Shuffle size={14} className="shrink-0 text-slate-400" />
                    </div>
                )}
            </div>

            {/* ── Generated options ── */}
            {generatedOptions && generatedOptions.length > 0 ? (
                <TeamGenCarousel
                    options={generatedOptions}
                    selectedIndex={selectedTeamGenIdx}
                    onSelect={setSelectedTeamGenIdx}
                    adminView={admin}
                    byPlayerId={byPlayerId}
                    teamAHex={currentTeamAColorHex}
                    teamAName={currentTeamAColorName || "Time A"}
                    teamBHex={currentTeamBColorHex}
                    teamBName={currentTeamBColorName || "Time B"}
                    onMoveToTeam={admin ? onMovePlayerToTeam : undefined}
                    onSwapInOption={admin ? onSwapInOption : undefined}
                />
            ) : (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                    Clique em <b>Gerar times</b> para ver as opções de sorteio.
                </div>
            )}

            {/* ── Setar times — shown only when options exist ── */}
            {generatedOptions && generatedOptions.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-500">
                        {teamsAlreadyAssigned ? (
                            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                                <Check size={13} />
                                Times já setados
                            </span>
                        ) : (
                            "Escolha uma opção acima e confirme aqui."
                        )}
                    </div>
                    <button
                        disabled={!canAssignTeams || assigningTeams}
                        onClick={onAssignTeamsFromGenerated}
                        className={cls(
                            "btn btn-primary h-9 text-sm",
                            (!canAssignTeams || assigningTeams) && "opacity-50 pointer-events-none"
                        )}
                    >
                        {assigningTeams ? "Setando..." : "Setar times"}
                    </button>
                </div>
            )}

            {/* ── Assigned teams panel with inline swap + Iniciar ── */}
            {teamsSetPanel}
        </div>
    );
}
