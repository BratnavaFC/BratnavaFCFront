import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Section } from "../../components/Section";
import useAccountStore from "../../auth/accountStore";
import { GroupInvitesApi, UsersApi, PaymentsApi } from "../../api/endpoints";
import { useInviteStore } from "../../stores/inviteStore";
import { getResponseMessage } from "../../api/apiResponse";
import {
    Shield,
    User,
    Pencil,
    Search,
    ChevronLeft,
    ChevronRight,
    KeyRound,
    X,
    Check,
    Loader2,
    Bell,
    UserCheck,
    UserX,
    CheckCircle2,
    AlertCircle,
    CreditCard,
    Users2,
} from "lucide-react";

type Status = 1 | 2; // 1 Active, 2 Inactive
type Role = 1 | 2 | 3; // 1 User, 2 Admin, 3 GodMode

type UserListItemDto = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    birthDate?: string | null;

    role: number;   // 1/2/3
    status: number; // 1/2

    createDate?: string | null;
    updateDate?: string | null;
    inactivatedAt?: string | null;
};

type PagedResultDto<T> = {
    page: number;
    pageSize: number;
    total: number;
    items: T[];
};

type UpdateUserDto = {
    userName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    birthDate?: string | null;
    phone?: string | null;
    email?: string | null;
    role?: number | null;
    status?: number | null;
};

function roleLabel(role?: number) {
    if (role === 3) return "GodMode";
    if (role === 2) return "Admin";
    return "User";
}

function statusLabel(status?: number) {
    if (status === 2) return "Inactive";
    return "Active";
}

function fmtDate(iso?: string | null) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR");
}

function fullName(u: { firstName?: string; lastName?: string }) {
    return [u.firstName ?? "", u.lastName ?? ""].join(" ").trim() || "-";
}


/** ========= UI helpers ========= */

function Modal({
    open,
    title,
    children,
    onClose,
    widthClass = "max-w-2xl",
}: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    widthClass?: string;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={onClose}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className={`w-full ${widthClass} rounded-2xl bg-white shadow-2xl border overflow-hidden`}>
                    <div className="flex items-center justify-between px-5 py-4 border-b">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                                <Shield size={18} />
                            </div>
                            <div>
                                <div className="text-base font-semibold text-slate-900">{title}</div>
                                <div className="text-xs text-slate-500">Bratnava FC</div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                            aria-label="Fechar"
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-5">{children}</div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600">{label}</div>
            {children}
        </div>
    );
}

function Input({
    value,
    onChange,
    placeholder,
    disabled,
    type = "text",
}: {
    value: string;
    onChange?: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
}) {
    return (
        <input
            type={type}
            className={[
                "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                disabled
                    ? "bg-slate-50 text-slate-500 border-slate-200"
                    : "bg-white border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-200",
            ].join(" ")}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.value)}
        />
    );
}

function Select({
    value,
    onChange,
    disabled,
    children,
}: {
    value: string;
    onChange?: (v: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <select
            className={[
                "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                disabled
                    ? "bg-slate-50 text-slate-500 border-slate-200"
                    : "bg-white border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-200",
            ].join(" ")}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.value)}
        >
            {children}
        </select>
    );
}

