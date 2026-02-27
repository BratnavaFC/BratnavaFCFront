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
        <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="font-semibold">Jogo</div>
                    <div className="text-xs text-slate-500">{admin ? "Partida iniciada" : "Partida iniciada (visualização)."}</div>
                </div>

                {admin ? (
                    <div className="flex items-center gap-2">
                        <button className="btn" onClick={onRefresh}>Recarregar</button>
                        <button className="btn btn-primary" onClick={onEnd}>End</button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}