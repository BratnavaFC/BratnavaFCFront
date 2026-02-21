import { Navigate } from 'react-router-dom';
import { useAccountStore } from '../auth/accountStore';

export default function ProtectedRoute({ children }: { children: JSX.Element }){
  const active = useAccountStore(s => s.getActive());
  if (!active?.accessToken) return <Navigate to="/login" replace />;
  return children;
}