function Button({
    children,
    onClick,
    variant = "primary",
    disabled,
    loading,
    iconLeft,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "danger" | "ghost";
    disabled?: boolean;
    loading?: boolean;
    iconLeft?: React.ReactNode;
}) {
    const cls =
        variant === "primary"
            ? "bg-slate-900 text-white hover:bg-slate-800"
            : variant === "secondary"
                ? "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                : variant === "danger"
                    ? "bg-rose-600 text-white hover:bg-rose-500"
                    : "bg-transparent hover:bg-slate-100 text-slate-800";

    return (
        <button
            type="button"
            className={[
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
                cls,
                (disabled || loading) ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading ? <Loader2 className="animate-spin" size={16} /> : iconLeft}
            {children}
        </button>
    );
}

/** ========= Modais ========= */

function EditUserModal({
    open,
    onClose,
    user,
    canEditAdminFields,
    isSelf,
    onChangePassword,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    user: UserListItemDto | null;
    canEditAdminFields: boolean;
    isSelf?: boolean;
    onChangePassword?: () => void;
    onSaved: () => Promise<void> | void;
}) {
    const [saving, setSaving] = useState(false);
    const [toggleBusy, setToggleBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<UpdateUserDto>({
        firstName: "",
        lastName: "",
        userName: "",
        email: "",
        phone: "",
        birthDate: "",
        role: null,
        status: null,
    });

    useEffect(() => {
        if (!user) return;
        setError(null);

        setForm({
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            userName: user.userName ?? "",
            email: user.email ?? "",
            phone: user.phone ?? "",
            birthDate: user.birthDate ? String(user.birthDate).slice(0, 10) : "",
            role: null,
            status: canEditAdminFields ? user.status : null,
        });
    }, [user, canEditAdminFields]);

    const isInactive = (user?.status ?? 1) === 2;

    async function handleSave() {
        if (!user) return;
        setSaving(true);
        setError(null);

        try {
            const payload: UpdateUserDto = {
                firstName: form.firstName?.trim() ?? null,
                lastName: form.lastName?.trim() ?? null,
                userName: form.userName?.trim() ?? null,
                email: form.email?.trim() ?? null,
                phone: (form.phone ?? "").trim() || null,
                birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
            };

            if (canEditAdminFields) {
                payload.status = form.status ?? null; // backend vai aplicar Inactivate/Reactivate
            }

            await UsersApi.update(user.id, payload);

            await onSaved();
            onClose();
        } catch (e: any) {
            const msg =
                e?.response?.data?.message ||
                e?.response?.data ||
                e?.message ||
                "Falha ao salvar usuário.";
            setError(String(msg));
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive() {
        if (!user) return;
        setToggleBusy(true);
        setError(null);

        try {
            if (isInactive) await UsersApi.reactivate(user.id);
            else await UsersApi.inactivate(user.id);

            await onSaved();
            onClose();
        } catch (e: any) {
            const msg =
                e?.response?.data?.message ||
                e?.response?.data ||
                e?.message ||
                "Falha ao alterar status.";
            setError(String(msg));
        } finally {
            setToggleBusy(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={canEditAdminFields ? "Editar usuário" : "Alterar meus dados"} widthClass="max-w-3xl">
            {!user ? (
                <div className="text-sm text-slate-600">Nenhum usuário selecionado.</div>
            ) : (
                <div className="space-y-4">
                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Primeiro nome">
                            <Input value={form.firstName ?? ""} onChange={(v) => setForm((s) => ({ ...s, firstName: v }))} />
                        </Field>

                        <Field label="Sobrenome">
                            <Input value={form.lastName ?? ""} onChange={(v) => setForm((s) => ({ ...s, lastName: v }))} />
                        </Field>

                        <Field label="Usuário">
                            <Input value={form.userName ?? ""} onChange={(v) => setForm((s) => ({ ...s, userName: v }))} />
                        </Field>

                        <Field label="Email">
                            <Input value={form.email ?? ""} onChange={(v) => setForm((s) => ({ ...s, email: v }))} />
                        </Field>

                        <Field label="Telefone">
                            <Input value={(form.phone ?? "") as string} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} placeholder="(opcional)" />
                        </Field>

                        <Field label="Nascimento">
                            <Input type="date" value={form.birthDate ?? ""} onChange={(v) => setForm((s) => ({ ...s, birthDate: v }))} />
                        </Field>

                        {canEditAdminFields && (
                            <Field label="Status">
                                <Select value={String(form.status ?? user.status ?? 1)} onChange={(v) => setForm((s) => ({ ...s, status: Number(v) }))}>
                                    <option value="1">Active</option>
                                    <option value="2">Inactive</option>
                                </Select>
                            </Field>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-slate-500">
                            <div><span className="font-medium">Status:</span> {statusLabel(user.status)} {user.inactivatedAt ? `(desde ${fmtDate(user.inactivatedAt)})` : ""}</div>
                            <div><span className="font-medium">Role:</span> {roleLabel(user.role)}</div>
                            {user.createDate && <div><span className="font-medium">Criado:</span> {fmtDate(user.createDate)}</div>}
                            {user.updateDate && <div><span className="font-medium">Atualizado:</span> {fmtDate(user.updateDate)}</div>}
                        </div>

                        <div className="flex gap-2">
                            {isSelf && onChangePassword && (
                                <Button
                                    variant="secondary"
                                    onClick={() => { onClose(); setTimeout(() => onChangePassword(), 200); }}
                                    iconLeft={<KeyRound size={16} />}
                                >
                                    Alterar senha
                                </Button>
                            )}

                            {canEditAdminFields && (
                                <Button
                                    variant={isInactive ? "secondary" : "danger"}
                                    onClick={handleToggleActive}
                                    loading={toggleBusy}
                                    iconLeft={isInactive ? <Check size={16} /> : <X size={16} />}
                                >
                                    {isInactive ? "Reativar" : "Inativar"}
                                </Button>
                            )}

                            <Button variant="secondary" onClick={onClose}>Cancelar</Button>

                            <Button variant="primary" onClick={handleSave} loading={saving} iconLeft={<Check size={16} />}>
                                Salvar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}

function ChangePasswordModal({
    open,
    onClose,
    userId,
}: {
    open: boolean;
    onClose: () => void;
    userId: string;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [current, setCurrent] = useState("");
    const [next1, setNext1] = useState("");
    const [next2, setNext2] = useState("");

    useEffect(() => {
        if (!open) return;
        setError(null);
        setCurrent("");
        setNext1("");
        setNext2("");
    }, [open]);

    async function handleSave() {
        setError(null);

        if (!current.trim()) return setError("Informe a senha atual.");
        if (!next1.trim() || !next2.trim()) return setError("Informe a nova senha duas vezes.");
        if (next1 !== next2) return setError("As novas senhas não conferem.");
        if (next1.length < 6) return setError("A nova senha deve ter pelo menos 6 caracteres.");

        setSaving(true);
        try {
            await UsersApi.changePassword(userId, { currentPassword: current, newPassword: next1 });
            onClose();
        } catch (e: any) {
            const msg = getResponseMessage(e, "Falha ao alterar senha.");

            if (msg.toLowerCase().includes("current password is invalid")) {
                setError("A senha atual está incorreta.");
            } else {
                setError(msg);
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Alterar senha" widthClass="max-w-xl">
            <div className="space-y-4">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                    <Field label="Senha atual">
                        <Input type="password" value={current} onChange={setCurrent} />
                    </Field>

                    <Field label="Nova senha">
                        <Input type="password" value={next1} onChange={setNext1} />
                    </Field>

                    <Field label="Confirmar nova senha">
                        <Input type="password" value={next2} onChange={setNext2} />
                    </Field>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSave} loading={saving} iconLeft={<KeyRound size={16} />}>
                        Alterar senha
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

/** ========= Tipos de convite ========= */

type GroupInviteDto = {
    id: string;
    groupId: string;
    groupName: string;
    targetUserId: string;
    guestPlayerId?: string | null;
    guestPlayerName?: string | null;
    status: number;
    createDate: string;
};

/** ========= Página ========= */

export default function AdminUsersPage() {
    const active = useAccountStore((s) => s.getActive());
    const isAdminOrGod = useMemo(() => !!active && active.roles.includes("GodMode"), [active]);
    const myUserId = active?.userId ?? null;
    const activeGroupId = active?.activeGroupId ?? null;

    const setPendingCount = useInviteStore((s) => s.setPendingCount);

    // Convites pendentes (só para user comum)
    const [invites, setInvites] = useState<GroupInviteDto[]>([]);
    const [invitesLoading, setInvitesLoading] = useState(false);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [inviteActionErr, setInviteActionErr] = useState<string | null>(null);

    async function loadInvites() {
        setInvitesLoading(true);
        try {
            const res = await GroupInvitesApi.mine();
            const list: GroupInviteDto[] = (res.data.data ?? []) as GroupInviteDto[];
            setInvites(list);
            setPendingCount(list.length);
        } catch {
            // silencioso
        } finally {
            setInvitesLoading(false);
        }
    }

    async function handleAccept(inviteId: string) {
        setAcceptingId(inviteId);
        setInviteActionErr(null);
        try {
            await GroupInvitesApi.accept(inviteId);
            await loadInvites();
        } catch (e: any) {
            setInviteActionErr(e?.response?.data?.error ?? e?.response?.data?.message ?? "Erro ao aceitar convite.");
        } finally {
            setAcceptingId(null);
        }
    }

    async function handleReject(inviteId: string) {
        setRejectingId(inviteId);
        setInviteActionErr(null);
        try {
            await GroupInvitesApi.reject(inviteId);
            await loadInvites();
        } catch (e: any) {
            setInviteActionErr(e?.response?.data?.error ?? e?.response?.data?.message ?? "Erro ao recusar convite.");
        } finally {
            setRejectingId(null);
        }
    }

    // Payment summary (user view)
    const [myPaymentSummary,        setMyPaymentSummary]        = useState<any>(null);
    const [myPaymentSummaryLoading, setMyPaymentSummaryLoading] = useState(false);

    async function loadMyPaymentSummary() {
        if (!activeGroupId) return;
        setMyPaymentSummaryLoading(true);
        try {
            const res = await PaymentsApi.getMySummary(activeGroupId);
            setMyPaymentSummary(res.data ?? null);
        } catch {
            // silencioso
        } finally {
            setMyPaymentSummaryLoading(false);
        }
    }

    // Admin list
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [includeInactive, setIncludeInactive] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [result, setResult] = useState<PagedResultDto<UserListItemDto> | null>(null);
    const totalPages = useMemo(() => {
        const total = result?.total ?? 0;
        const size = result?.pageSize ?? pageSize;
        return Math.max(1, Math.ceil(total / size));
    }, [result, pageSize]);

    // My profile
    const [myLoading, setMyLoading] = useState(false);
    const [myError, setMyError] = useState<string | null>(null);
    const [myUser, setMyUser] = useState<UserListItemDto | null>(null);

    // Modals
    const [editOpen, setEditOpen] = useState(false);
    const [editUser, setEditUser] = useState<UserListItemDto | null>(null);
    const [passOpen, setPassOpen] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    async function loadAdminList() {
        setLoading(true);
        try {
            const resp = await UsersApi.list({
                search: debouncedSearch || undefined,
                page,
                pageSize,
                includeInactive,
            });
            const data = (resp?.data?.data ?? resp?.data) as unknown;
            setResult(data as PagedResultDto<UserListItemDto>);
        } catch (e) {
            toast.error(getResponseMessage(e, "Falha ao carregar lista de usuários."));
        } finally {
            setLoading(false);
        }
    }

    async function loadMyProfile() {
        if (!myUserId) {
            setMyError("Não foi possível identificar seu userId (activeAccountId). Faça login novamente.");
            return;
        }

        setMyLoading(true);
        setMyError(null);

        try {
            const resp = await UsersApi.get(myUserId);
            const data = (resp?.data?.data ?? resp?.data) as any;

            // ✅ agora depende do backend retornar esses campos (ajuste no UserDto/GetUserByIdAsync)
            const mapped: UserListItemDto = {
                id: data.id,
                userName: data.userName ?? data.userName ?? "",
                firstName: data.firstName ?? "",
                lastName: data.lastName ?? "",
                email: data.email ?? "",
                phone: data.phone ?? null,
                birthDate: data.birthDate ?? null,
                role: typeof data.role === "number" ? data.role : (data.role?.value ?? 1),
                status: typeof data.status === "number" ? data.status : (data.status?.value ?? 1),
                createDate: data.createDate ?? null,
                updateDate: data.updateDate ?? null,
                inactivatedAt: data.inactivatedAt ?? null,
            };

            setMyUser(mapped);
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || "Falha ao carregar perfil.";
            setMyError(String(msg));
        } finally {
            setMyLoading(false);
        }
    }

    useEffect(() => {
        if (isAdminOrGod) {
            loadAdminList();
        } else {
            loadMyProfile();
            loadInvites();
            loadMyPaymentSummary();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdminOrGod, page, pageSize, includeInactive, debouncedSearch, myUserId, activeGroupId]);

    function openEdit(u: UserListItemDto) {
        setEditUser(u);
        setEditOpen(true);
    }

    async function refreshAfterSave() {
        if (isAdminOrGod) await loadAdminList();
        else await loadMyProfile();
    }

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-6 overflow-hidden shadow-lg">
                <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                        {isAdminOrGod ? <Users2 size={26} /> : <User size={26} />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black leading-tight">
                            {isAdminOrGod ? "Usuários" : (myUser ? fullName(myUser) : "Meu Perfil")}
                        </h1>
                        <p className="text-sm text-white/50 mt-0.5">
                            {isAdminOrGod
                                ? `${result?.total ?? 0} usuário${(result?.total ?? 0) !== 1 ? 's' : ''} encontrado${(result?.total ?? 0) !== 1 ? 's' : ''}`
                                : myUser ? `@${myUser.userName} · ${roleLabel(myUser.role)}` : 'Carregando...'}
                        </p>
                    </div>
                </div>
            </div>

            {isAdminOrGod ? (
                // =========================
                // ADMIN/GODMODE
                // =========================
                <div className="space-y-4">
                    <div className="card p-0 overflow-hidden shadow-sm">

                        {/* Search + filters */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 border-b border-slate-100 bg-slate-50/80">
                            <div className="flex-1 relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                                    placeholder="Buscar por nome, usuário ou email..."
                                    value={search}
                                    onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                                />
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={includeInactive}
                                        onChange={(e) => { setPage(1); setIncludeInactive(e.target.checked); }}
                                        className="accent-slate-900"
                                    />
                                    Incluir inativos
                                </label>
                                <Select value={String(pageSize)} onChange={(v) => { setPage(1); setPageSize(Number(v)); }}>
                                    <option value="10">10 / pág.</option>
                                    <option value="20">20 / pág.</option>
                                    <option value="50">50 / pág.</option>
                                </Select>
                            </div>
                        </div>

                        {/* User list */}
                        {loading ? (
                            <div className="p-10 flex items-center justify-center gap-2 text-slate-400">
                                <Loader2 size={16} className="animate-spin" /> Carregando...
                            </div>
                        ) : (result?.items?.length ?? 0) === 0 ? (
                            <div className="p-10 text-center text-sm text-slate-400">Nenhum usuário encontrado.</div>
                        ) : (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                                {result!.items.map((u) => {
                                    const isMe = u.id === myUserId;
                                    const isInativo = u.status === 2;
                                    const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('').toUpperCase() || u.userName?.[0]?.toUpperCase() || '?';
                                    const avatarCls = isMe ? 'bg-emerald-600 text-white' : u.role === 3 ? 'bg-violet-600 text-white' : u.role === 2 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700';
                                    return (
                                        <div key={u.id} className={[
                                            "rounded-xl border bg-white p-3 flex flex-col gap-2 shadow-sm transition-all",
                                            isInativo ? "opacity-50" : "",
                                            isMe ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200",
                                        ].join(" ")}>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`h-9 w-9 rounded-full text-xs font-bold flex items-center justify-center shrink-0 select-none ${avatarCls}`}>
                                                    {initials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 truncate">{fullName(u)}</div>
                                                    <div className="text-[11px] text-slate-400 truncate">
                                                        {[u.userName && `@${u.userName}`, u.email].filter(Boolean).join(' · ')}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-white leading-none">Você</span>}
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(u)}
                                                        className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                                        title="Editar usuário"
                                                    >
                                                        <Pencil size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={[
                                                    "text-[10px] px-2 py-0.5 rounded-full border leading-none font-medium",
                                                    u.role === 3 ? "bg-violet-50 border-violet-200 text-violet-700"
                                                        : u.role === 2 ? "bg-amber-50 border-amber-200 text-amber-700"
                                                        : "bg-slate-50 border-slate-200 text-slate-600",
                                                ].join(" ")}>
                                                    {roleLabel(u.role)}
                                                </span>
                                                {isInativo && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-rose-50 border-rose-200 text-rose-600 leading-none font-medium">
                                                        Inativo
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Pagination footer */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                            <div className="text-xs text-slate-500">
                                Mostrando{' '}
                                <span className="font-semibold text-slate-700">{result?.items?.length ?? 0}</span>
                                {' '}de{' '}
                                <span className="font-semibold text-slate-700">{result?.total ?? 0}</span>
                                {' '}· Pág.{' '}
                                <span className="font-semibold text-slate-700">{result?.page ?? page}</span>
                                {' '}de{' '}
                                <span className="font-semibold text-slate-700">{totalPages}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    disabled={(result?.page ?? page) <= 1 || loading}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    iconLeft={<ChevronLeft size={15} />}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={(result?.page ?? page) >= totalPages || loading}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    iconLeft={<ChevronRight size={15} />}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </div>

                    <EditUserModal
                        open={editOpen}
                        onClose={() => setEditOpen(false)}
                        user={editUser}
                        canEditAdminFields={true}
                        isSelf={!!myUserId && editUser?.id === myUserId}
                        onChangePassword={() => setPassOpen(true)}
                        onSaved={refreshAfterSave}
                    />
                </div>
            ) : (
                // =========================
                // USER
                // =========================
                <div className="space-y-4">
                    {myLoading ? (
                        <div className="card p-10 flex items-center justify-center gap-2 text-slate-400 shadow-sm">
                            <Loader2 size={16} className="animate-spin" /> Carregando...
                        </div>
                    ) : myError ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0" /> {myError}
                        </div>
                    ) : !myUser ? (
                        <div className="card p-8 text-center text-sm text-slate-400 shadow-sm">
                            Não foi possível carregar seus dados.
                        </div>
                    ) : (
                        /* ── Perfil ── */
                        <div className="card p-0 overflow-hidden shadow-sm">
                            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                                <div className="h-8 w-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0">
                                    <User size={15} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-slate-900 text-sm">Perfil</div>
                                    <div className="text-xs text-slate-400">Seus dados pessoais</div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => { setEditUser(myUser); setEditOpen(true); }}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 transition shadow-sm"
                                    >
                                        <Pencil size={14} />
                                        <span className="hidden sm:inline">Alterar dados</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPassOpen(true)}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition shadow-sm"
                                    >
                                        <KeyRound size={14} />
                                        <span className="hidden sm:inline">Alterar senha</span>
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                {[
                                    { label: 'Primeiro nome',  value: myUser.firstName },
                                    { label: 'Sobrenome',      value: myUser.lastName },
                                    { label: 'Usuário',        value: myUser.userName ? `@${myUser.userName}` : null },
                                    { label: 'Email',          value: myUser.email },
                                    { label: 'Telefone',       value: myUser.phone },
                                    { label: 'Nascimento',     value: myUser.birthDate ? fmtDate(myUser.birthDate) : null },
                                    { label: 'Role',           value: roleLabel(myUser.role) },
                                    { label: 'Status',         value: statusLabel(myUser.status) },
                                    { label: 'Criado em',      value: myUser.createDate ? fmtDate(myUser.createDate) : null },
                                    { label: 'Atualizado em',  value: myUser.updateDate ? fmtDate(myUser.updateDate) : null },
                                    { label: 'Inativado em',   value: myUser.inactivatedAt ? fmtDate(myUser.inactivatedAt) : null },
                                ].map(({ label, value }) => (
                                    <div key={label}>
                                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
                                        <div className="text-sm font-medium text-slate-900">{value || '—'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Convites pendentes ── */}
                    <div className="rounded-2xl border bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b flex items-center gap-3">
                            <Bell size={16} className="text-slate-500" />
                            <span className="text-sm font-semibold text-slate-900">
                                Convites de patota
                            </span>
                            {invites.length > 0 && (
                                <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                                    {invites.length}
                                </span>
                            )}
                        </div>

                        {inviteActionErr && (
                            <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                {inviteActionErr}
                            </div>
                        )}

                        {invitesLoading ? (
                            <div className="p-6 flex items-center gap-2 text-slate-400">
                                <Loader2 size={15} className="animate-spin" /> Carregando convites...
                            </div>
                        ) : invites.length === 0 ? (
                            <div className="p-6 text-sm text-slate-400">Nenhum convite pendente.</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {invites.map((inv) => {
                                    const isAccepting = acceptingId === inv.id;
                                    const isRejecting = rejectingId === inv.id;
                                    const busy = isAccepting || isRejecting;
                                    return (
                                        <div key={inv.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-black flex items-center justify-center shrink-0 select-none">
                                                    {inv.groupName?.charAt(0) ?? '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 truncate">{inv.groupName}</div>
                                                    {inv.guestPlayerName && (
                                                        <div className="text-xs text-slate-500">
                                                            Perfil: <span className="font-medium text-slate-700">{inv.guestPlayerName}</span>
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-slate-400">{new Date(inv.createDate).toLocaleDateString("pt-BR")}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button variant="primary" onClick={() => handleAccept(inv.id)} loading={isAccepting} disabled={busy} iconLeft={<UserCheck size={15} />}>
                                                    Aceitar
                                                </Button>
                                                <Button variant="danger" onClick={() => handleReject(inv.id)} loading={isRejecting} disabled={busy} iconLeft={<UserX size={15} />}>
                                                    Recusar
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <EditUserModal
                        open={editOpen}
                        onClose={() => setEditOpen(false)}
                        user={editUser}
                        canEditAdminFields={false}
                        onSaved={refreshAfterSave}
                    />
                </div>
            )}

            {myUserId && (
                <ChangePasswordModal
                    open={passOpen}
                    onClose={() => setPassOpen(false)}
                    userId={myUserId}
                />
            )}
        </div>
    );
}
