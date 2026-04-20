import { NavLink } from "react-router-dom";
import { useEffect, useMemo } from "react";
import {
    LayoutDashboard, Users, Palette, CalendarDays, CalendarCheck, History, Settings, User, ShieldAlert,
    Menu, X, DollarSign, Presentation, Vote, Cake, Sun, Moon, Film, CalendarOff, Coins,
} from "lucide-react";
import useAccountStore from "../auth/accountStore";
import { useInviteStore } from "../stores/inviteStore";
import { usePollStore } from "../stores/pollStore";
import { usePaymentStore, calcPendingPaymentsCount } from "../stores/paymentStore";
import { GroupInvitesApi, PollsApi, PaymentsApi } from "../api/endpoints";
import { useThemeStore } from "../stores/themeStore";

type Item = { to: string; label: string; icon?: any; imgIcon?: string; badge?: number; end?: boolean };

export default function Sidebar({ open, pinned, onToggle, onClose }: any) {
    const userId       = useAccountStore((s) => s.accounts.find(a => a.userId === s.activeAccountId)?.userId);
    const roles        = useAccountStore((s) => s.accounts.find(a => a.userId === s.activeAccountId)?.roles ?? []);
    const activeGrpId  = useAccountStore((s) => s.accounts.find(a => a.userId === s.activeAccountId)?.activeGroupId ?? null);
    const grpAdminIds  = useAccountStore((s) => s.accounts.find(a => a.userId === s.activeAccountId)?.groupAdminIds ?? []);

    const isAdminOrGod = roles.includes("Admin") || roles.includes("GodMode");
    const isGod        = roles.includes("GodMode");
    const isGroupAdm   = isAdminOrGod || (!!activeGrpId && grpAdminIds.includes(activeGrpId));

    const pendingCount            = useInviteStore((s) => s.pendingCount);
    const setPendingCount         = useInviteStore((s) => s.setPendingCount);
    const pendingPollsCount       = usePollStore((s) => s.pendingPollsCount);
    const setPendingPollsCount    = usePollStore((s) => s.setPendingPollsCount);
    const pendingPaymentsCount    = usePaymentStore((s) => s.pendingPaymentsCount);
    const setPendingPaymentsCount = usePaymentStore((s) => s.setPendingPaymentsCount);

    const { theme, toggle: toggleTheme } = useThemeStore();

    useEffect(() => {
        if (!userId) return;
        GroupInvitesApi.mineCount()
            .then((res) => setPendingCount((res.data?.data as any)?.count ?? 0))
            .catch(() => { /* silencioso */ });
    }, [userId, setPendingCount]);

    useEffect(() => {
        if (!activeGrpId) { setPendingPollsCount(0); return; }
        PollsApi.getPolls(activeGrpId)
            .then((res) => {
                const list: any[] = (res.data as any)?.data ?? [];
                const count = list.filter((p: any) => p.status === 'open' && !p.hasVoted).length;
                setPendingPollsCount(count);
            })
            .catch(() => { /* silencioso */ });
    }, [userId, activeGrpId, setPendingPollsCount]);

    useEffect(() => {
        if (!activeGrpId) { setPendingPaymentsCount(0); return; }
        PaymentsApi.getMySummary(activeGrpId)
            .then((res) => setPendingPaymentsCount(calcPendingPaymentsCount((res.data as any)?.data)))
            .catch(() => { /* silencioso */ });
    }, [userId, activeGrpId, setPendingPaymentsCount]);

    const items: Item[] = useMemo(() => [
        { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/groups", label: "Grupos", icon: Users },
        { to: "/app/team-colors", label: "Cores", icon: Palette },
        { to: "/app/matches", label: "Partidas", icon: CalendarDays },
        { to: "/app/history", label: "Histórico", icon: History },
        { to: "/app/calendar", label: "Calendário", icon: CalendarCheck },
        { to: "/app/absences", label: "Ausências",  icon: CalendarOff },
        { to: "/app/polls",    label: "Votações",   icon: Vote,        badge: pendingPollsCount || undefined },
        { to: "/app/payments", label: "Pagamentos", icon: DollarSign, badge: pendingPaymentsCount || undefined },
        ...(isGroupAdm || isGod ? [{ to: "/app/spotlight", label: "Spotlight", icon: Presentation }] : []),
         ...(isGroupAdm || isGod ? [{ to: "/app/birthday-status", label: "Aniversários", icon: Cake }] : []),
        ...(isGroupAdm || isGod ? [{ to: "/app/settings", label: "Configurações", icon: Settings }] : []),
        { to: "/app/replays", label: "Replays", icon: Film },
        { to: "/app/bet",     label: "Bet",     icon: Coins },
        {
            to: "/app/admin/users",
            label: isAdminOrGod ? "Usuários" : "Minha conta",
            icon: User,
            badge: isAdminOrGod ? 0 : pendingCount,
        },
        ...(isGod ? [{ to: "/app/admin/godmode", label: "GodMode", icon: ShieldAlert }] : []),
    ], [isAdminOrGod, isGod, isGroupAdm, activeGrpId, pendingCount, pendingPollsCount, pendingPaymentsCount]);

    return (
        <aside className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${open ? "w-64" : "w-16"}`}>
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className={[
                    "flex items-center border-b border-slate-100 dark:border-slate-800 shrink-0 transition-all duration-300",
                    open ? "px-4 py-3 gap-3 justify-between" : "px-2 py-3 justify-center",
                ].join(" ")}>
                    {open && (
                        <img
                            src="/bratnava-coin.png"
                            alt="Bratnava Coin"
                            className="h-10 w-auto object-contain select-none dark:invert"
                        />
                    )}
                    <button
                        onClick={onToggle}
                        aria-label={open ? "Recolher menu" : "Expandir menu"}
                        className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition grid place-items-center shrink-0"
                    >
                        {open ? <X size={18} className="text-slate-700 dark:text-slate-300" /> : <Menu size={18} className="text-slate-700 dark:text-slate-300" />}
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 p-2 space-y-1 overflow-y-auto min-h-0">
                    {items.map((item) => {
                        const Icon = item.icon ?? (() => null);
                        const hasBadge = !!item.badge && item.badge > 0;

                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                onClick={() => !pinned && onClose()}
                                className={({ isActive }) =>
                                    [
                                        "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                                        isActive
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                                    ].join(" ")
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className="relative shrink-0">
                                            {item.imgIcon
                                                ? <img src={item.imgIcon} alt={item.label} className="h-[18px] w-[18px] object-contain dark:invert" />
                                                : <Icon size={18} />
                                            }
                                            {hasBadge && (
                                                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
                                                    {item.badge! > 9 ? "9+" : item.badge}
                                                </span>
                                            )}
                                        </span>

                                        {open && (
                                            <span className="flex-1 flex items-center justify-between min-w-0">
                                                <span className="truncate">{item.label}</span>
                                                {hasBadge && (
                                                    <span className={[
                                                        "ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold shrink-0",
                                                        isActive
                                                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                            : "bg-rose-500 text-white",
                                                    ].join(" ")}>
                                                        {item.badge! > 99 ? "99+" : item.badge}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Dark mode toggle — todos os usuários */}
                <div className="p-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        {theme === "dark"
                            ? <Sun size={18} className="text-amber-400 shrink-0" />
                            : <Moon size={18} className="shrink-0" />
                        }
                        {open && (
                            <span className="truncate">
                                {theme === "dark" ? "Modo claro" : "Modo escuro"}
                            </span>
                        )}
                    </button>
                </div>

            </div>
        </aside>
    );
}
