import React, { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'uma_portal';
const PortalContext = createContext(null);

const MARKETING_PORTAL_PATHS = [
  '/marketing',
  '/purchase-management',
  '/utility-record',
  '/utility-temp-record',
  '/pm-air-compressor'
];

export const isMarketingPath = (pathname = '') =>
  MARKETING_PORTAL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}-`) || pathname.startsWith(`${path}/`));

const readPortal = () => (sessionStorage.getItem(STORAGE_KEY) === 'marketing' ? 'marketing' : 'erp');

export const PortalProvider = ({ children }) => {
  const [portal, setPortalState] = useState(readPortal);

  const setPortal = (next) => {
    const value = next === 'marketing' ? 'marketing' : 'erp';
    sessionStorage.setItem(STORAGE_KEY, value);
    setPortalState(value);
  };

  const value = useMemo(() => ({
    portal,
    isMarketing: portal === 'marketing',
    setPortal
  }), [portal]);

  return (
    <PortalContext.Provider value={value}>
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = () => {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
};
