import { RefreshCw, StopCircle } from "lucide-react";

export function StepPlaying({
    admin,
    onRefresh,
    onEnd,
}: {
    admin: boolean;
    onRefresh: () => void;
    onEnd: () => void;
}) {
    return (
        <div className="card overflow-hidden p-0">
            {/* Emerald accent strip */}
            <div className="h-1 w-full bg-emerald-500" />

            <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {/* Pulsing live indicator */}
                        <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 shrink-0">
                            <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
                        </div>

                        <div>
                            <div className="font-semibold text-slate-900">Em Jogo</div>
                            <div className="text-xs text-slate-500">
                                {admin
                                    ? "Partida em andamento."
                                    : "Partida em andamento (visualização)."}
                            </div>
                        </div>
                    </div>

                    {admin ? (
                        <div className="flex items-center gap-2">
                            <button
                                className="btn flex items-center gap-1.5"
                                onClick={onRefresh}
                                title="Recarregar"
                            >
                                <RefreshCw size={14} />
                                <span className="hidden sm:inline">Recarregar</span>
                            </button>

                            <button
                                className="btn flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white border-transparent"
                                onClick={onEnd}
                                title="Encerrar partida"
                            >
                                <StopCircle size={14} />
                                Encerrar
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
