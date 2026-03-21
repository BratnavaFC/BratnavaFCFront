import { useState } from 'react';
import { toast } from 'sonner';
import { Section } from '../components/Section';
import { Field } from '../components/Field';
import { PlayersApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { getResponseMessage } from '../api/apiResponse';

export default function PlayersPage(){
  const active = useAccountStore(s => s.getActive());
  const groupId = active?.activeGroupId;

  const [name, setName] = useState(active?.name ?? 'Jogador');
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [skillPoints, setSkillPoints] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  async function create(){
    if (!active?.userId || !groupId) return;
    setMsg(null);
    try {
      const res = await PlayersApi.create({
        name,
        userId: active.userId,
        groupId,
        skillPoints,
        isGoalkeeper,
        isGuest,
        status: 1
      } as any);
      const playerId = res.data?.id ?? res.data?.playerId;
      if (playerId) {
        useAccountStore.getState().updateActive({ activePlayerId: playerId });
        setMsg(`Player criado: ${playerId}`);
      } else {
        setMsg('Player criado.');
      }
    } catch (e) {
      toast.error(getResponseMessage(e, "Falha ao criar perfil."));
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Players (perfil por Group)">
        {!groupId ? <div className="muted">Selecione um Group no Dashboard.</div> : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-4 space-y-3">
              <Field label="Nome">
                <input className="input" value={name} onChange={(e)=>setName(e.target.value)} />
              </Field>
              <Field label="SkillPoints">
                <input className="input" type="number" value={skillPoints} onChange={(e)=>setSkillPoints(Number(e.target.value))} />
              </Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isGoalkeeper} onChange={(e)=>setIsGoalkeeper(e.target.checked)} />
                <span className="text-sm font-medium text-slate-700">Goleiro</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isGuest} onChange={(e)=>setIsGuest(e.target.checked)} />
                <span className="text-sm font-medium text-slate-700">Convidado</span>
              </label>

              <button className="btn btn-primary" onClick={create}>Criar perfil neste grupo</button>
              {msg ? <div className="text-sm text-emerald-700">{msg}</div> : null}
            </div>

          </div>
        )}
      </Section>
    </div>
  );
}
