import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, UserCircle2, ChevronDown } from "lucide-react";
import { useAccountStore } from "../auth/accountStore";
import { getRole } from "../auth/guards";

function roleLabel(role: string | null) {
    if (!role) return "User";
    return role;
}

export default function Topbar() {
    const nav = useNavigate();

    const accounts = useAccountStore((s) => s.accounts);
    const activeAccountId = useAccountStore((s) => s.activeAccountId);
    const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
    const logoutActive = useAccountStore((s) => s.logoutActive);
    const getActive = useAccountStore((s) => s.getActive);

    const active = getActive();
    const role = getRole();

    const display = useMemo(() => {
        if (!active) return { name: "—" };
        return { name: active.name || active.email || active.userId };
    }, [active]);

    return (
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <UserCircle2 className="text-slate-700" />
                <div>
                    <div className="font-semibold leading-tight">{display.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="pill">{roleLabel(role)}</span>
                        <span>Conta ativa</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative">
                    <select
                        value={activeAccountId ?? ""}               
                        onChange={(e) => setActiveAccount(e.target.value)}
                        className="input pr-10"
                    >
                        {/* se não tiver ativa ainda */}
                        {activeAccountId == null ? (
                            <option value="" disabled>
                                Selecione uma conta
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

                <button className="btn" onClick={() => nav("/login?add=1")}>
                    Adicionar conta
                </button>

                <button
                    className="btn btn-danger"
                    onClick={() => {
                        logoutActive();     // ✅ sai da conta ativa (store controla)
                        nav("/login");
                    }}
                    disabled={!active}
                >
                    <LogOut size={16} /> Sair
                </button>
            </div>
        </header>
    );
}