import { RefreshCw } from "lucide-react";
import { useAccountStore } from "../../../auth/accountStore";
import { useGroupIcons } from "../../../hooks/useGroupIcons";
import { IconRenderer } from "../../../components/IconRenderer";
import { resolveIcon } from "../../../lib/groupIcons";

export function StepDone({
    admin,
    scoreA,
    scoreB,
    mvp,
    onReload,
}: {
    admin: boolean;
    scoreA: number | null | undefined;
    scoreB: number | null | undefined;
    mvp: string;
    onReload: () => void;
}) {
    const hasScore = scoreA != null && scoreB != null;
    const _groupId = useAccountStore(s => s.getActive()?.activeGroupId);
    const _icons = useGroupIcons(_groupId);

    return (
        <div className="card overflow-hidden p-0">
            {/* Gold accent strip */}
            <div className="h-1 w-full bg-amber-400" />

            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="font-semibold text-slate-900">Finalizada</div>
                        <div className="text-xs text-slate-500">
                            {admin ? "Partida encerrada e contabilizada." : "Visualização."}
                        </div>
                    </div>

                    {admin && (
                        <button className="btn flex items-center gap-1.5" onClick={onReload}>
                            <RefreshCw size={14} />
                            <span className="hidden sm:inline">Atualizar</span>
                        </button>
                    )}
                </div>

                {/* Scoreboard */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                        Placar Final
                    </div>
                    {hasScore ? (
                        <div className="text-5xl font-extrabold text-slate-900 tabular-nums">
                            {scoreA}{" "}
                            <span className="text-slate-300 mx-1">×</span>{" "}
                            {scoreB}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-400">Placar não disponível</div>
                    )}
                </div>

                {/* MVP */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <IconRenderer value={resolveIcon(_icons, 'mvp')} size={16} lucideProps={{ className: "text-amber-500 shrink-0" }} />
                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                            MVP
                        </span>
                    </div>
                    <div className="text-lg font-bold text-slate-900">{mvp || "—"}</div>
                </div>
            </div>
        </div>
    );
}
