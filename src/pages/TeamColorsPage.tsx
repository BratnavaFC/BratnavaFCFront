import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TeamColorApi } from "../api/endpoints";
import { useAccountStore } from "../auth/accountStore";
import { TeamColorCarousel } from "../domains/teamcolors/TeamColorCarousel";
import { PreviewModal } from "../components/modals/PreviewModal";
import { TeamColorEditModal } from "../components/modals/TeamColorEditModal";
import { useIsMobile } from "../hooks/UseIsMobile";
import { isAdmin, isGroupAdmin } from "../auth/guards";
import { getResponseMessage } from "../api/apiResponse";
import { Eye, Loader2, Palette, Pencil, Plus, Power } from "lucide-react";

type Item = any;

export default function TeamColorsPage() {
    const active = useAccountStore((s) => s.getActive());
    const groupId = active?.activeGroupId;

    const isMobile = useIsMobile(768);

    const canManage = !!active && (isAdmin() || isGroupAdmin(groupId ?? ""));

    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);

    // seleção (carrossel)
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // non-admin only sees active colors
    const displayItems = useMemo(
        () => canManage ? items : items.filter((i: any) => i.isActive),
        [items, canManage]
    );

    // if selectedId falls outside displayItems (e.g. inactive selected before auth loaded), reset it
    const prevDisplayRef = useRef<Item[]>([]);
    useEffect(() => {
        if (prevDisplayRef.current === displayItems) return;
        prevDisplayRef.current = displayItems;
        if (!displayItems.length) { setSelectedId(null); return; }
        if (selectedId && displayItems.some((i: any) => i.id === selectedId)) return;
        setSelectedId(displayItems[0].id);
    }, [displayItems, selectedId]);

    const selectedColor = useMemo(
        () => (selectedId ? items.find((i) => i.id === selectedId) : null),
        [items, selectedId]
    );

    async function load() {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await TeamColorApi.list(groupId);
            const data = res.data?.data ?? [];
            setItems(data);

            if (!selectedId && data.length) {
                setSelectedId(data[0].id ?? null);
            }
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar uniformes."));
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
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao salvar cor."));
        } finally {
            setSaving(false);
        }
    }

    async function activateSelected() {
        if (!canManage) return;
        if (!groupId || !selectedColor) return;
        try {
            await TeamColorApi.activate(groupId, selectedColor.id);
            await load();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao ativar cor."));
        }
    }

    async function deactivateSelected() {
        if (!canManage) return;
        if (!groupId || !selectedColor) return;
        try {
            await TeamColorApi.deactivate(groupId, selectedColor.id);
            await load();
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao inativar cor."));
        }
    }

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="page-header">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon">
                            <Palette size={18} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black leading-tight">Uniformes</h1>
                            <p className="text-xs text-white/60 mt-0.5">
                                {loading
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>
                                    : `${displayItems.length} cor${displayItems.length !== 1 ? 'es' : ''} disponível${displayItems.length !== 1 ? 'is' : ''}`}
                            </p>
                        </div>
                    </div>
                    {canManage && (
                        <button
                            onClick={startCreate}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 shadow-sm"
                        >
                            <Plus size={15} /> Nova cor
                        </button>
                    )}
                </div>
            </div>

            {/* ── Conteúdo ── */}
            {!groupId ? (
                <div className="card p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">
                    <Palette size={36} className="opacity-30" />
                    <span className="text-sm">Selecione um grupo no Dashboard.</span>
                </div>
            ) : (
                <div className="card p-0 overflow-hidden shadow-sm dark:shadow-none dark:ring-1 dark:ring-slate-700/50">

                    {/* Carousel */}
                    <div className="p-5">
                        {!isMobile && (
                            <div className="flex justify-end mb-4">
                                <button
                                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-sm dark:shadow-none"
                                    onClick={openSelectedPreview}
                                    disabled={!selectedColor}
                                >
                                    <Eye size={14} /> Ver selecionado
                                </button>
                            </div>
                        )}
                        <TeamColorCarousel
                            items={displayItems}
                            selectedId={selectedId}
                            onSelectedIdChange={setSelectedId}
                            readOnly={!canManage}
                            isMobile={isMobile}
                            onPreview={(item) => openPreview(item)}
                        />
                    </div>

                    {/* Barra de ações */}
                    {canManage ? (
                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 flex-wrap">
                            <button
                                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-sm dark:shadow-none disabled:opacity-50"
                                onClick={startEditSelected}
                                disabled={!selectedColor}
                            >
                                <Pencil size={14} /> Editar selecionado
                            </button>
                            {selectedColor?.isActive ? (
                                <button
                                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors shadow-sm disabled:opacity-50"
                                    onClick={deactivateSelected}
                                    disabled={!selectedColor}
                                >
                                    <Power size={14} /> Inativar
                                </button>
                            ) : (
                                <button
                                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors shadow-sm disabled:opacity-50"
                                    onClick={activateSelected}
                                    disabled={!selectedColor}
                                >
                                    <Power size={14} /> Ativar
                                </button>
                            )}
                        </div>
                    ) : isMobile ? (
                        <div className="flex justify-end px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50">
                            <button
                                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                                onClick={openSelectedPreview}
                                disabled={!selectedColor}
                            >
                                <Eye size={14} /> Abrir preview
                            </button>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Preview modal */}
            <PreviewModal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                title="Preview do uniforme"
                item={previewItem ?? selectedColor ?? undefined}
                isMobile={isMobile}
            />

            {/* Edit/Create modal */}
            {canManage && (
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
            )}
        </div>
    );
}