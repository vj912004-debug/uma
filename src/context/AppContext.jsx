import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    const savedData = localStorage.getItem('uma_erp_data');
    const baseState = {
      parties: [],
      items: [],
      materials: [],
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
      psds: [],
      productionPlans: [],
      stockAdjustments: [],
      quotations: [],
      debitNotes: [],
      creditNotes: [],
      purchaseOrders: [],
      auditLogs: [],
      users: [
        { id: 1, username: 'Admin', role: 'Admin', active: true },
        { id: 2, username: 'Staff1', role: 'Staff', permissions: [], active: true },
        { id: 3, username: 'Staff2', role: 'Staff', permissions: [], active: true },
        { id: 4, username: 'Staff3', role: 'Staff', permissions: [], active: true }
      ],
      currentUser: { id: 1, username: 'Admin', role: 'Admin' },
      settings: {
        userRole: 'Admin',
        serials: { MR: 1, BPR: 1, PL: 1, INV: 1, PI: 1, DC: 1, MI: 1, VC: 1, PSD: 1, TI: 1, EWDC: 1, EWTI: 1, QT: 1, DN: 1, CN: 1, PO: 1 }
      }
    };

    if (!savedData) return baseState;
    
    try {
      const parsed = JSON.parse(savedData);
      // Deep merge or ensure keys exist
      return {
        ...baseState,
        ...parsed,
        settings: { ...baseState.settings, ...parsed.settings },
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
        users: parsed.users || baseState.users,
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

  // Helper for audit logging
  const logAudit = (prevData, action, module, oldValue, newValue) => {
    let details = '';
    
    if (action === 'UPDATE' && oldValue && newValue) {
      const changes = [];
      Object.keys(newValue).forEach(key => {
        if (key !== 'id' && key !== 'updatedAt' && oldValue[key] !== newValue[key]) {
          if (typeof newValue[key] !== 'object' && typeof oldValue[key] !== 'object') {
             changes.push(`${key} changed from ${oldValue[key] || 'empty'} → ${newValue[key] || 'empty'}`);
          }
        }
      });
      details = changes.join(', ');
    }

    const newLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      action,
      module,
      details, // Store pre-computed details
      user: prevData.currentUser ? prevData.currentUser.username : (prevData.settings?.userRole || 'System'),
      timestamp: new Date().toISOString()
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
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        serials: {
          ...prev.settings.serials,
          [docType]: (prev.settings.serials[docType] || 0) + 1
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
