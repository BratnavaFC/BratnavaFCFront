import { useState } from 'react';
import { Section } from '../../components/Section';
import { Field } from '../../components/Field';
import { UsersApi } from '../../api/endpoints';

export default function UsersAdminPage(){
  const [userId, setUserId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function inactivate(){
    setMsg(null);
    await UsersApi.inactivate(userId);
    setMsg('Usuário inativado.');
  }
  async function reactivate(){
    setMsg(null);
    await UsersApi.reactivate(userId);
    setMsg('Usuário reativado.');
  }

  return (
    <div className="space-y-6">
      <Section title="Admin: Usuários">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4 space-y-3">
            <Field label="UserId">
              <input className="input" value={userId} onChange={(e)=>setUserId(e.target.value)} placeholder="GUID do usuário" />
            </Field>
            <div className="flex gap-2">
              <button className="btn btn-danger" onClick={inactivate}>Inativar</button>
              <button className="btn btn-primary" onClick={reactivate}>Reativar</button>
            </div>
            {msg ? <div className="text-sm text-emerald-700">{msg}</div> : null}
          </div>

          <div className="card p-4">
            <div className="text-sm font-semibold">Obs</div>
            <div className="muted mt-2">
              O swagger não expõe listagem de usuários, então aqui é por UserId.
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
