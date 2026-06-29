import { DEFAULT_COMPANY_PROFILE, mergeCompanyProfile } from './companyProfile';
import { flattenMRChargeSnapshot } from './documentCharges';

const normName = (s) => (s || '').trim().toLowerCase();

export const DEFAULT_ADMIN_PASSWORD_HASH =
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

export const createBaseState = () => ({
  parties: [],
  items: [],
  materials: [],
  psdRequirements: ['90% < 10M', 'd(0.9) < 10 Micron', 'd(0.9) < 20 Micron'],
  units: ['Kg', 'MT', 'Drum', 'Ltr', 'Pcs'],
  taxes: [
    { name: 'GST 18%', rate: 18 },
    { name: 'GST 12%', rate: 12 },
    { name: 'GST 5%', rate: 5 }
  ],
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
    { id: 1, employeeId: 'EMP001', department: 'Management', name: 'Administrator', username: 'admin', role: 'Admin', active: true, passwordHash: DEFAULT_ADMIN_PASSWORD_HASH },
    { id: 2, employeeId: 'EMP002', department: 'Production', name: 'Staff One', username: 'staff1', role: 'Staff', permissions: [], active: true },
    { id: 3, employeeId: 'EMP003', department: 'Packaging', name: 'Staff Two', username: 'staff2', role: 'Staff', permissions: [], active: true },
    { id: 4, employeeId: 'EMP004', department: 'Quality Control', name: 'Staff Three', username: 'staff3', role: 'Staff', permissions: [], active: true }
  ],
  currentUser: null,
  settings: {
    userRole: 'Admin',
    theme: 'dark',
    serials: { MR: 1, BPR: 1, PL: 1, PI: 1, DC: 1, MI: 1, VC: 1, PSD: 1, TI: 1, EWDC: 1, EWTI: 1, QT: 1, DN: 1, CN: 1, PO: 1 }
  },
  companyProfile: { ...DEFAULT_COMPANY_PROFILE }
});

const migrateMaterialReceipts = (receipts, parties) =>
  (receipts || []).map(mr => {
    const party = (parties || []).find(p => p.id === mr.partyId)
      || (parties || []).find(p => normName(p.name) === normName(mr.partyName));
    const flat = flattenMRChargeSnapshot(mr, party);
    if (!flat) return mr;
    return {
      ...mr,
      charges: flat.charges,
      rates: flat.rates,
      qtys: flat.qtys,
      customCharges: flat.customCharges || mr.customCharges || []
    };
  });

const isAutoFilledProcessingPlan = (plan) => {
  const hoursNum = parseFloat(plan?.hours);
  return plan?.startTime === '09:00'
    && plan?.endTime === '17:00'
    && (hoursNum === 8 || plan?.hours === '8.00');
};

const clearAutoFilledProcessingFields = (plan) => ({
  ...plan,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  hours: '',
  supervisor: '',
  delayReason: ''
});

const normalizeProductionPlans = (plans, migrated) => {
  if (migrated) return plans || [];
  return (plans || []).map(plan => (
    isAutoFilledProcessingPlan(plan) ? clearAutoFilledProcessingFields(plan) : plan
  ));
};

export const normalizeAppState = (parsed) => {
  const baseState = createBaseState();
  if (!parsed || typeof parsed !== 'object') return baseState;

  const processingFieldsMigrated = parsed.settings?.productionPlanProcessingManualOnly;

  return {
    ...baseState,
    ...parsed,
    materialReceipts: migrateMaterialReceipts(parsed.materialReceipts, parsed.parties),
    settings: {
      ...baseState.settings,
      ...parsed.settings,
      productionPlanProcessingManualOnly: true,
      serials: {
        ...baseState.settings.serials,
        ...(parsed.settings?.serials || {}),
        ...(parsed.settings?.serials?.QUOTATION && !parsed.settings?.serials?.QT ? { QT: parsed.settings.serials.QUOTATION } : {}),
        ...(parsed.settings?.serials?.INV && !parsed.settings?.serials?.TI ? { TI: parsed.settings.serials.INV } : {})
      }
    },
    items: parsed.items || [],
    materials: parsed.materials || [],
    stockAdjustments: parsed.stockAdjustments || [],
    deliveryChallans: parsed.deliveryChallans || [],
    psds: parsed.psds || [],
    productionPlans: normalizeProductionPlans(parsed.productionPlans, processingFieldsMigrated),
    payments: parsed.payments || [],
    bprs: parsed.bprs || [],
    packingLists: parsed.packingLists || [],
    invoices: parsed.invoices || [],
    quotations: parsed.quotations || [],
    debitNotes: parsed.debitNotes || [],
    creditNotes: parsed.creditNotes || [],
    purchaseOrders: parsed.purchaseOrders || [],
    auditLogs: parsed.auditLogs || [],
    users: (parsed.users || baseState.users).map((u, i) => {
      const isAdminUser = u.role === 'Admin' && (u.username?.toLowerCase() === 'admin' || u.id === 1);
      return {
        ...u,
        employeeId: u.employeeId || `EMP00${i + 1}`,
        department: u.department || 'General',
        name: u.name || u.username,
        username: u.username?.toLowerCase() === 'admin' ? 'admin' : u.username,
        passwordHash: u.passwordHash || (isAdminUser ? DEFAULT_ADMIN_PASSWORD_HASH : undefined)
      };
    }),
    currentUser: null,
    companyProfile: mergeCompanyProfile(parsed.companyProfile)
  };
};

export const loadStateFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem('uma_erp_data');
    if (!saved) return createBaseState();
    return normalizeAppState(JSON.parse(saved));
  } catch {
    return createBaseState();
  }
};
