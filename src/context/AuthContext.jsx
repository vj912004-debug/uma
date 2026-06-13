import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAppContext } from './AppContext';
import { verifyPassword } from '../utils/auth';

const AuthContext = createContext();
const SESSION_KEY = 'uma_auth_session';

export const AuthProvider = ({ children }) => {
  const { data, setData } = useAppContext();
  const [sessionUserId, setSessionUserId] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved).userId : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = sessionUserId
    ? data.users?.find((u) => u.id === sessionUserId && u.active !== false) || null
    : null;

  const isAuthenticated = !!currentUser;
  const isAdmin = currentUser?.role === 'Admin';

  const syncUserToApp = useCallback((user) => {
    if (!user) return;
    setData((prev) => ({
      ...prev,
      currentUser: {
        id: user.id,
        username: user.username,
        role: user.role,
        employeeId: user.employeeId,
        department: user.department,
        name: user.name
      },
      settings: { ...prev.settings, userRole: user.role }
    }));
  }, [setData]);

  const clearUserFromApp = useCallback(() => {
    setData((prev) => ({
      ...prev,
      currentUser: null,
      settings: { ...prev.settings, userRole: 'Staff' }
    }));
  }, [setData]);

  useEffect(() => {
    if (sessionUserId && currentUser) {
      syncUserToApp(currentUser);
    } else if (sessionUserId && !currentUser) {
      setSessionUserId(null);
      localStorage.removeItem(SESSION_KEY);
      clearUserFromApp();
    }
    setIsLoading(false);
  }, [sessionUserId, currentUser, syncUserToApp, clearUserFromApp]);

  const login = async (username, password) => {
    const normalized = username.trim().toLowerCase();
    const user = data.users?.find(
      (u) => u.username?.toLowerCase() === normalized && u.active !== false
    );

    if (!user) {
      return { success: false, error: 'Invalid username or password.' };
    }

    if (!user.passwordHash) {
      return { success: false, error: 'No login credentials set. Contact your administrator.' };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { success: false, error: 'Invalid username or password.' };
    }

    setSessionUserId(user.id);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, loginAt: new Date().toISOString() }));
    syncUserToApp(user);
    return { success: true };
  };

  const logout = () => {
    setSessionUserId(null);
    localStorage.removeItem(SESSION_KEY);
    clearUserFromApp();
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
