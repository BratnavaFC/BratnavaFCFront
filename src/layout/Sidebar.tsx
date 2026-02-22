import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Users,
    Shield,
    Users2,
    Palette,
    Settings,
    Swords,
    History,
    BarChart3,
} from 'lucide-react';
import { isAdmin } from '../auth/guards';

const STORAGE_KEY = 'bratnava.activeGroupId';

const link = (to: string, label: string, Icon: any, disabled?: boolean) => (
    <NavLink
        to={disabled ? '#' : to}
        onClick={(e) => {
            if (disabled) e.preventDefault();
        }}
        className={({ isActive }) =>
            [
                "flex items-center gap-3 rounded-xl px-3 py-2 border",
                disabled
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : isActive
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white border-slate-200 hover:bg-slate-50",
            ].join(" ")
        }
    >
        <Icon size={18} />
        <span className="font-medium">{label}</span>
    </NavLink>
);

function isGuid(v: string) {
    // valida GUID padrão (8-4-4-4-12)
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        v.trim()
    );
}

export default function Sidebar() {
    const admin = isAdmin();

    const [groupId, setGroupId] = useState<string>('');
    const groupIdValid = useMemo(() => isGuid(groupId), [groupId]);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setGroupId(saved);
    }, []);

    useEffect(() => {
        // salva só se for válido, pra não “prender” lixo no storage
        if (groupIdValid) localStorage.setItem(STORAGE_KEY, groupId.trim());
    }, [groupId, groupIdValid]);

    const visualStatsUrl = groupIdValid
        ? `/app/groups/${groupId.trim()}/visual-stats`
        : '/app/groups';

    return (
        <aside className="w-72 p-4 border-r border-slate-200 bg-slate-50">
            <div className="card p-4">
                <div className="text-xl font-black tracking-tight">Bratnava FC</div>
                <div className="muted">Frontend • React</div>
            </div>

            {/* ✅ Temporário: input do GroupId */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold text-slate-700">GroupId (temporário)</div>
                <div className="mt-2">
                    <input
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        placeholder="ex: 3f401edf-d309-4bae-97d8-28eae0da7a8a"
                        className={[
                            "w-full rounded-xl border px-3 py-2 text-sm outline-none",
                            groupId.length === 0
                                ? "border-slate-200"
                                : groupIdValid
                                    ? "border-green-300 focus:border-green-400"
                                    : "border-red-300 focus:border-red-400",
                        ].join(" ")}
                    />
                </div>

                <div className="mt-2 text-[11px] text-slate-600">
                    {groupId.length === 0 ? (
                        <span>Informe o GroupId para habilitar o Visual Stats.</span>
                    ) : groupIdValid ? (
                        <span className="text-green-700">GroupId válido ✅ (salvo no navegador)</span>
                    ) : (
                        <span className="text-red-700">GroupId inválido ❌ (precisa ser GUID)</span>
                    )}
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                {link('/app', 'Dashboard', Shield)}
                {link('/app/groups', 'Patotas (Groups)', Users2)}

                {/* ✅ Agora usa o GroupId informado */}
                {link(visualStatsUrl, 'Visual Stats', BarChart3, !groupIdValid)}

                {link('/app/players', 'Jogadores (Players)', Users)}
                {link('/app/team-colors', 'Uniformes (TeamColor)', Palette)}
                {link('/app/matches', 'Partidas (Match)', Swords)}
                {link('/app/history', 'Histórico', History)}

                {admin ? link('/app/settings', 'GroupSettings', Settings) : null}
                {admin ? link('/app/admin/users', 'Usuários', Users) : null}
            </div>
        </aside>
    );
}