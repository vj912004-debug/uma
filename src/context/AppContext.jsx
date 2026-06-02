import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

const SERIAL_KEY_ALIASES = {
  // Historical/legacy keys -> canonical keys
  QUOTATION: 'QT',
  INV: 'TI'
};

const normalizeSerialKey = (key) => SERIAL_KEY_ALIASES[key] || key;

export const AppProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    const savedData = localStorage.getItem('uma_erp_data');
    const baseState = {
      parties: [],
      items: [],
      materials: [],
      psdRequirements: [
        '90% < 10M',
        'd(0.9) < 10 Micron',
        'd(0.9) < 20 Micron'
      ],
      units: ['Kg', 'MT', 'Drum', 'Ltr', 'Pcs'],
      taxes: [{ name: 'GST 18%', rate: 18 }, { name: 'GST 12%', rate: 12 }, { name: 'GST 5%', rate: 5 }],
      materialReceipts: [],
      materialIssues: [],
      bprs: [],
      packingLists: [],
      invoices: [],
      deliveryChallans: [],
      payments: [],
      tasks: [],
      attendance: [],
      psds: [],
      productionPlans: [],
      stockAdjustments: [],
      quotations: [],
      debitNotes: [],
      creditNotes: [],
      purchaseOrders: [],
      auditLogs: [],
      users: [
        { id: 1, employeeId: 'EMP001', department: 'Management', username: 'Admin', role: 'Admin', active: true },
        { id: 2, employeeId: 'EMP002', department: 'Production', username: 'Staff1', role: 'Staff', permissions: [], active: true },
        { id: 3, employeeId: 'EMP003', department: 'Packaging', username: 'Staff2', role: 'Staff', permissions: [], active: true },
        { id: 4, employeeId: 'EMP004', department: 'Quality Control', username: 'Staff3', role: 'Staff', permissions: [], active: true }
      ],
      currentUser: { id: 1, username: 'Admin', role: 'Admin' },
      settings: {
        userRole: 'Admin',
        theme: 'dark',
        serials: { MR: 1, BPR: 1, PL: 1, PI: 1, DC: 1, MI: 1, VC: 1, PSD: 1, TI: 1, EWDC: 1, EWTI: 1, QT: 1, DN: 1, CN: 1, PO: 1 }
      }
    };

    if (!savedData) return baseState;
    
    try {
      const parsed = JSON.parse(savedData);
      // Deep merge or ensure keys exist
      return {
        ...baseState,
        ...parsed,
        settings: {
          ...baseState.settings,
          ...parsed.settings,
          serials: {
            ...baseState.settings.serials,
            ...(parsed.settings?.serials || {}),
            // Back-compat: if old keys exist, copy into canonical key (do not overwrite canonical)
            ...(parsed.settings?.serials?.QUOTATION && !parsed.settings?.serials?.QT ? { QT: parsed.settings.serials.QUOTATION } : {}),
            ...(parsed.settings?.serials?.INV && !parsed.settings?.serials?.TI ? { TI: parsed.settings.serials.INV } : {})
          }
        },
        // Ensure arrays exist
        items: parsed.items || [],
        materials: parsed.materials || [],
        stockAdjustments: parsed.stockAdjustments || [],
        deliveryChallans: parsed.deliveryChallans || [],
        psds: parsed.psds || [],
        productionPlans: parsed.productionPlans || [],
        payments: parsed.payments || [],
        bprs: parsed.bprs || [],
        packingLists: parsed.packingLists || [],
        invoices: parsed.invoices || [],
        quotations: parsed.quotations || [],
        debitNotes: parsed.debitNotes || [],
        creditNotes: parsed.creditNotes || [],
        purchaseOrders: parsed.purchaseOrders || [],
        auditLogs: parsed.auditLogs || [],
        users: (parsed.users || baseState.users).map((u, i) => ({
          ...u,
          employeeId: u.employeeId || `EMP00${i + 1}`,
          department: u.department || 'General'
        })),
        currentUser: parsed.currentUser || baseState.currentUser
      };
    } catch (e) {
      return baseState;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('uma_erp_data', JSON.stringify(data));
    } catch (e) {
      console.error("Failed to persist data to localStorage", e);
    }
  }, [data]);

  useEffect(() => {
    const theme = data.settings?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [data.settings?.theme]);

  // Helper for audit logging
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
    // Only Admin can hard delete
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

  return (
    <AppContext.Provider value={{ 
      data, setData, updateData, updateItem, deleteItemSoftly, restoreItem, hardDeleteItem, incrementSerial 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
