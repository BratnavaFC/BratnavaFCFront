import { useEffect, useState } from 'react';
import { Section } from '../components/Section';
import { Field } from '../components/Field';
import { GroupSettingsApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';

export default function GroupSettingsPage(){
  const active = useAccountStore(s => s.getActive());
  const groupId = active?.activeGroupId;

  const [minPlayers, setMinPlayers] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [includeGoalkeepers, setIncludeGoalkeepers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(){
    if (!groupId) return;
    setLoading(true);
    try{
      const res = await GroupSettingsApi.get(groupId);
      const gs = res.data;
      if (gs){
        setMinPlayers(gs.minPlayers ?? minPlayers);
        setMaxPlayers(gs.maxPlayers ?? maxPlayers);
        setIncludeGoalkeepers(gs.includeGoalkeepers ?? includeGoalkeepers);
      }
    } finally { setLoading(false); }
  }

  async function save(){
    if (!groupId) return;
    setMsg(null);
    await GroupSettingsApi.upsert(groupId, {
      minPlayers,
      maxPlayers,
      includeGoalkeepers
    } as any);
    setMsg('Configurações salvas.');
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId]);

  return (
    <div className="space-y-6">
      <Section title="GroupSettings">
        {!groupId ? <div className="muted">Selecione um Group no Dashboard.</div> : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-4 space-y-3">
              <Field label="Min players">
                <input className="input" type="number" value={minPlayers} onChange={(e)=>setMinPlayers(Number(e.target.value))}/>
              </Field>
              <Field label="Max players">
                <input className="input" type="number" value={maxPlayers} onChange={(e)=>setMaxPlayers(Number(e.target.value))}/>
              </Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeGoalkeepers} onChange={(e)=>setIncludeGoalkeepers(e.target.checked)} />
                <span className="text-sm font-medium text-slate-700">Incluir goleiros</span>
              </label>

              <button className="btn btn-primary" onClick={save} disabled={loading}>Salvar</button>
              {msg ? <div className="text-sm text-emerald-700">{msg}</div> : null}
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold">Observação</div>
              <div className="muted mt-2">
                Este PUT é upsert (cadastra ou altera). O backend garante 1 GroupSettings por Group.
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
