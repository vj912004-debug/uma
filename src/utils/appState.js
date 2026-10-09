import { DEFAULT_COMPANY_PROFILE, mergeCompanyProfile } from './companyProfile';
import { flattenMRChargeSnapshot, syncAllTaxInvoicesWithProformas } from './documentCharges';
import { ALL_STAFF_MODULE_IDS, parsePermissionsList } from './moduleAccess';
import { DEFAULT_ADMIN_PASSWORD_HASH, DEFAULT_STAFF_PASSWORD_HASH } from './auth';
import { defaultEsslSettings } from './payroll';

const normName = (s) => (s || '').trim().toLowerCase();

export { DEFAULT_ADMIN_PASSWORD_HASH, DEFAULT_STAFF_PASSWORD_HASH };

const SEED_STAFF_USERNAMES = new Set(['staff1', 'staff2', 'staff3']);

const NAMED_ADMINS = [
  {
    username: 'Amit@umamicron.com',
    name: 'Amit',
    employeeId: 'EMP005',
    passwordHash: '99e4dfcc5775bd9489af7c0bb8fd27243a3b90239c8149d9f0beadf62c6fa457'
  },
  {
    username: 'Gloria@umamicron.com',
    name: 'Gloria',
    employeeId: 'EMP006',
    passwordHash: 'a15ee0fa86af02cd68a46ea394f0876a3cb444e71ea1c7f0992e75fd98888e54'
  }
];

const namedAdminRecord = (admin, id) => ({
  id,
  employeeId: admin.employeeId,
  department: 'Management',
  name: admin.name,
  username: admin.username,
  role: 'Admin',
  active: true,
  permissions: [],
  moduleAccessConfigured: true,
  passwordHash: admin.passwordHash,
  esslId: '',
  shiftType: '9hr',
  perDayRate: 0,
  otRate: 0,
  effectiveFrom: '',
  rateHistory: []
});

