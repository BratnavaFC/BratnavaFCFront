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
        <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="font-semibold">Encerrar</div>
                    <div className="text-xs text-slate-500">
                        {admin ? "Partida encerrada. Avance para o Pós-jogo." : "Partida encerrada. Aguardando admin ir para Pós-jogo."}
                    </div>
                </div>

                {admin ? (
                    <div className="flex items-center gap-2">
                        <button className="btn" onClick={onRefresh}>Recarregar</button>
                        <button className="btn btn-primary" onClick={onGoToPostGame}>Ir para Pós-jogo</button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}