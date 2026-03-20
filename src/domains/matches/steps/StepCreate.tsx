import { Calendar, Clock, Loader2, MapPin, Plus } from "lucide-react";
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
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Clock size={22} className="text-slate-400" />
                </div>
                <div>
                    <div className="font-semibold text-slate-800">Aguardando o admin criar uma partida</div>
                    <div className="mt-1 text-sm text-slate-500">
                        Assim que houver uma partida ativa, ela aparecerá aqui automaticamente.
                    </div>
                </div>
            </div>
        );
    }

    const placeOk = placeName.trim().length > 0;
    const dateOk  = /^\d{4}-\d{2}-\d{2}$/.test(playedAtDate);
    const timeOk  = /^\d{2}:\d{2}$/.test(playedAtTime);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div>
                <div className="font-semibold text-slate-900">Criar nova partida</div>
            </div>

            {/* Local */}
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Local *</label>
                <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        className={cls(
                            "input pl-8 w-full transition-colors",
                            placeOk ? "border-emerald-400 focus:ring-emerald-300" : ""
                        )}
                        placeholder="Ex: Quadra do Boca Jrs"
                        value={placeName}
                        onChange={(e) => setPlaceName(e.target.value)}
                    />
                    {placeOk && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center pointer-events-none">
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    )}
                </div>
            </div>

            {/* Data + Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Data *</label>
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            className={cls(
                                "input pl-8 w-full transition-colors",
                                dateOk ? "border-emerald-400 focus:ring-emerald-300" : ""
                            )}
                            type="date"
                            value={playedAtDate}
                            onChange={(e) => setPlayedAtDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Horário *</label>
                    <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            className={cls(
                                "input pl-8 w-full transition-colors",
                                timeOk ? "border-emerald-400 focus:ring-emerald-300" : ""
                            )}
                            type="time"
                            value={playedAtTime}
                            onChange={(e) => setPlayedAtTime(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <button
                type="button"
                className="btn btn-primary w-full flex items-center justify-center gap-2"
                disabled={!canCreateMatch}
                onClick={onCreate}
            >
                {creating
                    ? <><Loader2 size={15} className="animate-spin" /> Criando...</>
                    : <><Plus size={15} /> Criar partida</>
                }
            </button>

            {currentExistsInCreate && (
                <div className="text-xs text-slate-400 text-center">
                    Existe uma partida em status <b>Created</b> (rascunho) carregada.
                </div>
            )}
        </div>
    );
}
