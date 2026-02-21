import { Navigate } from 'react-router-dom';
import { isAdmin } from '../auth/guards';

export default function AdminRoute({ children }: { children: JSX.Element }){
  if (!isAdmin()) return <Navigate to="/app" replace />;
  return children;
}
