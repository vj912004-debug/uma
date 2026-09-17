import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessModule } from '../utils/moduleAccess';

const ProtectedRoute = ({ children, adminOnly = false, modulePath }) => {
  const { isAuthenticated, isAdmin, isLoading, currentUser } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--text-muted)'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const pathToCheck = modulePath || location.pathname;
  if (!adminOnly && !canAccessModule(currentUser, pathToCheck)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
