import { useEffect, useState } from 'react';
import { Section } from '../components/Section';
import { Field } from '../components/Field';
import { GroupSettingsApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';

const DAY_OPTIONS = [
    { value: '', label: 'Sem padrão' },
    { value: '0', label: 'Domingo' },
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terça-feira' },
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sábado' },
];

export default function GroupSettingsPage() {
    const active = useAccountStore((s) => s.getActive());
    const groupId = active?.activeGroupId;

    // ── player limits ──────────────────────────────────────────────
    const [minPlayers, setMinPlayers] = useState(5);
    const [maxPlayers, setMaxPlayers] = useState(6);

    // ── match defaults ─────────────────────────────────────────────
    const [defaultPlaceName, setDefaultPlaceName] = useState('');
    const [defaultDayOfWeek, setDefaultDayOfWeek] = useState<string>(''); // '' = no default
    const [defaultKickoffTime, setDefaultKickoffTime] = useState('');     // "HH:mm" for <input type="time">

    // ── status ─────────────────────────────────────────────────────
    const [isPersisted, setIsPersisted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

    // ── load ───────────────────────────────────────────────────────
    async function load() {
        if (!groupId) return;
        setLoading(true);
        setMsg(null);
        try {
            const res = await GroupSettingsApi.get(groupId);
            const gs = res.data as any;
            if (gs) {
                setMinPlayers(gs.minPlayers ?? 5);
                setMaxPlayers(gs.maxPlayers ?? 6);
                setDefaultPlaceName(gs.defaultPlaceName ?? '');
                // defaultDayOfWeek: backend sends int (0-6) or null
                setDefaultDayOfWeek(
                    gs.defaultDayOfWeek != null ? String(gs.defaultDayOfWeek) : ''
                );
                // defaultKickoffTime: backend TimeSpan → "HH:mm:ss", strip seconds for <input type="time">
                setDefaultKickoffTime(
                    gs.defaultKickoffTime ? gs.defaultKickoffTime.slice(0, 5) : ''
                );
                setIsPersisted(gs.isPersisted ?? false);
            }
        } catch {
            setMsg({ text: 'Erro ao carregar configurações.', ok: false });
        } finally {
            setLoading(false);
        }
    }

    // ── save ───────────────────────────────────────────────────────
    async function save() {
        if (!groupId) return;
        setMsg(null);
        setSaving(true);
        try {
            await GroupSettingsApi.upsert(groupId, {
                minPlayers,
                maxPlayers,
                defaultPlaceName: defaultPlaceName.trim() || null,
                defaultDayOfWeek: defaultDayOfWeek !== '' ? Number(defaultDayOfWeek) : null,
                // "HH:mm" → "HH:mm:ss" so the backend can parse it as a TimeSpan
                defaultKickoffTime: defaultKickoffTime ? `${defaultKickoffTime}:00` : null,
            } as any);
            setIsPersisted(true);
            setMsg({ text: 'Configurações salvas com sucesso.', ok: true });
        } catch (e: any) {
            const detail =
                e?.response?.data?.error ??
                e?.response?.data?.message ??
                e?.message ??
                'Erro ao salvar.';
            setMsg({ text: detail, ok: false });
        } finally {
            setSaving(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    if (!groupId) {
        return (
            <div className="space-y-6">
                <Section title="Configurações do Grupo">
                    <div className="muted">Selecione um grupo no Dashboard.</div>
                </Section>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Section title="Configurações do Grupo">
                {loading ? (
                    <div className="muted">Carregando…</div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">

                        {/* ── Jogadores ──────────────────────────────────── */}
                        <div className="card p-4 space-y-4">
                            <div className="font-semibold text-slate-900">Jogadores por partida</div>

                            <Field label="Mínimo de jogadores">
                                <input
                                    className="input"
                                    type="number"
                                    min={2}
                                    max={maxPlayers}
                                    value={minPlayers}
                                    onChange={(e) => setMinPlayers(Number(e.target.value))}
                                />
                            </Field>

                            <Field label="Máximo de jogadores">
                                <input
                                    className="input"
                                    type="number"
                                    min={minPlayers}
                                    value={maxPlayers}
                                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                                />
                            </Field>
                        </div>

                        {/* ── Padrões de Partida ─────────────────────────── */}
                        <div className="card p-4 space-y-4">
                            <div className="font-semibold text-slate-900">Padrões de partida</div>

                            <Field label="Local padrão">
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Ex: Boca Jrs"
                                    maxLength={120}
                                    value={defaultPlaceName}
                                    onChange={(e) => setDefaultPlaceName(e.target.value)}
                                />
                            </Field>

                            <Field label="Dia da semana padrão">
                                <select
                                    className="input"
                                    value={defaultDayOfWeek}
                                    onChange={(e) => setDefaultDayOfWeek(e.target.value)}
                                >
                                    {DAY_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Horário padrão">
                                <input
                                    className="input"
                                    type="time"
                                    value={defaultKickoffTime}
                                    onChange={(e) => setDefaultKickoffTime(e.target.value)}
                                />
                            </Field>
                        </div>

                        {/* ── Ações ──────────────────────────────────────── */}
                        <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3">
                            <button
                                className="btn btn-primary"
                                onClick={save}
                                disabled={saving || loading}
                            >
                                {saving ? 'Salvando…' : 'Salvar configurações'}
                            </button>

                            {msg && (
                                <span className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {msg.text}
                                </span>
                            )}

                            {!isPersisted && !msg && (
                                <span className="text-xs text-amber-600">
                                    ⚠ Configurações ainda não salvas — usando valores padrão.
                                </span>
                            )}
                        </div>

                        {/* ── Info ───────────────────────────────────────── */}
                        <div className="md:col-span-2 card p-4 text-sm text-slate-600 space-y-1">
                            <div className="font-semibold text-slate-800">Como funciona</div>
                            <div>• <b>Local</b> e <b>Horário</b> são pré-preenchidos no formulário "Criar partida".</div>
                            <div>• <b>Mínimo/Máximo de jogadores</b> controla a lista de aceitos na etapa de aceitação.</div>
                            <div>• O <b>Horário</b> é salvo como TimeSpan no banco — formato <code>HH:mm</code> no formulário.</div>
                        </div>

                    </div>
                )}
            </Section>
        </div>
    );
}