export const createBaseState = () => ({
  parties: [],
  items: [],
  materials: [],
  psdRequirements: ['90% < 10M', 'd(0.9) < 10 Micron', 'd(0.9) < 20 Micron', 'N/A'],
  dcDeliveryNotes: [
    'Material sent for Micronisation on Job Work basis. Goods to be returned after processing.'
  ],
  tiNotes: [],
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
  paymentFollowUps: [],
  paymentPromises: [],
  tasks: [],
  attendance: [],
  salaryRates: null,
  salaryReports: [],
  psds: [],
  productionPlans: [],
  stockAdjustments: [],
  quotations: [],
  debitNotes: [],
  creditNotes: [],
  purchaseOrders: [],
  purchaseManagement: [],
  purchaseStock: [],
  purchaseSuppliers: [],
  purchaseQuotes: [],
  purchaseFollowUps: [],
  purchaseReceipts: [],
  purchaseIssues: [],
  purchaseAttachments: [],
  marketingLeads: [],
  marketingFollowUps: [],
  marketingEnquiries: [],
  marketingOrders: [],
  utilityRecords: [],
  utilityTempRecords: [],
  pmAirCompressorRecords: [],
  auditLogs: [],
  esslSettings: defaultEsslSettings(),
  users: [
    {
      id: 1, employeeId: 'EMP001', department: 'Management', name: 'Administrator', username: 'admin', role: 'Admin',
      active: true, permissions: [], moduleAccessConfigured: true, passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
      esslId: '', shiftType: '9hr', perDayRate: 0, otRate: 0, effectiveFrom: '', rateHistory: []
    },
    {
      id: 2, employeeId: 'EMP002', department: 'Production', name: 'Staff One', username: 'staff1', role: 'Staff',
      permissions: [...ALL_STAFF_MODULE_IDS], moduleAccessConfigured: true, active: true, passwordHash: DEFAULT_STAFF_PASSWORD_HASH,
      esslId: '1001', shiftType: '9hr', perDayRate: 800, otRate: 100, effectiveFrom: '2025-04-01',
      rateHistory: [{ id: 'rh-2-1', effectiveFrom: '2025-04-01', perDayRate: 800, otRate: 100 }]
    },
    {
      id: 3, employeeId: 'EMP003', department: 'Packaging', name: 'Staff Two', username: 'staff2', role: 'Staff',
      permissions: [...ALL_STAFF_MODULE_IDS], moduleAccessConfigured: true, active: true, passwordHash: DEFAULT_STAFF_PASSWORD_HASH,
      esslId: '1002', shiftType: '12hr', perDayRate: 950, otRate: 120, effectiveFrom: '2025-04-01',
      rateHistory: [{ id: 'rh-3-1', effectiveFrom: '2025-04-01', perDayRate: 950, otRate: 120 }]
    },
    {
      id: 4, employeeId: 'EMP004', department: 'Quality Control', name: 'Staff Three', username: 'staff3', role: 'Staff',
      permissions: [...ALL_STAFF_MODULE_IDS], moduleAccessConfigured: true, active: true, passwordHash: DEFAULT_STAFF_PASSWORD_HASH,
      esslId: '1003', shiftType: '9hr', perDayRate: 850, otRate: 110, effectiveFrom: '2025-04-01',
      rateHistory: [{ id: 'rh-4-1', effectiveFrom: '2025-04-01', perDayRate: 850, otRate: 110 }]
    },
    ...NAMED_ADMINS.map((admin, index) => namedAdminRecord(admin, 5 + index))
  ],
  currentUser: null,
  settings: {
    userRole: 'Admin',
    theme: 'light',
    serials: { MR: 1, BPR: 1, PL: 1, PI: 1, DC: 1, MI: 1, VC: 1, PSD: 1, TI: 1, EWDC: 1, EWTI: 1, QT: 1, DN: 1, CN: 1, PO: 1, INQ: 1 }
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
  const rawInvoices = parsed.invoices || [];
  const { invoices: syncedInvoices } = syncAllTaxInvoicesWithProformas(rawInvoices);

  return {
    ...baseState,
    ...parsed,
    materialReceipts: migrateMaterialReceipts(parsed.materialReceipts, parsed.parties),
    psdRequirements: (() => {
      const list = [...(parsed.psdRequirements || baseState.psdRequirements || [])];
      if (!list.some((r) => String(r).trim().toUpperCase() === 'N/A')) list.push('N/A');
      return list;
    })(),
    dcDeliveryNotes: (() => {
      const list = [...(parsed.dcDeliveryNotes || [])];
      if (list.length === 0) return [...(baseState.dcDeliveryNotes || [])];
      return list;
    })(),
    tiNotes: (() => {
      const list = [...(parsed.tiNotes || [])];
      return list;
    })(),
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
    paymentFollowUps: parsed.paymentFollowUps || [],
    paymentPromises: parsed.paymentPromises || [],
    bprs: parsed.bprs || [],
    packingLists: parsed.packingLists || [],
    invoices: syncedInvoices,
    quotations: parsed.quotations || [],
    debitNotes: parsed.debitNotes || [],
    creditNotes: parsed.creditNotes || [],
    purchaseOrders: parsed.purchaseOrders || [],
    purchaseManagement: parsed.purchaseManagement || [],
    purchaseStock: parsed.purchaseStock || [],
    purchaseSuppliers: parsed.purchaseSuppliers || [],
    purchaseQuotes: parsed.purchaseQuotes || [],
    purchaseFollowUps: parsed.purchaseFollowUps || [],
    purchaseReceipts: parsed.purchaseReceipts || [],
    purchaseIssues: parsed.purchaseIssues || [],
    purchaseAttachments: parsed.purchaseAttachments || [],
    marketingLeads: parsed.marketingLeads || [],
    marketingFollowUps: parsed.marketingFollowUps || [],
    marketingEnquiries: parsed.marketingEnquiries || [],
    marketingOrders: parsed.marketingOrders || [],
    utilityRecords: parsed.utilityRecords || [],
    utilityTempRecords: parsed.utilityTempRecords || [],
    pmAirCompressorRecords: parsed.pmAirCompressorRecords || [],
    salaryRates: parsed.salaryRates || null,
    salaryReports: parsed.salaryReports || [],
    auditLogs: parsed.auditLogs || [],
    users: (() => {
      const mapped = (parsed.users || baseState.users).map((u, i) => {
      const username = u.username?.toLowerCase() === 'admin' ? 'admin' : u.username;
      const isAdminUser = u.role === 'Admin' && (username === 'admin' || u.id === 1);
      const isStaff = u.role === 'Staff' || (!isAdminUser && u.role !== 'Admin');
      const rawPerms = parsePermissionsList(u.permissions);
      // Only expand empty → full list for legacy Staff who never had module access configured.
      // Once admin saves (moduleAccessConfigured), respect the saved list — including after deselect.
      const accessConfigured = u.moduleAccessConfigured === true || rawPerms.length > 0;
      const permissions = isAdminUser
        ? []
        : (accessConfigured ? rawPerms : (isStaff ? [...ALL_STAFF_MODULE_IDS] : []));
      let passwordHash = u.passwordHash;
      if (!passwordHash || String(passwordHash).startsWith('000000000000')) {
        if (isAdminUser) passwordHash = DEFAULT_ADMIN_PASSWORD_HASH;
        else if (SEED_STAFF_USERNAMES.has(String(username || '').toLowerCase())) {
          passwordHash = DEFAULT_STAFF_PASSWORD_HASH;
        } else {
          passwordHash = passwordHash || undefined;
        }
      }
      let rateHistory = Array.isArray(u.rateHistory) ? [...u.rateHistory] : [];
      const shiftType = u.shiftType === '12hr' ? '12hr' : '9hr';
      let perDayRate = Number(u.perDayRate) || 0;
      let otRate = Number(u.otRate) || 0;
      let effectiveFrom = u.effectiveFrom || '';
      if (!rateHistory.length && (perDayRate || otRate)) {
        rateHistory = [{
          id: `rh-mig-${u.id || i}`,
          effectiveFrom: effectiveFrom || '2025-04-01',
          perDayRate,
          otRate
        }];
        if (!effectiveFrom) effectiveFrom = '2025-04-01';
      }
      const seedEssl = { staff1: '1001', staff2: '1002', staff3: '1003' };
      const esslId = u.esslId != null && u.esslId !== ''
        ? String(u.esslId)
        : (seedEssl[String(username || '').toLowerCase()] || '');
      return {
        ...u,
        employeeId: u.employeeId || `EMP00${i + 1}`,
        department: u.department || 'General',
        name: u.name || u.username,
        username,
        role: isAdminUser ? 'Admin' : (u.role || 'Staff'),
        permissions,
        moduleAccessConfigured: isAdminUser ? true : (accessConfigured || u.moduleAccessConfigured === true),
        passwordHash,
        esslId,
        shiftType,
        perDayRate,
        otRate,
        effectiveFrom,
        rateHistory
      };
    });
      const byName = new Map(mapped.map((u) => [String(u.username || '').toLowerCase(), u]));
      NAMED_ADMINS.forEach((admin) => {
        const key = admin.username.toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          existing.role = 'Admin';
          existing.active = true;
          existing.passwordHash = admin.passwordHash;
          existing.name = existing.name || admin.name;
          existing.department = existing.department || 'Management';
          existing.moduleAccessConfigured = true;
          return;
        }
        const nextId = mapped.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
        const record = namedAdminRecord(admin, nextId);
        mapped.push(record);
        byName.set(key, record);
      });
      return mapped;
    })(),
    attendance: parsed.attendance || [],
    salaryRates: parsed.salaryRates || null,
    salaryReports: parsed.salaryReports || [],
    esslSettings: { ...defaultEsslSettings(), ...(parsed.esslSettings || {}) },
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
