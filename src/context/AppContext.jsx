import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  fetchAppState,
  saveAppState,
  isApiModeEnabled,
  getAuthToken
} from '../api/client';
import { loadStateFromLocalStorage, normalizeAppState } from '../utils/appState';
import { mergeCompanyProfile } from '../utils/companyProfile';
import { syncAllTaxInvoicesWithProformas } from '../utils/documentCharges';

export const AppContext = createContext(null);

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

    try {
      localStorage.setItem('uma_erp_data', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to persist data to localStorage', e);
    }

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

    return undefined;
  }, [data, isReady, apiMode]);

  useEffect(() => {
    const theme = data.settings?.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }, [data.settings?.theme]);

  const logAudit = (prevData, action, module, oldValue, newValue) => {
    const now = new Date();
    const cu = prevData.currentUser;
    const user = String(cu?.name || cu?.username || prevData.settings?.userRole || 'System').trim() || 'System';
    const refId = String(newValue?.id || oldValue?.id || '');
    const refNo = String(
      newValue?.bprNo
      || newValue?.invoiceNo
      || newValue?.plNo
      || newValue?.dcNo
      || newValue?.noteNo
      || newValue?.poNo
      || oldValue?.bprNo
      || oldValue?.invoiceNo
      || oldValue?.plNo
      || oldValue?.dcNo
      || oldValue?.noteNo
      || oldValue?.poNo
      || ''
    ).trim();

    const changes = [];
    if (action === 'UPDATE' && oldValue && newValue) {
      Object.keys(newValue).forEach(key => {
        if (key === 'id' || key === 'updatedAt' || key === 'createdAt' || key === 'createdBy' || key === 'updatedBy' || key === 'doneBy') return;
        if (typeof newValue[key] === 'object' || typeof oldValue[key] === 'object') return;
        if (oldValue[key] !== newValue[key]) {
          changes.push({ field: key, from: oldValue[key] ?? '', to: newValue[key] ?? '' });
        }
      });
    }

    const details =
      action === 'UPDATE' && changes.length
        ? changes.map(c => `${c.field} changed from ${c.from || 'empty'} → ${c.to || 'empty'}`).join(', ')
        : (refNo ? `${action} ${refNo}` : '');

    const message =
      action === 'UPDATE' && changes.length
        ? `${details} by ${user} at ${now.toLocaleTimeString()}`
        : `${action}${refNo ? ` ${refNo}` : ''} by ${user} at ${now.toLocaleString()}`;

    const newLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      action,
      module,
      refId,
      refNo,
      details,
      changes,
      oldValue: action === 'UPDATE' ? oldValue : null,
      // Keep a slim CREATE snapshot so Done By logs can resolve older/newer docs.
      newValue: action === 'UPDATE'
        ? newValue
        : (newValue ? {
          id: newValue.id,
          bprNo: newValue.bprNo,
          invoiceNo: newValue.invoiceNo,
          plNo: newValue.plNo,
          dcNo: newValue.dcNo,
          noteNo: newValue.noteNo,
          poNo: newValue.poNo,
          partyName: newValue.partyName,
          doneBy: newValue.doneBy,
          createdBy: newValue.createdBy
        } : null),
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

  const actorName = (prev) => {
    const u = prev.currentUser;
    return String(u?.name || u?.username || prev.settings?.userRole || 'System').trim() || 'System';
  };

  const updateData = (module, newItem) => {
    setData(prev => {
      if (prev[module] != null && !Array.isArray(prev[module])) {
        console.error(`Module ${module} is not a list collection.`);
        return prev;
      }
      const now = new Date().toISOString();
      const who = newItem?.createdBy || newItem?.doneBy || actorName(prev);
      const stamped = {
        ...newItem,
        createdAt: newItem?.createdAt || now,
        createdBy: who,
        doneBy: newItem?.doneBy || who
      };
      let nextModule = [...(prev[module] || []), stamped];
      if (module === 'invoices') {
        const synced = syncAllTaxInvoicesWithProformas(nextModule);
        nextModule = synced.invoices;
      }
      return {
        ...prev,
        [module]: nextModule,
        auditLogs: logAudit(prev, 'CREATE', module, null, stamped)
      };
    });
  };

  const updateItem = (module, id, updatedItem) => {
    setData(prev => {
      const matchId = (itemId) => String(itemId) === String(id);
      const oldItem = (prev[module] || []).find(i => matchId(i.id));
      const now = new Date().toISOString();
      const who = actorName(prev);
      const stamped = {
        ...updatedItem,
        id: oldItem?.id ?? id,
        createdAt: oldItem?.createdAt || updatedItem?.createdAt || now,
        createdBy: oldItem?.createdBy || updatedItem?.createdBy || '',
        doneBy: updatedItem?.doneBy || oldItem?.doneBy || oldItem?.createdBy || who,
        updatedAt: now,
        updatedBy: who
      };
      let nextModule = (prev[module] || []).map(item => matchId(item.id) ? stamped : item);
      if (module === 'invoices') {
        const synced = syncAllTaxInvoicesWithProformas(nextModule);
        nextModule = synced.invoices;
      }
      return {
        ...prev,
        [module]: nextModule,
        auditLogs: logAudit(prev, 'UPDATE', module, oldItem, stamped)
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
