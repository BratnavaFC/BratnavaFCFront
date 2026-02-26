import { useEffect, useMemo, useState } from "react";
import { Section } from "../components/Section";
import { TeamColorApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { TeamColorCarousel } from "../domains/teamcolors/TeamColorCarousel";
import { PreviewModal } from "../components/PreviewModal";
import { TeamColorEditModal } from "../components/TeamColorEditModal";
import { useIsMobile } from "../hooks/useIsMobile";
import { isAdmin } from "../auth/guards"; // você já tem
// Se você tiver isGodMode, use também. Se não tiver, deixei fallback por role string/number abaixo.

type Item = any;

function isGodModeFallback(active: any) {
    const role = active?.role ?? active?.Role ?? active?.userRole;
    // ajuste conforme seu shape/enum:
    return role === "GodMode" || role === 2;
}

export default function TeamColorsPage() {
    const active = useAccountStore((s) => s.getActive());
    const groupId = active?.activeGroupId;

    const isMobile = useIsMobile(768);

    const canManage = !!active && (isAdmin(active) || isGodModeFallback(active));

    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);

    // seleção (carrossel)
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const selectedColor = useMemo(
        () => (selectedId ? items.find((i) => i.id === selectedId) : null),
        [items, selectedId]
    );

    async function load() {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await TeamColorApi.list(groupId);
            const data = res.data ?? [];
            setItems(data);

            if (!selectedId && data.length) {
                const activeIdx = data.findIndex((x: any) => x.isActive);
                setSelectedId(data[activeIdx >= 0 ? activeIdx : 0].id);
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    /* ---------- preview modal (sempre disponível) ---------- */
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<Item | null>(null);

    function openPreview(item: Item) {
        setPreviewItem(item);
        setPreviewOpen(true);
    }

    function openSelectedPreview() {
        if (!selectedColor) return;
        openPreview(selectedColor);
    }

    /* ---------- edit modal (somente admin/godmode) ---------- */
    const [editOpen, setEditOpen] = useState(false);
    const [editMode, setEditMode] = useState<"create" | "edit">("create");
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState("Preto");
    const [hexValue, setHexValue] = useState("#111827");

    function startCreate() {
        if (!canManage) return;
        setEditMode("create");
        setName("Preto");
        setHexValue("#111827");
        setEditOpen(true);
    }

    function startEditSelected() {
        if (!canManage) return;
        if (!selectedColor) return;
        setEditMode("edit");
        setName(selectedColor.name ?? "");
        setHexValue(selectedColor.hexValue ?? "#111827");
        setEditOpen(true);
    }

    function closeEdit() {
        setEditOpen(false);
    }

    async function saveEdit() {
        if (!canManage) return;
        if (!groupId) return;

        setSaving(true);
        try {
            if (editMode === "create") {
                await TeamColorApi.create(groupId, { name, hexValue } as any);
            } else {
                if (!selectedColor) return;
                const api: any = TeamColorApi as any;
                if (!api.update)
                    throw new Error("TeamColorApi.update não existe. Crie o endpoint/método.");
                await api.update(groupId, selectedColor.id, { name, hexValue });
            }

            await load();
            setEditOpen(false);
        } finally {
            setSaving(false);
        }
    }

    async function activateSelected() {
        if (!canManage) return;
        if (!groupId || !selectedColor) return;
        await TeamColorApi.activate(groupId, selectedColor.id);
        await load();
    }

    async function deactivateSelected() {
        if (!canManage) return;
        if (!groupId || !selectedColor) return;

        const api: any = TeamColorApi as any;
        if (!api.deactivate)
            throw new Error("TeamColorApi.deactivate não existe. Crie o endpoint/método.");

        await api.deactivate(groupId, selectedColor.id);
        await load();
    }

    return (
        <div className="space-y-4">
            <Section
                title="Uniformes (TeamColor)"
                right={
                    <span className="pill">
                        {loading ? "carregando..." : `${items.length} cores`}
                    </span>
                }
            >
                {!groupId ? (
                    <div className="muted">Selecione um Group no Dashboard.</div>
                ) : (
                    <div className="grid gap-4">
                        <div className="card p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-800">Cores</div>

                                {!isMobile ? (
                                    <button
                                        className="btn"
                                        onClick={openSelectedPreview}
                                        disabled={!selectedColor}
                                    >
                                        Ver selecionado
                                    </button>
                                ) : (
                                    <span className="pill">toque para visualizar</span>
                                )}
                            </div>

                            <div className="mt-3">
                                <TeamColorCarousel
                                    items={items}
                                    selectedId={selectedId}
                                    onSelectedIdChange={setSelectedId}
                                    readOnly={!canManage}
                                    isMobile={isMobile}
                                    onPreview={(item) => openPreview(item)}
                                />
                            </div>

                            {/* resumo + ações */}
                            {canManage ? (
                                <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="pill">Selecionado:</span>
                                        <span className="pill">{selectedColor?.name ?? "—"}</span>
                                        <span className="pill">{selectedColor?.hexValue ?? "—"}</span>
                                        {selectedColor?.isActive ? <span className="pill">Ativo</span> : null}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button className="btn" onClick={startCreate}>
                                            Nova cor
                                        </button>

                                        <button
                                            className="btn btn-primary"
                                            onClick={startEditSelected}
                                            disabled={!selectedColor}
                                        >
                                            Editar selecionado
                                        </button>

                                        {selectedColor?.isActive ? (
                                            <button
                                                className="btn"
                                                onClick={deactivateSelected}
                                                disabled={!selectedColor}
                                            >
                                                Inativar
                                            </button>
                                        ) : (
                                            <button
                                                className="btn"
                                                onClick={activateSelected}
                                                disabled={!selectedColor}
                                            >
                                                Ativar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="pill">Selecionado:</span>
                                        <span className="pill">{selectedColor?.name ?? "—"}</span>
                                        <span className="pill">{selectedColor?.hexValue ?? "—"}</span>
                                        {selectedColor?.isActive ? <span className="pill">Ativo</span> : null}
                                    </div>

                                    {isMobile ? (
                                        <button
                                            className="btn btn-primary"
                                            onClick={openSelectedPreview}
                                            disabled={!selectedColor}
                                        >
                                            Abrir preview
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Section>

            {/* Preview (read-only) */}
            <PreviewModal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                title="Preview do uniforme"
                item={previewItem ?? selectedColor ?? undefined}
                isMobile={isMobile}
            />

            {/* Edit/Create (admin/godmode) */}
            {canManage ? (
                <TeamColorEditModal
                    open={editOpen}
                    mode={editMode}
                    title={editMode === "create" ? "Nova cor" : "Editar cor"}
                    name={name}
                    hexValue={hexValue}
                    setName={setName}
                    setHexValue={setHexValue}
                    onSave={saveEdit}
                    onClose={closeEdit}
                    isMobile={isMobile}
                    saving={saving}
                />
            ) : null}
        </div>
    );
}