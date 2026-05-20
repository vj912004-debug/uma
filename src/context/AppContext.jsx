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
      settings: {
        userRole: 'Admin',
        serials: { MR: 1, BPR: 1, PL: 1, INV: 1, PI: 1, DC: 1, MI: 1, VC: 1, PSD: 1, TI: 1, EWDC: 1, EWTI: 1 }
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
        invoices: parsed.invoices || []
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

  const updateData = (module, newItem) => {
    if (!data[module]) {
      console.error(`Module ${module} not found in state.`);
      return;
    }
    setData(prev => ({
      ...prev,
      [module]: [...(prev[module] || []), newItem]
    }));
  };

  const updateItem = (module, id, updatedItem) => {
    setData(prev => ({
      ...prev,
      [module]: (prev[module] || []).map(item => item.id === id ? updatedItem : item)
    }));
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
    <AppContext.Provider value={{ data, setData, updateData, updateItem, incrementSerial }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
