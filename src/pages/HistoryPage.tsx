import { useEffect, useState } from "react";
import { Section } from "../components/Section";
import { MatchesApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { useNavigate } from "react-router-dom";

function getMatchId(m: any): string | null {
    const id = m?.matchId ?? m?.id ?? null;
    if (typeof id !== "string") return null;
    const t = id.trim();
    if (!t || t === "undefined" || t === "null") return null;
    return t;
}

export default function HistoryPage() {
    const nav = useNavigate();
    const groupId = useAccountStore((s) => s.getActive()?.activeGroupId);
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        (async () => {
            if (!groupId) return;
            const res = await MatchesApi.list(groupId);
            setItems(res.data ?? []);
        })();
    }, [groupId]);

    return (
        <div className="space-y-6">
            <Section title="Histórico rápido">
                {!groupId ? (
                    <div className="muted">Selecione um Group no Dashboard.</div>
                ) : (
                    <div className="grid gap-2">
                        {items.map((m) => {
                            const matchId = getMatchId(m);
                            if (!matchId) return null;

                            return (
                                <button
                                    key={matchId}
                                    className="btn justify-between"
                                    onClick={() => nav(`${groupId}/${matchId}`)} // ✅ relativo a /app/history
                                >
                                    <span>
                                        {m.playedAt ? new Date(m.playedAt).toLocaleString() : matchId} •{" "}
                                        {m.statusName ?? m.status}
                                    </span>
                                    <span className="pill">Detalhes</span>
                                </button>
                            );
                        })}
                        {items.length === 0 ? <div className="muted">Sem partidas ainda.</div> : null}
                    </div>
                )}
            </Section>
        </div>
    );
}