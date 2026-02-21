import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, UserCircle2, ChevronDown } from 'lucide-react';
import { useAccountStore } from '../auth/accountStore';
import { isAdmin } from '../auth/guards';

export default function Topbar(){
  const nav = useNavigate();
  const { accounts, activeAccountId, setActiveAccount, logout, getActive } = useAccountStore();
  const active = getActive();
  const admin = isAdmin();

  const display = useMemo(() => {
    if (!active) return { name: '—', roles: [] as string[] };
    return { name: active.name || active.email || active.userId, roles: active.roles || [] };
  }, [active]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <UserCircle2 className="text-slate-700" />
        <div>
          <div className="font-semibold leading-tight">{display.name}</div>
          <div className="text-xs text-slate-500">
            {admin ? <span className="pill">Admin</span> : <span className="pill">User</span>}
            <span className="ml-2">Conta ativa</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={activeAccountId}
            onChange={(e) => setActiveAccount(e.target.value)}
            className="input pr-10"
          >
            {accounts.map(a => <option key={a.userId} value={a.userId}>{a.name || a.email || a.userId}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        <button className="btn" onClick={() => nav('/login?add=1')}>Adicionar conta</button>
        <button className="btn btn-danger" onClick={() => { if(active?.userId) logout(active.userId); nav('/login'); }}>
          <LogOut size={16}/> Sair
        </button>
      </div>
    </header>
  );
}
