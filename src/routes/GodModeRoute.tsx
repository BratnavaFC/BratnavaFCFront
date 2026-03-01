import { Navigate } from 'react-router-dom';
import { isGodMode } from '../auth/guards';

export default function GodModeRoute({ children }: { children: JSX.Element }) {
    if (!isGodMode()) return <Navigate to="/app" replace />;
    return children;
}
