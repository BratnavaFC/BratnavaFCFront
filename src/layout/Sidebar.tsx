import { NavLink } from "react-router-dom";
import { useEffect, useMemo } from "react";
import {
    LayoutDashboard, Users, Palette, CalendarDays, History, Settings, BarChart3, Shield, ShieldAlert
} from "lucide-react";
import useAccountStore from "../auth/accountStore";
import { useInviteStore } from "../stores/inviteStore";
import { GroupInvitesApi } from "../api/endpoints";
import { isGodMode } from "../auth/guards";

type Item = { to: string; label: string; icon: any; badge?: number };

export default function Sidebar({ open, pinned, onToggle, onClose }: any) {
    const active = useAccountStore((s) => s.getActive());
    const isAdminOrGod = !!active && (active.roles.includes("Admin") || active.roles.includes("GodMode"));
    const isGod = isGodMode();
    const pendingCount = useInviteStore((s) => s.pendingCount);
    const setPendingCount = useInviteStore((s) => s.setPendingCount);

    // Buscar contagem de convites ao montar / quando userId muda
    useEffect(() => {
        if (!active?.userId) return;
        GroupInvitesApi.mineCount()
            .then((res) => setPendingCount(res.data?.count ?? 0))
            .catch(() => { /* silencioso */ });
    }, [active?.userId, setPendingCount]);

    const items: Item[] = useMemo(() => [
        { to: "/app",                                                                    label: "Dashboard",     icon: LayoutDashboard },
        { to: "/app/groups",                                                             label: "Grupos",        icon: Users },
        { to: "/app/team-colors",                                                        label: "Cores",         icon: Palette },
        { to: "/app/matches",                                                            label: "Partidas",      icon: CalendarDays },
        { to: "/app/history",                                                            label: "Histórico",     icon: History },
        { to: activeGroupId ? `/app/groups/${activeGroupId}/visual-stats` : "/app",     label: "Visual Stats",  icon: BarChart3 },
        { to: "/app/settings",                                                           label: "Configurações", icon: Settings },
        {
            to: "/app/admin/users",
            label: isAdminOrGod ? "Usuários" : "Minha conta",
            icon: Shield,
            badge: isAdminOrGod ? 0 : pendingCount,
        },
        ...(isGod ? [{ to: "/app/admin/godmode", label: "GodMode", icon: ShieldAlert }] : []),
    ], [isAdminOrGod, isGod, pendingCount]);

    return (
        <aside className={`bg-white border-r transition-all duration-300 ${open ? "w-64" : "w-16"}`}>
            <div className="h-full flex flex-col">
                <button className="p-4 border-b hover:bg-slate-50" onClick={onToggle}>
                    {open ? "◀" : "▶"}
                </button>

                <nav className="flex-1 p-2 space-y-1">
                    {items.map((item) => {
                        const Icon = item.icon;
                        const hasBadge = !!item.badge && item.badge > 0;

                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => !pinned && onClose()}
                                className={({ isActive }) =>
                                    [
                                        "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                                        isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                                    ].join(" ")
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        {/* ícone + bolinha */}
                                        <span className="relative shrink-0">
                                            <Icon size={18} />
                                            {hasBadge && (
                                                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
                                                    {item.badge! > 9 ? "9+" : item.badge}
                                                </span>
                                            )}
                                        </span>

                                        {/* label + badge (só quando sidebar aberto) */}
                                        {open && (
                                            <span className="flex-1 flex items-center justify-between min-w-0">
                                                <span className="truncate">{item.label}</span>
                                                {hasBadge && (
                                                    <span className={[
                                                        "ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold shrink-0",
                                                        isActive
                                                            ? "bg-white text-slate-900"
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
            </div>
        </aside>
    );
}
