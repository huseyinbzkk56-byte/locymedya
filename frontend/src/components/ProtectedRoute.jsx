import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../api/client';

export default function ProtectedRoute({ role, fullAdminOnly, children }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  if (fullAdminOnly && user.role === 'admin' && user.adminScope === 'company') return <Navigate to="/admin" replace />;
  return children;
}
