export const DEFAULT_ADMIN_PASSWORD_HASH =
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

/** SHA-256 of `staff123` */
export const DEFAULT_STAFF_PASSWORD_HASH =
  '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6';

/** Keep in sync with frontend MODULE_OPTIONS ids */
export const ALL_STAFF_MODULE_IDS = [
  '/material-receipt',
  '/under-process',
  '/production-planning',
  '/parties',
  '/purchase-orders',
  '/invoices-pi',
  '/tax-invoice',
  '/monthly-billing',
  '/debit-notes',
  '/credit-notes',
  '/bpr',
  '/psd',
  '/packing-list',
  '/dc',
  '/eway-dc',
  '/eway-ti',
  '/payment-follow-up',
  '/party-due',
  '/payments',
  '/purchase-management',
  '/utility-record',
  '/utility-record-list',
  '/utility-temp-record',
  '/utility-temp-record-list',
  '/pm-air-compressor',
  '/marketing',
  '/marketing-follow-up',
  '/processing-sheet',
  '/tasks',
  '/quotations',
  '/employee-salary',
  '/attendance',
  '/salary-calculation'
];

export const DEFAULT_COMPANY_PROFILE = {
  legalName: 'UMA MICRON',
  displayName: 'UMA MICRON',
  tagline: 'ERP & Process Tracking',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  gstin: '',
  pan: '',
  bankName: '',
  accountNo: '',
  ifsc: '',
  logoDataUrl: ''
};

export function getDefaultErpState() {
  return {
    parties: [],
    items: [],
    materials: [],
    psdRequirements: ['90% < 10M', 'd(0.9) < 10 Micron', 'd(0.9) < 20 Micron', 'N/A'],
    dcDeliveryNotes: [
      'Material sent for Micronisation on Job Work basis. Goods to be returned after processing.'
    ],
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
    settings: {
      userRole: 'Admin',
      theme: 'dark',
      productionPlanProcessingManualOnly: true,
      serials: {
        MR: 1,
        BPR: 1,
        PL: 1,
        PI: 1,
        DC: 1,
        MI: 1,
        VC: 1,
        PSD: 1,
        TI: 1,
        EWDC: 1,
        EWTI: 1,
        QT: 1,
        DN: 1,
        CN: 1,
        PO: 1
      }
    },
    companyProfile: { ...DEFAULT_COMPANY_PROFILE }
  };
}

export function getDefaultUsers() {
  const staffPerms = [...ALL_STAFF_MODULE_IDS];
  return [
    {
      id: 1,
      employeeId: 'EMP001',
      department: 'Management',
      name: 'Administrator',
      username: 'admin',
      role: 'Admin',
      active: true,
      permissions: [],
      passwordHash: DEFAULT_ADMIN_PASSWORD_HASH
    },
    {
      id: 2,
      employeeId: 'EMP002',
      department: 'Production',
      name: 'Staff One',
      username: 'staff1',
      role: 'Staff',
      permissions: staffPerms,
      active: true,
      passwordHash: DEFAULT_STAFF_PASSWORD_HASH
    },
    {
      id: 3,
      employeeId: 'EMP003',
      department: 'Packaging',
      name: 'Staff Two',
      username: 'staff2',
      role: 'Staff',
      permissions: staffPerms,
      active: true,
      passwordHash: DEFAULT_STAFF_PASSWORD_HASH
    },
    {
      id: 4,
      employeeId: 'EMP004',
      department: 'Quality Control',
      name: 'Staff Three',
      username: 'staff3',
      role: 'Staff',
      permissions: staffPerms,
      active: true,
      passwordHash: DEFAULT_STAFF_PASSWORD_HASH
    }
  ];
}
