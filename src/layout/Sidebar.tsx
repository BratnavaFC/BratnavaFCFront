import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import {
    LayoutDashboard, Users, Palette, CalendarDays, History, Settings, BarChart3, Shield
} from "lucide-react";
import useAccountStore from "../auth/accountStore";

const ACTIVE_GROUP_ID = "3f401edf-d309-4bae-97d8-28eae0da7a8a";

type Item = { to: string; label: string; icon: any };

export default function Sidebar({ open, pinned, onToggle, onClose }: any) {
    const active = useAccountStore((s) => s.getActive());
    const isAdminOrGod = !!active && (active.roles.includes("Admin") || active.roles.includes("GodMode"));

    const items: Item[] = useMemo(() => [
        { to: "/app", label: "Dashboard", icon: LayoutDashboard },
        { to: "/app/groups", label: "Grupos", icon: Users },
        { to: "/app/players", label: "Jogadores", icon: Users },
        { to: "/app/team-colors", label: "Cores", icon: Palette },
        { to: "/app/matches", label: "Partidas", icon: CalendarDays },
        { to: "/app/history", label: "Histórico", icon: History },
        { to: `/app/groups/${ACTIVE_GROUP_ID}/visual-stats`, label: "Visual Stats", icon: BarChart3 },
        { to: "/app/settings", label: "Configurações", icon: Settings },

        // ✅ sempre clicável, muda só o nome
        { to: "/app/admin/users", label: isAdminOrGod ? "Usuários" : "Minha conta", icon: Shield },
    ], [isAdminOrGod]);

    return (
        <aside className={`bg-white border-r transition-all duration-300 ${open ? "w-64" : "w-16"}`}>
            <div className="h-full flex flex-col">
                <button className="p-4 border-b hover:bg-slate-50" onClick={onToggle}>
                    {open ? "◀" : "▶"}
                </button>

                <nav className="flex-1 p-2 space-y-1">
                    {items.map((item) => {
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => !pinned && onClose()}
                                className={({ isActive }) =>
                                    [
                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                                        isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                                    ].join(" ")
                                }
                            >
                                <Icon size={18} />
                                {open && <span>{item.label}</span>}
                            </NavLink>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}