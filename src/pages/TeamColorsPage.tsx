import { useEffect, useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Section } from '../components/Section';
import { Field } from '../components/Field';
import { TeamColorApi } from '../api/endpoints';
import { useAccountStore } from '../auth/accountStore';
import { UniformPreview } from '../domains/teamcolors/UniformPreview';
import { TeamColorCarousel } from '../domains/teamcolors/TeamColorCarousel';

type Item = any;

export default function TeamColorsPage() {
    const active = useAccountStore(s => s.getActive());
    const groupId = active?.activeGroupId;

    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);

    // seleção (carrossel)
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // modo edição
    const [isEditing, setIsEditing] = useState(false);

    // form
    const [name, setName] = useState('Preto');
    const [hexValue, setHexValue] = useState('#111827');

    const selectedColor = useMemo(
        () => (selectedId ? items.find(i => i.id === selectedId) : null),
        [items, selectedId]
    );

    // preview do form (live)
    const editPreview = useMemo(
        () => ({
            name: name?.trim() ? name.trim() : '—',
            hexValue: hexValue?.trim() ? hexValue.trim() : '#e2e8f0',
        }),
        [name, hexValue]
    );

    async function load() {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await TeamColorApi.list(groupId);
            const data = res.data ?? [];
            setItems(data);

            // se não tem seleção, tenta selecionar o ativo ou o primeiro
            if (!selectedId && data.length) {
                const activeIdx = data.findIndex((x: any) => x.isActive);
                setSelectedId(data[activeIdx >= 0 ? activeIdx : 0].id);
            }
        } finally {
            setLoading(false);
        }
    }

    function startCreate() {
        setIsEditing(true);
        setName('Preto');
        setHexValue('#111827');
    }

    function startEditSelected() {
        if (!selectedColor) return;
        setIsEditing(true);
        setName(selectedColor.name ?? '');
        setHexValue(selectedColor.hexValue ?? '#111827');
    }

    function cancelEdit() {
        setIsEditing(false);
        // opcional: resetar campos
        if (selectedColor) {
            setName(selectedColor.name ?? '');
            setHexValue(selectedColor.hexValue ?? '#111827');
        } else {
            setName('Preto');
            setHexValue('#111827');
        }
    }

    async function create() {
        if (!groupId) return;
        await TeamColorApi.create(groupId, { name, hexValue } as any);
        await load();
        setIsEditing(false);
    }

    async function update() {
        if (!groupId || !selectedColor) return;

        const api: any = TeamColorApi as any;
        if (!api.update) throw new Error('TeamColorApi.update não existe. Crie o endpoint/método.');

        await api.update(groupId, selectedColor.id, { name, hexValue });
        await load();
        setIsEditing(false);
    }

    async function activateSelected() {
        if (!groupId || !selectedColor) return;
        await TeamColorApi.activate(groupId, selectedColor.id);
        await load();
    }

    async function deactivateSelected() {
        if (!groupId || !selectedColor) return;

        const api: any = TeamColorApi as any;
        if (!api.deactivate) throw new Error('TeamColorApi.deactivate não existe. Crie o endpoint/método.');

        await api.deactivate(groupId, selectedColor.id);
        await load();
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

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
                        {/* CARROSSEL + BOTÕES FORA */}
                        <div className="card p-4 lg:col-span-2">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-800">Cores</div>
                                <span className="pill">Mostra 3 • centro destacado</span>
                            </div>

                            <div className="mt-3">
                                <TeamColorCarousel
                                    items={items}
                                    selectedId={selectedId}
                                    onSelectedIdChange={setSelectedId}
                                />
                            </div>

                            {/* ✅ Botões fora, sempre pro selecionado */}
                            <div className="mt-4 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="pill">Selecionado:</span>
                                    <span className="pill">{selectedColor?.name ?? '—'}</span>
                                    <span className="pill">{selectedColor?.hexValue ?? '—'}</span>
                                    {selectedColor?.isActive ? <span className="pill">Ativo</span> : null}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button className="btn" onClick={startCreate}>
                                        Nova cor
                                    </button>

                                    <button className="btn btn-primary" onClick={startEditSelected} disabled={!selectedColor}>
                                        Editar selecionado
                                    </button>

                                    {selectedColor?.isActive ? (
                                        <button className="btn" onClick={deactivateSelected} disabled={!selectedColor}>
                                            Inativar selecionado
                                        </button>
                                    ) : (
                                        <button className="btn" onClick={activateSelected} disabled={!selectedColor}>
                                            Ativar selecionado
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* FORM (só aparece quando estiver editando/criando) */}
                        {isEditing ? (
                            <div className="card p-4 lg:col-span-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-slate-800">
                                        {selectedColor ? 'Alterar cor selecionada' : 'Criar nova cor'}
                                    </div>
                                    <span className="pill">{selectedColor ? 'Editando' : 'Nova'}</span>
                                </div>

                                {/* preview pequeno live do FORM */}
                                <div className="mt-3 flex items-center gap-3">
                                    <div className="w-28 shrink-0">
                                        <UniformPreview hex={editPreview.hexValue} />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="text-sm text-slate-700 font-semibold">Preview (edição)</div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="pill">{editPreview.name}</span>
                                            <span className="pill">{editPreview.hexValue}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <Field label="Nome">
                                            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                                        </Field>

                                        <Field label="Hex (RGB)">
                                            <input className="input" value={hexValue} onChange={(e) => setHexValue(e.target.value)} />
                                        </Field>

                                        <div className="mt-3 space-y-2">
                                            {selectedColor ? (
                                                <button className="btn btn-primary w-full" onClick={update}>
                                                    Salvar alterações
                                                </button>
                                            ) : (
                                                <button className="btn btn-primary w-full" onClick={create}>
                                                    Salvar
                                                </button>
                                            )}

                                            <button className="btn w-full" onClick={cancelEdit}>
                                                Fechar
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <HexColorPicker color={hexValue} onChange={setHexValue} />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </Section>
        </div>
    );
}