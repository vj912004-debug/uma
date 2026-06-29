export const DEFAULT_ADMIN_PASSWORD_HASH =
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

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
      permissions: [],
      active: true,
      passwordHash: null
    },
    {
      id: 3,
      employeeId: 'EMP003',
      department: 'Packaging',
      name: 'Staff Two',
      username: 'staff2',
      role: 'Staff',
      permissions: [],
      active: true,
      passwordHash: null
    },
    {
      id: 4,
      employeeId: 'EMP004',
      department: 'Quality Control',
      name: 'Staff Three',
      username: 'staff3',
      role: 'Staff',
      permissions: [],
      active: true,
      passwordHash: null
    }
  ];
}
