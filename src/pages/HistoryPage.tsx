import { useEffect, useState } from 'react';
import { Section } from '../components/Section';
import { MatchesApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { useNavigate } from 'react-router-dom';

export default function HistoryPage(){
  const nav = useNavigate();
  const groupId = useAccountStore(s => s.getActive()?.activeGroupId);
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
        {!groupId ? <div className="muted">Selecione um Group no Dashboard.</div> : (
          <div className="grid gap-2">
            {items.map(m => (
              <button key={m.id} className="btn justify-between" onClick={() => nav(`/app/history/${m.id}`)}>
                <span>{m.playedAt ? new Date(m.playedAt).toLocaleString() : m.id} • {m.statusName ?? m.status}</span>
                <span className="pill">Detalhes</span>
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
