import { Navigate } from 'react-router-dom';
import { useAccountStore } from '../auth/accountStore';

/**
 * Permite acesso a usuários que são administradores globais (Admin/GodMode)
 * OU administradores da patota ativa.
 */
export default function GroupAdminRoute({ children }: { children: JSX.Element }) {
    const activeGroupId = useAccountStore((s) => s.getActive()?.activeGroupId ?? '');
    const roles         = useAccountStore((s) => s.getActive()?.roles ?? []);
    const isGroupAdmin  = useAccountStore((s) => s.isGroupAdmin);

    // Admins e GodMode globais sempre têm acesso, mesmo sem patota ativa
    const isGlobalAdmin = roles.includes('Admin') || roles.includes('GodMode');
    if (!isGlobalAdmin && !isGroupAdmin(activeGroupId)) return <Navigate to="/app" replace />;
    return children;
}
