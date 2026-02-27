import { useMemo } from "react";
import type {
    ColorMode,
    PlayerInMatchDto,
    StrategyId,
    TeamColorDto,
    TeamOptionDto,
} from "../matchTypes";
import { STRATEGIES } from "../matchTypes";
import { cls } from "../matchUtils";
import { MiniShirt } from "../ui/MiniShirt";
import { TeamGenCarousel } from "../ui/TeamGenCarousel";

export function StepTeams({
    admin,
    onRefresh,
    onStart,
    canStartNow,

    // teamgen config
    strategyType,
    setStrategyType,
    includeGoalkeepers,
    setIncludeGoalkeepers,
    playersPerTeam,
    setPlayersPerTeam,
    onGenerateTeams,

    // colors
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

    // teams
    generatedOptions,
    selectedTeamGenIdx,
    setSelectedTeamGenIdx,
    allPlayers,
    teamsAlreadyAssigned,
    assigningTeams,
    onAssignTeamsFromGenerated,

    // swap
    canSwap,
    swapA,
    setSwapA,
    swapB,
    setSwapB,
    swapping,
    onSwap,
    sortedTeamAPlayers,
    sortedTeamBPlayers,
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

    canSwap: boolean;
    swapA: string;
    setSwapA: (v: string) => void;
    swapB: string;
    setSwapB: (v: string) => void;
    swapping: boolean;
    onSwap: () => void;
    sortedTeamAPlayers: PlayerInMatchDto[];
    sortedTeamBPlayers: PlayerInMatchDto[];
}) {
    const byPlayerId = useMemo(() => {
        const m = new Map<string, PlayerInMatchDto>();
        for (const p of allPlayers) if (p?.playerId) m.set(p.playerId, p);
        return m;
    }, [allPlayers]);

    const generatedTeamsView = useMemo(() => {
        if (!generatedOptions || generatedOptions.length === 0) return null;

        return (
            <TeamGenCarousel
                options={generatedOptions}
                selectedIndex={selectedTeamGenIdx}
                onSelect={setSelectedTeamGenIdx}
                adminView={admin}
                byPlayerId={byPlayerId}
            />
        );
    }, [generatedOptions, selectedTeamGenIdx, admin, byPlayerId, setSelectedTeamGenIdx]);

    const canAssignTeams = useMemo(() => {
        if (!admin) return false;
        if (teamsAlreadyAssigned) return false;
        const opt = generatedOptions?.[Math.max(0, Math.min(selectedTeamGenIdx, (generatedOptions?.length ?? 1) - 1))];
        const a = opt?.teamA?.length ?? 0;
        const b = opt?.teamB?.length ?? 0;
        return a > 0 && b > 0;
    }, [admin, teamsAlreadyAssigned, generatedOptions, selectedTeamGenIdx]);

    return (
        <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="font-semibold">MatchMaking (Times / cores / swap)</div>

                <div className="flex items-center gap-2">
                    <button className="btn" onClick={onRefresh}>Recarregar</button>
                    {admin ? <button className="btn btn-primary" onClick={onGenerateTeams}>Gerar times</button> : null}
                </div>
            </div>

            {!admin ? (
                <div className="mt-4 text-sm text-slate-600">
                    Somente visualização (admin controla).
                </div>
            ) : (
                <>
                    {/* Config TeamGen */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        <label className="block">
                            <div className="label">Algoritmo</div>
                            <select
                                className="input h-9 text-sm"
                                value={strategyType}
                                onChange={(e) => setStrategyType(Number(e.target.value) as StrategyId)}
                            >
                                {STRATEGIES.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
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

                        <label className="flex items-center gap-2 mt-1 sm:mt-6">
                            <input type="checkbox" checked={includeGoalkeepers} onChange={(e) => setIncludeGoalkeepers(e.target.checked)} />
                            <span className="text-sm font-medium text-slate-700">Incluir goleiros</span>
                        </label>
                    </div>

                    {/* CORES */}
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div>
                                <div className="font-semibold text-slate-900">Cores dos times</div>
                                <div className="text-xs text-slate-500">
                                    Se já estiver setado, fica travado. Marque “alterar cores” para liberar.
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    className="input h-9 text-sm w-40"
                                    value={colorMode}
                                    onChange={(e) => setColorMode(e.target.value as any)}
                                    disabled={colorsReadOnly}
                                >
                                    <option value="manual">Manual</option>
                                    <option value="random">Aleatório</option>
                                </select>

                                {colorsLocked ? (
                                    <label className="flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={allowEditColors}
                                            onChange={(e) => setAllowEditColors(e.target.checked)}
                                        />
                                        <span>Alterar cores</span>
                                    </label>
                                ) : null}

                                {colorMode === "random" ? (
                                    <button
                                        className={cls("btn h-9", colorsReadOnly && "opacity-50 pointer-events-none")}
                                        disabled={colorsReadOnly}
                                        onClick={onSetColorsRandomDistinct}
                                    >
                                        Sortear e aplicar
                                    </button>
                                ) : (
                                    <button
                                        className={cls("btn h-9", (colorsReadOnly || !teamAColorId || !teamBColorId) && "opacity-50 pointer-events-none")}
                                        disabled={colorsReadOnly || !teamAColorId || !teamBColorId}
                                        onClick={onApplyManualColors}
                                    >
                                        Aplicar cores
                                    </button>
                                )}
                            </div>
                        </div>

                        {colorMode === "manual" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="min-w-0">
                                    <div className="label">Time A</div>
                                    <select className="input h-9 text-sm w-full md:max-w-[320px]" value={teamAColorId} onChange={(e) => setTeamAColorId(e.target.value)} disabled={colorsReadOnly}>
                                        {teamColors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <MiniShirt color={teamAColor?.hexValue ?? currentTeamAColorHex ?? "#e2e8f0"} label={teamAColor?.name ?? currentTeamAColorName ?? "—"} />
                                </div>

                                <div className="min-w-0">
                                    <div className="label">Time B</div>
                                    <select className="input h-9 text-sm w-full md:max-w-[320px]" value={teamBColorId} onChange={(e) => setTeamBColorId(e.target.value)} disabled={colorsReadOnly}>
                                        {teamColors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <MiniShirt color={teamBColor?.hexValue ?? currentTeamBColorHex ?? "#e2e8f0"} label={teamBColor?.name ?? currentTeamBColorName ?? "—"} />
                                </div>

                                {teamAColorId && teamBColorId && teamAColorId === teamBColorId ? (
                                    <div className="md:col-span-2 text-xs text-amber-700">
                                        As duas cores estão iguais. Se quiser, selecione cores diferentes.
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="mt-3 text-sm text-slate-600">
                                No modo <b>Aleatório</b>, escolhe 2 cores do banco <b>sem repetir</b> e aplica na hora.
                            </div>
                        )}
                    </div>

                    {/* TIMES GERADOS */}
                    {generatedTeamsView ? generatedTeamsView : <div className="muted mt-3">Gere times para visualizar aqui.</div>}

                    {/* SETAR TIMES */}
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <button
                            className={cls("btn btn-primary", (!canAssignTeams || assigningTeams) && "opacity-50 pointer-events-none")}
                            disabled={!canAssignTeams || assigningTeams}
                            onClick={onAssignTeamsFromGenerated}
                        >
                            {assigningTeams ? "Setando..." : teamsAlreadyAssigned ? "Times já setados" : "Setar times"}
                        </button>

                        {teamsAlreadyAssigned ? (
                            <span className="text-xs text-slate-500">
                                Times já foram setados. Use o swap para trocar 1 jogador de cada lado.
                            </span>
                        ) : null}
                    </div>

                    {/* LISTA VISUAL (TIMES SETADOS) */}
                    {teamsAlreadyAssigned ? (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <div className="font-semibold text-slate-900">Times setados</div>
                                    <div className="text-xs text-slate-500">Use essa lista para decidir quem trocar.</div>
                                </div>
                                <span className="pill">A: {sortedTeamAPlayers.length} • B: {sortedTeamBPlayers.length}</span>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-slate-900">Time A</div>
                                        <span className="pill">{sortedTeamAPlayers.length}</span>
                                    </div>

                                    <ul className="mt-3 space-y-2 text-sm">
                                        {sortedTeamAPlayers.map((p) => (
                                            <li key={p.playerId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                <span className="truncate font-medium text-slate-900">
                                                    {p.playerName} {p.isGoalkeeper ? <span title="Goleiro">🧤</span> : null}
                                                </span>
                                            </li>
                                        ))}
                                        {sortedTeamAPlayers.length === 0 ? <li className="text-slate-500">Nenhum.</li> : null}
                                    </ul>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-slate-900">Time B</div>
                                        <span className="pill">{sortedTeamBPlayers.length}</span>
                                    </div>

                                    <ul className="mt-3 space-y-2 text-sm">
                                        {sortedTeamBPlayers.map((p) => (
                                            <li key={p.playerId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                <span className="truncate font-medium text-slate-900">
                                                    {p.playerName} {p.isGoalkeeper ? <span title="Goleiro">🧤</span> : null}
                                                </span>
                                            </li>
                                        ))}
                                        {sortedTeamBPlayers.length === 0 ? <li className="text-slate-500">Nenhum.</li> : null}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* SWAP */}
                    {canSwap ? (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <div className="font-semibold text-slate-900">Trocar jogadores (swap)</div>
                                    <div className="text-xs text-slate-500">Selecione 1 do Time A e 1 do Time B, depois confirme.</div>
                                </div>

                                <button
                                    className={cls("btn btn-primary h-9", (!swapA || !swapB || swapping) && "opacity-50 pointer-events-none")}
                                    disabled={!swapA || !swapB || swapping}
                                    onClick={onSwap}
                                >
                                    {swapping ? "Trocando..." : "Trocar"}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <label className="block">
                                    <div className="label">Jogador do Time A</div>
                                    <select className="input h-9 text-sm" value={swapA} onChange={(e) => setSwapA(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {sortedTeamAPlayers.map((p) => (
                                            <option key={p.playerId} value={p.playerId}>
                                                {p.playerName} {p.isGoalkeeper ? "🧤" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <div className="label">Jogador do Time B</div>
                                    <select className="input h-9 text-sm" value={swapB} onChange={(e) => setSwapB(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {sortedTeamBPlayers.map((p) => (
                                            <option key={p.playerId} value={p.playerId}>
                                                {p.playerName} {p.isGoalkeeper ? "🧤" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                    ) : null}

                    {/* START */}
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            className={cls("btn btn-primary", !canStartNow && "opacity-50 pointer-events-none")}
                            disabled={!canStartNow}
                            onClick={onStart}
                            title={!canStartNow ? "Defina os times antes de iniciar" : "Iniciar partida"}
                        >
                            Start
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}