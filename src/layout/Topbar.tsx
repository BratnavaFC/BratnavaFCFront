import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    LogOut,
    UserCircle2,
    ChevronDown,
    Menu,
    Plus,
} from "lucide-react";
import { useAccountStore } from "../auth/accountStore";
import { getRole } from "../auth/guards";

type Props = {
    isMobile?: boolean;
    onMenuClick?: () => void;
};

function roleLabel(role: string | null) {
    return role || "User";
}

export default function Topbar({ isMobile = false, onMenuClick }: Props) {
    const nav = useNavigate();

    const accounts = useAccountStore((s) => s.accounts);
    const activeAccountId = useAccountStore((s) => s.activeAccountId);
    const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
    const logoutActive = useAccountStore((s) => s.logoutActive);
    const getActive = useAccountStore((s) => s.getActive);

    const active = getActive();
    const role = getRole();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const display = useMemo(() => {
        if (!active) return { name: "—" };
        return { name: active.name || active.email || active.userId };
    }, [active]);

    const onLogout = () => {
        logoutActive();
        nav("/login");
    };

    return (
        <header className="h-16 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between gap-3">
            {/* LEFT */}
            <div className="flex items-center gap-3 min-w-0">
                {/* Mobile hamburger */}
                {isMobile ? (
                    <button
                        type="button"
                        className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition grid place-items-center"
                        onClick={onMenuClick}
                        aria-label="Abrir menu"
                    >
                        <Menu size={18} className="text-slate-700" />
                    </button>
                ) : null}

                <UserCircle2 className="text-slate-700 shrink-0" />

                <div className="min-w-0">
                    <div className="font-semibold leading-tight truncate">{display.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="pill">{roleLabel(role)}</span>
                        {!isMobile ? <span>Conta ativa</span> : null}
                    </div>
                </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Account selector (compact on mobile) */}
                <div className="relative">
                    <select
                        value={activeAccountId ?? ""}
                        onChange={(e) => setActiveAccount(e.target.value)}
                        className={[
                            "input pr-9",
                            isMobile ? "h-10 text-sm w-[160px]" : "w-[240px]",
                        ].join(" ")}
                    >
                        {activeAccountId == null ? (
                            <option value="" disabled>
                                Selecione
                            </option>
                        ) : null}

                        {accounts.map((a) => (
                            <option key={a.userId} value={a.userId}>
                                {a.name || a.email || a.userId}
                            </option>
                        ))}
                    </select>

                    <ChevronDown
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                    />
                </div>

                {/* Desktop actions */}
                {!isMobile ? (
                    <>
                        <button className="btn" onClick={() => nav("/login?add=1")}>
                            Adicionar conta
                        </button>

                        <button
                            className="btn btn-danger"
                            onClick={onLogout}
                            disabled={!active}
                        >
                            <LogOut size={16} /> Sair
                        </button>
                    </>
                ) : (
                    /* Mobile actions: small dropdown */
                    <div className="relative">
                        <button
                            type="button"
                            className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition grid place-items-center"
                            onClick={() => setMobileMenuOpen((v) => !v)}
                            aria-label="Ações"
                        >
                            <ChevronDown size={18} className="text-slate-700" />
                        </button>

                        {mobileMenuOpen ? (
                            <>
                                <button
                                    className="fixed inset-0 z-40"
                                    aria-label="Fechar ações"
                                    onClick={() => setMobileMenuOpen(false)}
                                />

                                <div className="absolute right-0 mt-2 z-50 w-56 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <button
                                        className="w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            nav("/login?add=1");
                                        }}
                                    >
                                        <Plus size={16} className="text-slate-700" />
                                        Adicionar conta
                                    </button>

                                    <button
                                        className="w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            onLogout();
                                        }}
                                        disabled={!active}
                                    >
                                        <LogOut size={16} className="text-slate-700" />
                                        Sair
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
            </div>
        </header>
    );
}