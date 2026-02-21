import { useEffect, useMemo, useState } from 'react';
import { Section } from '../components/Section';
import { Stepper, Step } from '../components/Stepper';
import { MatchesApi, TeamGenApi, TeamColorApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { isAdmin } from '../auth/guards';

export default function MatchesPage(){
  const store = useAccountStore();
  const active = store.getActive();
  const groupId = active?.activeGroupId;
  const admin = isAdmin();

  const [matches, setMatches] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null);
  const [teamColors, setTeamColors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [strategyType, setStrategyType] = useState(0); // StrategyType
  const [includeGoalkeepers, setIncludeGoalkeepers] = useState(true);
  const [playersPerTeam, setPlayersPerTeam] = useState(6);

  const stepKey = useMemo(() => {
    const status = current?.statusName ?? current?.status;
    // heurística: você pode ajustar de acordo com os nomes do backend
    if (!current) return 'create';
    if (status === 'Created' || status === 0) return 'invite';
    if (status === 'TeamsGenerated' || status === 1) return 'teams';
    if (status === 'Started' || status === 2) return 'playing';
    if (status === 'Ended' || status === 3) return 'post';
    if (status === 'Finalized' || status === 4) return 'done';
    return 'invite';
  }, [current]);

  const steps: Step[] = [
    { key: 'create', title: 'Criar', subtitle: 'Nova partida' },
    { key: 'invite', title: 'Convites', subtitle: 'Aceitar/Inserir players' },
    { key: 'teams', title: 'Times', subtitle: 'Gerar / swap / setar' },
    { key: 'playing', title: 'Jogo', subtitle: 'Start / End' },
    { key: 'post', title: 'Pós-jogo', subtitle: 'MVP / Gols / Placar' },
    { key: 'done', title: 'Final', subtitle: 'Finalize' },
  ].map(s => ({ ...s, done: stepsOrderDone(s.key, stepKey) }));

  function stepsOrderDone(k: string, activeK: string){
    const order = ['create','invite','teams','playing','post','done'];
    return order.indexOf(k) < order.indexOf(activeK);
  }

  async function load(){
    if (!groupId) return;
    setLoading(true);
    try{
      const res = await MatchesApi.list(groupId);
      const list = res.data ?? [];
      setMatches(list);
      // tenta achar uma "em andamento" (não finalizada)
      const inProgress = list.find((m: any) => (m.statusName !== 'Finalized' && m.status !== 4)) ?? list[0] ?? null;
      setCurrent(inProgress);
      const colors = await TeamColorApi.list(groupId);
      setTeamColors(colors.data ?? []);
    } finally { setLoading(false); }
  }

  async function createMatch(){
    if (!groupId) return;
    await MatchesApi.create(groupId, { } as any);
    await load();
  }

  async function syncPlayers(){
    if (!groupId || !current?.id) return;
    await MatchesApi.syncPlayers(groupId, current.id);
    await load();
  }

  async function generateTeams(){
    if (!groupId) return;
    const req = {
      groupId,
      strategyType,
      playersPerTeam,
      includeGoalkeepers
    } as any;
    const res = await TeamGenApi.generate(req);
    // backend retorna TeamsResultDto. Aqui guardamos no state temporário.
    setCurrent((c: any) => ({ ...c, generatedTeams: res.data }));
  }

  async function setColorsRandom(){
    if (!groupId || !current?.id) return;
    const a = teamColors[0];
    const b = teamColors[1] ?? teamColors[0];
    if (!a || !b) return;
    await MatchesApi.setColors(groupId, current.id, { teamAColorId: a.id, teamBColorId: b.id } as any);
    await load();
  }

  async function start(){
    if (!groupId || !current?.id) return;
    await MatchesApi.start(groupId, current.id);
    await load();
  }

  async function end(){
    if (!groupId || !current?.id) return;
    await MatchesApi.end(groupId, current.id);
    await load();
  }

  async function finalize(){
    if (!groupId || !current?.id) return;
    await MatchesApi.finalize(groupId, current.id);
    await load();
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId]);

  return (
    <div className="space-y-6">
      <Section title="Partida (Match Wizard)" right={<span className="pill">{loading ? 'carregando...' : (current ? 'em andamento' : 'sem partida')}</span>}>
        {!groupId ? <div className="muted">Selecione um Group no Dashboard.</div> : (
          <div className="space-y-4">
            <Stepper steps={steps} activeKey={stepKey} />

            {!current ? (
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">Nenhuma partida em andamento</div>
                  <div className="muted">Crie uma nova para iniciar o fluxo.</div>
                </div>
                <button className="btn btn-primary" onClick={createMatch}>Criar partida</button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="card p-4">
                  <div className="font-semibold">Partida atual</div>
                  <div className="muted mt-1">ID: {current.id}</div>
                  <div className="muted">Status: {String(current.statusName ?? current.status)}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn" onClick={syncPlayers}>Sync players</button>
                    {admin ? <button className="btn" onClick={setColorsRandom}>Setar cores</button> : null}
                    {admin ? <button className="btn" onClick={generateTeams}>Gerar times</button> : null}
                    {admin ? <button className="btn btn-primary" onClick={start}>Start</button> : null}
                    {admin ? <button className="btn" onClick={end}>End</button> : null}
                    {admin ? <button className="btn btn-primary" onClick={finalize}>Finalize</button> : null}
                  </div>
                </div>

                <div className="card p-4">
                  <div className="font-semibold">TeamGeneration (config)</div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <label className="block">
                      <div className="label">StrategyType</div>
                      <input className="input" type="number" value={strategyType} onChange={(e)=>setStrategyType(Number(e.target.value))} />
                    </label>
                    <label className="block">
                      <div className="label">Players/Team</div>
                      <input className="input" type="number" value={playersPerTeam} onChange={(e)=>setPlayersPerTeam(Number(e.target.value))} />
                    </label>
                    <label className="block">
                      <div className="label">Include GK</div>
                      <input className="input" value={includeGoalkeepers ? 'true' : 'false'} readOnly />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 mt-3">
                    <input type="checkbox" checked={includeGoalkeepers} onChange={(e)=>setIncludeGoalkeepers(e.target.checked)} />
                    <span className="text-sm font-medium text-slate-700">Incluir goleiros</span>
                  </label>

                  {current.generatedTeams ? (
                    <div className="mt-4">
                      <div className="text-sm font-semibold">Times gerados (preview)</div>
                      <pre className="mt-2 text-xs bg-slate-900 text-slate-50 rounded-xl p-3 overflow-auto max-h-64">
{JSON.stringify(current.generatedTeams, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="muted mt-3">Gere times para visualizar aqui.</div>
                  )}
                </div>
              </div>
            )}

            <div className="card p-4">
              <div className="font-semibold">Lista rápida</div>
              <div className="muted">Clique para selecionar a partida</div>
              <div className="mt-3 grid gap-2">
                {matches.map(m => (
                  <button key={m.id} className="btn justify-between" onClick={() => setCurrent(m)}>
                    <span>{m.playedAt ? new Date(m.playedAt).toLocaleString() : 'Partida'} • {m.statusName ?? m.status}</span>
                    <span className="pill">{m.id === current?.id ? 'Selecionada' : 'Abrir'}</span>
                  </button>
                ))}
                {matches.length === 0 ? <div className="muted">Sem partidas ainda.</div> : null}
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
