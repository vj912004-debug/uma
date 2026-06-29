import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAppContext } from './AppContext';
import { verifyPassword } from '../utils/auth';
import {
  apiLogin,
  setAuthToken,
  clearAuthToken,
  enableApiMode,
  disableApiMode,
  checkApiHealth
} from '../api/client';

const AuthContext = createContext();
const SESSION_KEY = 'uma_auth_session';

export const AuthProvider = ({ children }) => {
  const { data, setData, hydrateFromServer } = useAppContext();
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
    setData(prev => ({
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

  useEffect(() => {
    if (sessionUserId && !currentUser) {
      setSessionUserId(null);
      localStorage.removeItem(SESSION_KEY);
      clearAuthToken();
      disableApiMode();
    }
    setIsLoading(false);
  }, [sessionUserId, currentUser]);

  const loginLocal = async (username, password) => {
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

  const login = async (username, password) => {
    const apiAvailable = await checkApiHealth();

    if (apiAvailable) {
      try {
        const result = await apiLogin(username, password);
        setAuthToken(result.token);
        enableApiMode();
        setSessionUserId(result.user.id);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: result.user.id, loginAt: new Date().toISOString() }));
        hydrateFromServer({
          ...result.state,
          currentUser: {
            id: result.user.id,
            username: result.user.username,
            role: result.user.role,
            employeeId: result.user.employeeId,
            department: result.user.department,
            name: result.user.name
          },
          settings: { ...result.state.settings, userRole: result.user.role }
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || 'Login failed.' };
      }
    }

    return loginLocal(username, password);
  };

  const logout = () => {
    setSessionUserId(null);
    localStorage.removeItem(SESSION_KEY);
    clearAuthToken();
    disableApiMode();
    setData(prev => ({
      ...prev,
      currentUser: null,
      settings: { ...prev.settings, userRole: 'Staff' }
    }));
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
