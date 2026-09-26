/** Selectable app modules for Staff login access. Keys are stable path ids. */
export const MODULE_OPTIONS = [
  { id: '/material-receipt', label: 'Material Receipt', group: 'Material' },
  { id: '/under-process', label: 'Under Process', group: 'Material' },
  { id: '/production-planning', label: 'Production Planning', group: 'Material' },
  { id: '/parties', label: 'Master Data', group: 'Material' },

  { id: '/purchase-orders', label: 'Purchase Orders', group: 'Invoices' },
  { id: '/invoices-pi', label: 'Proforma Invoice', group: 'Invoices' },
  { id: '/tax-invoice', label: 'Tax Invoice', group: 'Invoices' },
  { id: '/monthly-billing', label: 'Monthly Billing', group: 'Invoices' },
  { id: '/debit-notes', label: 'Debit Note', group: 'Invoices' },
  { id: '/credit-notes', label: 'Credit Note', group: 'Invoices' },

  { id: '/bpr', label: 'BPR', group: 'Dispatch' },
  { id: '/psd', label: 'PSD Upload', group: 'Dispatch' },
  { id: '/packing-list', label: 'Packing List', group: 'Dispatch' },
  { id: '/dc', label: 'Delivery Challan', group: 'Dispatch' },
  { id: '/eway-dc', label: 'E-Way (DC)', group: 'Dispatch', highlight: true },
  { id: '/eway-ti', label: 'E-Way (TI)', group: 'Dispatch', highlight: true },

  { id: '/payment-follow-up', label: 'Payment Follow-Up', group: 'Payments' },
  { id: '/party-due', label: 'Party Due', group: 'Payments' },
  { id: '/payments', label: 'Payments', group: 'Payments' },

  { id: '/purchase-management', label: 'Purchase Management', group: 'Procurement' },
  { id: '/utility-record', label: 'Utility Record', group: 'Procurement' },
  { id: '/utility-record-list', label: 'Utility Record List', group: 'Procurement' },
  { id: '/utility-temp-record', label: 'Utility Temp. Record', group: 'Procurement' },
  { id: '/utility-temp-record-list', label: 'Temperature Record List', group: 'Procurement' },
  { id: '/pm-air-compressor', label: 'PM Air Compressor', group: 'Procurement' },

  { id: '/marketing', label: 'Marketing / Lead Entry', group: 'Marketing' },
  { id: '/marketing-follow-up', label: 'Marketing Follow Up', group: 'Marketing' },

  { id: '/processing-sheet', label: 'Processing Sheet', group: 'Reports' },
  { id: '/tasks', label: 'Tasks', group: 'Reports' },
  { id: '/quotations', label: 'Quotations', group: 'Reports' },
  { id: '/employee-salary', label: 'Employee Salary', group: 'Reports', highlight: true },
  { id: '/attendance', label: 'Attendance', group: 'Reports' },
  { id: '/salary-calculation', label: 'Salary Calculation', group: 'Reports' }
];

export const ALL_STAFF_MODULE_IDS = MODULE_OPTIONS.map((m) => m.id);

/** Normalize permissions from array / JSON string / null. */
export const parsePermissionsList = (raw) => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((p) => String(p || '').trim()).filter(Boolean))];
};

/** Normalize legacy/alias paths to permission ids. */
export const resolvePermissionId = (pathname = '') => {
  const path = String(pathname).split('?')[0].split('#')[0];
  if (path === '/eway') return '/eway';
  if (path === '/eway-dc' || path === '/eway-ti') return path;
  return path;
};

export const getUserPermissions = (user) => {
  if (!user) return [];
  if (user.role === 'Admin') return ALL_STAFF_MODULE_IDS;
  return parsePermissionsList(user.permissions);
};

export const canAccessModule = (user, pathname) => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  const path = resolvePermissionId(pathname);
  // Dashboard always allowed
  if (path === '/' || path === '') return true;

  const perms = getUserPermissions(user);
  if (!perms.length) return false;

  // Unified E-Way page: allow if either DC or TI (or explicit /eway) is granted
  if (path === '/eway') {
    return perms.includes('/eway') || perms.includes('/eway-dc') || perms.includes('/eway-ti');
  }

  if (perms.includes(path)) return true;

  // Marketing hash routes share /marketing permission
  if (path.startsWith('/marketing')) {
    return perms.includes('/marketing') || perms.includes(path);
  }

  return false;
};

/** Which E-Way document types this user may manage. */
export const getEwayTypeAccess = (user) => {
  if (!user || user.role === 'Admin') return { dc: true, ti: true };
  const perms = getUserPermissions(user);
  const allEway = perms.includes('/eway');
  return {
    dc: allEway || perms.includes('/eway-dc'),
    ti: allEway || perms.includes('/eway-ti')
  };
};

export const groupModuleOptions = () => {
  const map = new Map();
  MODULE_OPTIONS.forEach((m) => {
    if (!map.has(m.group)) map.set(m.group, []);
    map.get(m.group).push(m);
  });
  return [...map.entries()];
};
