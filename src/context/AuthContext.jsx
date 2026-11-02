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
  const { data, setData, hydrateFromServer, isReady } = useAppContext();
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
    ? data.users?.find((u) => String(u.id) === String(sessionUserId) && u.active !== false) || null
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
        name: user.name,
        permissions: user.permissions || []
      },
      settings: { ...prev.settings, userRole: user.role }
    }));
  }, [setData]);

  useEffect(() => {
    if (!isReady) return;
    // Don't wipe a session before users are available (empty list / mid-hydrate).
    if (sessionUserId && !currentUser && (data.users || []).length > 0) {
      setSessionUserId(null);
      localStorage.removeItem(SESSION_KEY);
      clearAuthToken();
      disableApiMode();
    }
    setIsLoading(false);
  }, [sessionUserId, currentUser, isReady, data.users]);

  // Keep data.currentUser in sync when admin updates the logged-in user's permissions
  useEffect(() => {
    if (!currentUser) return;
    const snap = data.currentUser;
    const perms = currentUser.permissions || [];
    const same =
      snap &&
      String(snap.id) === String(currentUser.id) &&
      snap.role === currentUser.role &&
      snap.username === currentUser.username &&
      JSON.stringify(snap.permissions || []) === JSON.stringify(perms);
    if (!same) syncUserToApp(currentUser);
  }, [currentUser, data.currentUser, syncUserToApp]);

  const loginLocal = async (username, password) => {
    const normalized = username.trim().toLowerCase();
    const users = Array.isArray(data.users) ? data.users : [];
    const user = users.find(
      (u) => u.username?.toLowerCase() === normalized && u.active !== false
    );

    if (!user) {
      return { success: false, error: 'Invalid username or password.' };
    }

    if (!user.passwordHash || String(user.passwordHash).startsWith('000000000000')) {
      return { success: false, error: 'No login credentials set. Contact your administrator.' };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { success: false, error: 'Invalid username or password.' };
    }

    clearAuthToken();
    disableApiMode();
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
        const loggedInUser = result.user;
        const remoteUsers = Array.isArray(result.state?.users) ? result.state.users : [];
        const hasUserInState = remoteUsers.some((u) => String(u.id) === String(loggedInUser.id));
        const stateUsers = hasUserInState
          ? remoteUsers
          : [
              ...remoteUsers,
              {
                ...loggedInUser,
                active: loggedInUser.active !== false,
                permissions: loggedInUser.permissions || []
              }
            ];

        setAuthToken(result.token);
        enableApiMode();
        hydrateFromServer({
          ...result.state,
          users: stateUsers,
          currentUser: {
            id: loggedInUser.id,
            username: loggedInUser.username,
            role: loggedInUser.role,
            employeeId: loggedInUser.employeeId,
            department: loggedInUser.department,
            name: loggedInUser.name,
            permissions: loggedInUser.permissions || []
          },
          settings: { ...result.state.settings, userRole: loggedInUser.role }
        });
        setSessionUserId(loggedInUser.id);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: loggedInUser.id, loginAt: new Date().toISOString() }));
        return { success: true };
      } catch (err) {
        // API may be up without seeded users — fall back to local demo credentials.
        const local = await loginLocal(username, password);
        if (local.success) return local;
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
