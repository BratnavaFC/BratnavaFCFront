import { useEffect, useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Section } from '../components/Section';
import { Field } from '../components/Field';
import { TeamColorApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { UniformPreview } from '../domains/teamcolors/UniformPreview';

type Item = any;

export default function TeamColorsPage(){
  const active = useAccountStore(s => s.getActive());
  const groupId = active?.activeGroupId;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('Preto');
  const [hexValue, setHexValue] = useState('#111827');

  const activeColor = useMemo(() => items.find(i => i.isActive), [items]);

  async function load(){
    if (!groupId) return;
    setLoading(true);
    try{
      const res = await TeamColorApi.list(groupId);
      setItems(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function create(){
    if (!groupId) return;
    await TeamColorApi.create(groupId, { name, hexValue } as any);
    await load();
  }

  async function activate(colorId: string){
    if (!groupId) return;
    await TeamColorApi.activate(groupId, colorId);
    await load();
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId]);

  return (
    <div className="space-y-6">
      <Section
        title="Uniformes (TeamColor)"
        right={<span className="pill">{loading ? 'carregando...' : `${items.length} cores`}</span>}
      >
        {!groupId ? (
          <div className="muted">Selecione um Group no Dashboard.</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-800">Preview (ativo)</div>
              <div className="mt-2">
                <UniformPreview hex={activeColor?.hexValue ?? '#e2e8f0'} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="pill">{activeColor?.name ?? '—'}</span>
                <span className="pill">{activeColor?.hexValue ?? '—'}</span>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-800">Criar/alterar cor</div>
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div>
                  <Field label="Nome">
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Hex (RGB)">
                    <input className="input" value={hexValue} onChange={(e) => setHexValue(e.target.value)} />
                  </Field>
                  <button className="btn btn-primary mt-3 w-full" onClick={create}>Salvar</button>
                </div>
                <div>
                  <HexColorPicker color={hexValue} onChange={setHexValue} />
                </div>
              </div>
            </div>

            <div className="card p-4 lg:col-span-2">
              <div className="text-sm font-semibold text-slate-800">Lista</div>
              <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(c => (
                  <div key={c.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{c.name}</div>
                      {c.isActive ? <span className="pill">Ativo</span> : null}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg border" style={{ background: c.hexValue }} />
                      <div className="text-sm text-slate-600">{c.hexValue}</div>
                    </div>
                    <button className="btn mt-3 w-full" onClick={() => activate(c.id)}>Ativar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
