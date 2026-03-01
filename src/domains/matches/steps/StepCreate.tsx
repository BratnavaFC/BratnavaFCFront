import { cls } from "../matchUtils";

export function StepCreate({
    admin,
    placeName,
    setPlaceName,
    playedAtDate,
    setPlayedAtDate,
    playedAtTime,
    setPlayedAtTime,
    canCreateMatch,
    creating,
    onCreate,
    currentExistsInCreate,
}: {
    admin: boolean;
    placeName: string;
    setPlaceName: (v: string) => void;
    playedAtDate: string;
    setPlayedAtDate: (v: string) => void;
    playedAtTime: string;
    setPlayedAtTime: (v: string) => void;
    canCreateMatch: boolean;
    creating: boolean;
    onCreate: () => void;
    currentExistsInCreate: boolean;
}) {
    if (!admin) {
        return (
            <div className="card p-4">
                <div className="font-semibold">Aguardando o admin criar/selecionar uma partida</div>
                <div className="muted mt-1">Assim que houver uma partida ativa, ela aparecerá aqui automaticamente.</div>
            </div>
        );
    }

    return (
        <div className="card p-4 space-y-4">
            <div className="font-semibold">Criar nova partida</div>
            <div className="muted">Não pode criar sem <b>Local</b> e <b>Horário</b>.</div>

            <label className="block">
                <div className="label">Local (PlaceName) *</div>
                <input className="input" placeholder="Ex: Boca Jrs" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                    <div className="label">Data *</div>
                    <input className="input" type="date" value={playedAtDate} onChange={(e) => setPlayedAtDate(e.target.value)} />
                </label>

                <label className="block">
                    <div className="label">Horário *</div>
                    <input className="input" type="time" value={playedAtTime} onChange={(e) => setPlayedAtTime(e.target.value)} />
                </label>
            </div>

            <button
                className={cls("btn btn-primary", !canCreateMatch && "opacity-50 pointer-events-none")}
                disabled={!canCreateMatch}
                onClick={onCreate}
            >
                {creating ? "Criando..." : "Criar partida"}
            </button>

            {currentExistsInCreate ? (
                <div className="text-xs text-slate-500">
                    Existe uma partida em <b>status Created</b> carregada (draft). Por isso esta tela continua visível.
                </div>
            ) : null}
        </div>
    );
}