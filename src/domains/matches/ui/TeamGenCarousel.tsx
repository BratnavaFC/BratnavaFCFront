import type { PlayerInMatchDto, PlayerWeightDto, TeamOptionDto } from "../matchTypes";
import { cls, fmtWeight } from "../matchUtils";

export function TeamGenCarousel({
    options,
    selectedIndex,
    onSelect,
    adminView,
    byPlayerId,
}: {
    options: TeamOptionDto[];
    selectedIndex: number;
    onSelect: (idx: number) => void;
    adminView: boolean;
    byPlayerId: Map<string, PlayerInMatchDto>;
}) {
    const safeIdx = Math.max(0, Math.min(selectedIndex, options.length - 1));
    const opt = options[safeIdx];

    const renderTeam = (title: string, list: PlayerWeightDto[]) => (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">{title}</div>
                <span className="pill">{list.length}</span>
            </div>

            <ul className="mt-3 space-y-2 text-sm">
                {list.map((x) => {
                    const p = byPlayerId.get(x.playerId);
                    const name = p?.playerName ?? x.playerId;
                    const isGk = !!p?.isGoalkeeper;

                    return (
                        <li
                            key={x.playerId}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                            <span className="truncate font-medium text-slate-900">
                                {name} {isGk ? <span title="Goleiro">🧤</span> : null}
                            </span>

                            {adminView ? (
                                <span className="text-xs font-mono text-slate-600">{fmtWeight(x.weight)}</span>
                            ) : null}
                        </li>
                    );
                })}

                {list.length === 0 ? <li className="text-slate-500">Nenhum.</li> : null}
            </ul>
        </div>
    );

    return (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-semibold text-slate-900">Opções geradas</div>
                    <div className="text-xs text-slate-500">
                        {adminView ? "Escolha 1 opção no carrossel. Pesos são EffectiveWinRate." : "Aguardando opção escolhida pelo admin."}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className={cls("btn h-9", safeIdx <= 0 && "opacity-50 pointer-events-none")}
                        disabled={safeIdx <= 0}
                        onClick={() => onSelect(safeIdx - 1)}
                        title="Anterior"
                    >
                        ◀
                    </button>
                    <button
                        className={cls("btn h-9", safeIdx >= options.length - 1 && "opacity-50 pointer-events-none")}
                        disabled={safeIdx >= options.length - 1}
                        onClick={() => onSelect(safeIdx + 1)}
                        title="Próximo"
                    >
                        ▶
                    </button>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
                {options.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => onSelect(i)}
                        className={cls("h-2.5 w-2.5 rounded-full", i === safeIdx ? "bg-slate-900" : "bg-slate-300 hover:bg-slate-400")}
                        title={`Opção ${i + 1}`}
                    />
                ))}
            </div>

            {adminView ? (
                <div className="mt-3 grid md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-slate-500">A weight</div>
                        <div className="font-semibold text-slate-900">{fmtWeight(opt.teamAWeight)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-slate-500">B weight</div>
                        <div className="font-semibold text-slate-900">{fmtWeight(opt.teamBWeight)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-slate-500">Diff</div>
                        <div className="font-semibold text-slate-900">{fmtWeight(opt.balanceDiff)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-slate-500">GK diff</div>
                        <div className="font-semibold text-slate-900">{opt.goalkeeperDiff ?? 0}</div>
                    </div>
                </div>
            ) : null}

            <div className="mt-4 grid md:grid-cols-2 gap-4">
                {renderTeam(`Opção ${safeIdx + 1} • Time A`, opt.teamA)}
                {renderTeam(`Opção ${safeIdx + 1} • Time B`, opt.teamB)}
            </div>
        </div>
    );
}