import { ChevronRight, RefreshCw } from "lucide-react";

export function StepEnded({
    admin,
    onRefresh,
    onGoToPostGame,
}: {
    admin: boolean;
    onRefresh: () => void;
    onGoToPostGame: () => void;
}) {
    return (
        <div className="card overflow-hidden p-0">
            {/* Amber accent strip */}
            <div className="h-1 w-full bg-amber-400" />

            <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <div className="font-semibold text-slate-900">Encerrado</div>
                        <div className="text-xs text-slate-500">
                            {admin
                                ? "Partida encerrada. Avance para o Pós-jogo."
                                : "Partida encerrada. Aguardando admin ir para Pós-jogo."}
                        </div>
                    </div>

                    {admin ? (
                        <div className="flex items-center gap-2">
                            <button
                                className="btn flex items-center gap-1.5"
                                onClick={onRefresh}
                            >
                                <RefreshCw size={14} />
                                <span className="hidden sm:inline">Recarregar</span>
                            </button>

                            <button
                                className="btn btn-primary flex items-center gap-1.5"
                                onClick={onGoToPostGame}
                            >
                                Pós-jogo
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
