import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../api/client';

export default function ProtectedRoute({ role, children }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  return children;
}
