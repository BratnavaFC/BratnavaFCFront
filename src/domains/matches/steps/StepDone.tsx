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
    return (
        <div className="card p-4">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-semibold">Finalizada</div>
                    <div className="text-xs text-slate-500">{admin ? "Partida encerrada e contabilizada." : "Visualização."}</div>
                </div>

                {admin ? <button className="btn" onClick={onReload}>Atualizar</button> : null}
            </div>

            <div className="mt-3 text-sm">
                Placar: <b>{scoreA ?? "—"}</b> x <b>{scoreB ?? "—"}</b>
            </div>
            <div className="mt-1 text-sm">
                MVP: <b>{mvp || "—"}</b>
            </div>
        </div>
    );
}