import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  fetchAppState,
  saveAppState,
  isApiModeEnabled,
  getAuthToken
} from '../api/client';
import { loadStateFromLocalStorage, normalizeAppState } from '../utils/appState';
import { mergeCompanyProfile } from '../utils/companyProfile';

const AppContext = createContext();

const SERIAL_KEY_ALIASES = {
  QUOTATION: 'QT',
  INV: 'TI'
};

const normalizeSerialKey = (key) => SERIAL_KEY_ALIASES[key] || key;

export const AppProvider = ({ children }) => {
  const [data, setData] = useState(() => loadStateFromLocalStorage());
  const [isReady, setIsReady] = useState(false);
  const [apiMode, setApiMode] = useState(() => isApiModeEnabled());
  const saveTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (apiMode && getAuthToken()) {
        try {
          const remote = await fetchAppState();
          if (!cancelled) setData(normalizeAppState(remote));
        } catch (err) {
          console.warn('Failed to load from API, using local data.', err);
          if (!cancelled) {
            setApiMode(false);
            setData(loadStateFromLocalStorage());
          }
        }
      }
      if (!cancelled) setIsReady(true);
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isReady) return undefined;

    if (apiMode && getAuthToken()) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveAppState(data).catch((err) => {
          console.error('Failed to save to API', err);
        });
      }, 900);
      return () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      };
    }

    try {
      localStorage.setItem('uma_erp_data', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to persist data to localStorage', e);
    }
    return undefined;
  }, [data, isReady, apiMode]);

  useEffect(() => {
    const theme = data.settings?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [data.settings?.theme]);

  const logAudit = (prevData, action, module, oldValue, newValue) => {
    const now = new Date();
    const user = prevData.currentUser ? prevData.currentUser.username : (prevData.settings?.userRole || 'System');

    const changes = [];
    if (action === 'UPDATE' && oldValue && newValue) {
      Object.keys(newValue).forEach(key => {
        if (key === 'id' || key === 'updatedAt' || key === 'createdAt') return;
        if (typeof newValue[key] === 'object' || typeof oldValue[key] === 'object') return;
        if (oldValue[key] !== newValue[key]) {
          changes.push({ field: key, from: oldValue[key] ?? '', to: newValue[key] ?? '' });
        }
      });
    }

    const details =
      action === 'UPDATE' && changes.length
        ? changes.map(c => `${c.field} changed from ${c.from || 'empty'} → ${c.to || 'empty'}`).join(', ')
        : '';

    const message =
      action === 'UPDATE' && changes.length
        ? `${details} by ${user} at ${now.toLocaleTimeString()}`
        : `${action} by ${user} at ${now.toLocaleString()}`;

    const newLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      action,
      module,
      details,
      changes,
      oldValue: action === 'UPDATE' ? oldValue : null,
      newValue: action === 'UPDATE' ? newValue : null,
      message,
      user,
      timestamp: now.toISOString()
    };
    return [...(prevData.auditLogs || []), newLog];
  };

  const hydrateFromServer = (remoteState) => {
    setData(normalizeAppState(remoteState));
    setApiMode(true);
    setIsReady(true);
  };

  const updateData = (module, newItem) => {
    if (!data[module]) {
      console.error(`Module ${module} not found in state.`);
      return;
    }
    setData(prev => ({
      ...prev,
      [module]: [...(prev[module] || []), newItem],
      auditLogs: logAudit(prev, 'CREATE', module, null, newItem)
    }));
  };

  const updateItem = (module, id, updatedItem) => {
    setData(prev => {
      const oldItem = (prev[module] || []).find(i => i.id === id);
      return {
        ...prev,
        [module]: (prev[module] || []).map(item => item.id === id ? updatedItem : item),
        auditLogs: logAudit(prev, 'UPDATE', module, oldItem, updatedItem)
      };
    });
  };

  const deleteItemSoftly = (module, id) => {
    setData(prev => {
      if (prev.settings?.userRole !== 'Admin') {
        alert("Only Admin can delete records.");
        return prev;
      }
      const oldItem = (prev[module] || []).find(i => i.id === id);
      if (!oldItem) return prev;
      const updatedItem = { ...oldItem, isDeleted: true, deletedAt: new Date().toISOString() };
      return {
        ...prev,
        [module]: (prev[module] || []).map(item => item.id === id ? updatedItem : item),
        auditLogs: logAudit(prev, 'DELETE', module, oldItem, updatedItem)
      };
    });
  };

  const restoreItem = (module, id) => {
    setData(prev => {
      const oldItem = (prev[module] || []).find(i => i.id === id);
      if (!oldItem) return prev;
      const updatedItem = { ...oldItem, isDeleted: false, deletedAt: undefined };
      return {
        ...prev,
        [module]: (prev[module] || []).map(item => item.id === id ? updatedItem : item),
        auditLogs: logAudit(prev, 'RESTORE', module, oldItem, updatedItem)
      };
    });
  };

  const hardDeleteItem = (module, id) => {
    if (data.settings?.userRole !== 'Admin') {
      alert("Only Admin can permanently delete records.");
      return;
    }
    setData(prev => {
      const oldItem = (prev[module] || []).find(i => i.id === id);
      if (!oldItem) return prev;
      return {
        ...prev,
        [module]: (prev[module] || []).filter(item => item.id !== id),
        auditLogs: logAudit(prev, 'HARD_DELETE', module, oldItem, null)
      };
    });
  };

  const incrementSerial = (docType) => {
    const canonicalKey = normalizeSerialKey(docType);
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        serials: {
          ...prev.settings.serials,
          [canonicalKey]: (prev.settings.serials[canonicalKey] || 0) + 1
        }
      }
    }));
  };

  const ensureSerialAtLeast = (docType, minValue) => {
    const canonicalKey = normalizeSerialKey(docType);
    const floor = Math.max(1, parseInt(minValue, 10) || 1);
    setData(prev => {
      const current = prev.settings.serials[canonicalKey] || 1;
      if (floor <= current) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          serials: {
            ...prev.settings.serials,
            [canonicalKey]: floor
          }
        }
      };
    });
  };

  const upsertCompanyProfile = (profile) => {
    setData(prev => ({
      ...prev,
      companyProfile: {
        ...mergeCompanyProfile(prev.companyProfile),
        ...profile,
        updatedAt: new Date().toISOString()
      }
    }));
  };

  return (
    <AppContext.Provider value={{
      data,
      setData,
      isReady,
      apiMode,
      hydrateFromServer,
      updateData,
      updateItem,
      deleteItemSoftly,
      restoreItem,
      hardDeleteItem,
      incrementSerial,
      ensureSerialAtLeast,
      upsertCompanyProfile
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
