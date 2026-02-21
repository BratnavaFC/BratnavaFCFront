import { NavLink } from 'react-router-dom';
import { Users, Shield, Users2, Palette, Settings, Swords, History } from 'lucide-react';
import { isAdmin } from '../auth/guards';

const link = (to: string, label: string, Icon: any) => (
  <NavLink
    to={to}
    className={({isActive}) =>
      [
        "flex items-center gap-3 rounded-xl px-3 py-2 border",
        isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"
      ].join(" ")
    }
  >
    <Icon size={18} />
    <span className="font-medium">{label}</span>
  </NavLink>
);

export default function Sidebar(){
  const admin = isAdmin();
  return (
    <aside className="w-72 p-4 border-r border-slate-200 bg-slate-50">
      <div className="card p-4">
        <div className="text-xl font-black tracking-tight">Bratnava FC</div>
        <div className="muted">Frontend • React</div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {link('/app', 'Dashboard', Shield)}
        {link('/app/groups', 'Patotas (Groups)', Users2)}
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
