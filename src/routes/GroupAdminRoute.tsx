import { Navigate } from 'react-router-dom';
import { useAccountStore } from '../auth/accountStore';

/**
 * Permite acesso a usuários que são administradores globais (Admin/GodMode)
 * OU administradores da patota ativa.
 */
export default function GroupAdminRoute({ children }: { children: JSX.Element }) {
    const activeGroupId = useAccountStore((s) => s.getActive()?.activeGroupId ?? '');
    const isGroupAdmin  = useAccountStore((s) => s.isGroupAdmin);

    if (!isGroupAdmin(activeGroupId)) return <Navigate to="/app" replace />;
    return children;
}
