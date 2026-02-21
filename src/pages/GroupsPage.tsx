import { useEffect, useState } from "react";
import { Section } from "../components/Section";
import { Field } from "../components/Field";
import { GroupsApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { isAdmin } from "../auth/guards";

export default function GroupsPage() {
  const store = useAccountStore();
  const active = store.getActive();
  const admin = isAdmin();

  const [items, setItems] = useState<any[]>([]);
  const [groupIdManual, setGroupIdManual] = useState(active?.activeGroupId ?? "");

  const [name, setName] = useState("Bratnava FC");
  const [place, setPlace] = useState("Boca Jrs");
  const [dayOfWeek, setDayOfWeek] = useState(2);
  const [time, setTime] = useState("20:00");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ Tenta carregar grupos apenas se existir endpoint compatível.
  // Se não existir, não chama nada para evitar erro.
  async function tryLoad() {
    setLoading(true);
    setMsg(null);
    try {
      // ⚠️ Se seu backend NÃO tiver listagem, comentado por padrão:
      // const res = await GroupsApi.listMine(); // exemplo de endpoint ideal
      // setItems(res.data ?? []);

      setItems([]); // sem listagem
      setMsg("Seu backend não possui endpoint de listagem de grupos. Use o GroupId manual abaixo.");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!active?.userId) return;
    setMsg(null);

    await GroupsApi.create({
      name,
      adminUserId: active.userId, // se seu backend usa outro nome, me diga
      defaultPlaceName: place,
      defaultDayOfWeek: dayOfWeek,
      defaultTime: time,
    } as any);

    setMsg("Grupo criado! Copie o ID no Swagger e cole no campo 'GroupId manual'.");
  }

  function setActiveGroup() {
    if (!groupIdManual) return;
    store.updateActive({ activeGroupId: groupIdManual });
    setMsg("Group ativo atualizado.");
  }

  useEffect(() => {
    tryLoad();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="space-y-6">
      <Section
        title="Patotas (Groups)"
        right={<span className="pill">{loading ? "carregando..." : `${items.length} grupos`}</span>}
      >
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-4 space-y-3">
            <div className="text-sm font-semibold">Selecionar Group (manual)</div>
            <div className="muted">
              Como seu backend não tem listagem por adminId, selecione informando o GroupId.
            </div>

            <Field label="GroupId (GUID)">
              <input
                className="input"
                value={groupIdManual}
                onChange={(e) => setGroupIdManual(e.target.value)}
                placeholder="cole aqui o GUID do group"
              />
            </Field>

            <button className="btn btn-primary w-full" onClick={setActiveGroup}>
              Usar este Group
            </button>

            <div className="muted">
              Group ativo atual: <b>{active?.activeGroupId ?? "—"}</b>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-sm font-semibold">Criar grupo</div>
            {!admin ? (
              <div className="muted mt-2">Você não é admin. Mesmo assim, pode testar a criação se o backend permitir.</div>
            ) : null}

            <div className="mt-3 space-y-3">
              <Field label="Nome">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Local padrão">
                <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dia (0-6)">
                  <input
                    className="input"
                    type="number"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  />
                </Field>
                <Field label="Hora">
                  <input className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
              </div>

              <button className="btn btn-primary w-full" onClick={create}>
                Criar
              </button>
            </div>
          </div>
        </div>

        {msg ? <div className="text-sm text-emerald-700 mt-4">{msg}</div> : null}
      </Section>
    </div>
  );
}