// src/pages/GroupsPage.tsx
import { useEffect, useState } from "react";
import { Section } from "../components/Section";
import { GroupsApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { Loader2 } from "lucide-react";

type PlayerDto = {
    id: string;
    name: string;
    skillPoints: number;
    isGoalkeeper: boolean;
    isGuest: boolean;
    status: number;
};

type GroupDto = {
    id: string;
    name: string;
    players: PlayerDto[];
};

export default function GroupsPage() {
    const active = useAccountStore((s) => s.getActive());
    const activeGroupId = active?.activeGroupId ?? "";
    const activePlayerId = active?.activePlayerId ?? "";

    const [group, setGroup] = useState<GroupDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeGroupId) {
            setGroup(null);
            return;
        }
        setLoading(true);
        setError(null);
        GroupsApi.get(activeGroupId)
            .then((res) => setGroup(res.data as GroupDto))
            .catch(() => setError("Nao foi possivel carregar os dados da patota."))
            .finally(() => setLoading(false));
    }, [activeGroupId]);

    const activePlayers = group?.players?.filter((p) => p.status === 1) ?? [];

    return (
        <div className="space-y-6">
            <Section
                title={group ? group.name : "Patotas (Groups)"}
                right={
                    loading
                        ? <Loader2 size={16} className="animate-spin text-slate-400" />
                        : group
                        ? <span className="pill">{activePlayers.length} jogadores</span>
                        : null
                }
            >
                {!activeGroupId ? (
                    <div className="muted">Selecione sua patota pelo seletor no topo da pagina.</div>
                ) : error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
                ) : loading ? (
                    <div className="muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando...</div>
                ) : activePlayers.length === 0 ? (
                    <div className="muted">Nenhum jogador ativo nesta patota.</div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                        {activePlayers.map((p) => {
                            const isMe = p.id === activePlayerId;
                            return (
                                <div
                                    key={p.id}
                                    className={[
                                        "rounded-xl border px-4 py-3 bg-white flex items-center justify-between gap-3",
                                        isMe ? "border-emerald-400" : "border-slate-200",
                                    ].join(" ")}
                                >
                                    <div className="min-w-0">
                                        <div className="font-semibold truncate flex items-center gap-2">
                                            {p.name}
                                            {p.isGoalkeeper && <span className="text-xs">🧤</span>}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Habilidade: {p.skillPoints}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {p.isGuest && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                                                Convidado
                                            </span>
                                        )}
                                        {isMe && <span className="pill">Voce</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>
        </div>
    );
}
