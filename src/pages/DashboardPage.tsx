import { useEffect, useMemo, useState } from 'react';
import { Section } from '../components/Section';
import { GroupsApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';

export default function DashboardPage(){
  const store = useAccountStore();
  const active = store.getActive();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const activeGroup = useMemo(() => groups.find(g => g.id === active?.activeGroupId), [groups, active?.activeGroupId]);

  async function load(){
    if (!active?.userId) return;
    setLoading(true);
    try {
      const res = await GroupsApi.listByAdmin(active.userId);
      setGroups(res.data ?? []);
      if (!active.activeGroupId && (res.data?.[0]?.id)) {
        store.updateActive({ activeGroupId: res.data[0].id });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active?.userId]);

  return (
    <div className="space-y-6">
      <Section
        title="Conta & Patota ativa"
        right={<span className="pill">{loading ? 'carregando...' : `${groups.length} grupos`}</span>}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="label">Conta ativa</div>
            <div className="text-lg font-semibold mt-1">{active?.name}</div>
            <div className="muted mt-1">{active?.userId}</div>
          </div>

          <div className="card p-4">
            <div className="label">Patota ativa (Group)</div>
            <div className="muted mt-1">Isso controla Players/Matches/TeamColor</div>

            <select
              className="input mt-3"
              value={active?.activeGroupId || ''}
              onChange={(e) => store.updateActive({ activeGroupId: e.target.value })}
            >
              <option value="" disabled>Selecione um grupo</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name ?? g.id}</option>)}
            </select>

            {activeGroup ? (
              <div className="mt-3 text-sm">
                <div><span className="font-semibold">Local padrão:</span> {activeGroup.defaultPlaceName ?? '—'}</div>
                <div><span className="font-semibold">Dia:</span> {activeGroup.defaultDayOfWeek ?? '—'} • <span className="font-semibold">Hora:</span> {activeGroup.defaultTime ?? '—'}</div>
              </div>
            ) : null}

            <button className="btn mt-3" onClick={load}>Recarregar grupos</button>
          </div>
        </div>
      </Section>

      <Section title="Próximos passos">
        <ul className="list-disc pl-5 text-slate-700 space-y-1">
          <li>Crie/edite grupos em <b>Patotas</b>.</li>
          <li>Como admin, configure <b>GroupSettings</b> e <b>Uniformes</b>.</li>
          <li>Inicie o fluxo de jogo em <b>Partidas</b> (wizard).</li>
        </ul>
      </Section>
    </div>
  );
}
