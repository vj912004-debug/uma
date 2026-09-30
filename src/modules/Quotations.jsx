import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Eye, Plus, Trash2, Edit2, GripVertical, Copy } from 'lucide-react';
import { nextAvailableDocNumber } from '../utils/numbering';
import { viewPDF } from '../utils/pdfExport';
import DocDownloadButtons from '../components/DocDownloadButtons';
import ExportButton from '../components/ExportButton';
import { formatDate, newestFirst } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import StatusTabBar from '../components/StatusTabBar';
import DateField from '../components/DateField';
import {
  RATE_UNIT_OPTIONS,
  emptyRateUnits,
  mergeRateUnits,
  defaultRateUnit,
  formatQuotedRate
} from '../utils/quotationRates';
import { qtyInputValue, rateInputValue, parseChargeFieldValue } from '../utils/documentCharges';

const defaultValidityDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

const formatValidityLabel = (isoDate) => {
  if (!isoDate) return '';
  const [y, m, day] = isoDate.split('-');
  return `${day}/${m}/${y}`;
};

const syncValidityInTerms = (terms, isoDate) => {
  const label = formatValidityLabel(isoDate);
  if (!label) return terms || '';
  if (/Validity:\s*[^\n]*/i.test(terms || '')) {
    return (terms || '').replace(/Validity:\s*[^\n]*/i, `Validity: ${label}`);
  }
  return `${terms || ''}\nValidity: ${label}`.trim();
};

const MAIN_CHARGES = [
  { key: 'cleaning', label: 'Minimum Cleaning Charges (998842)', isQtyRate: true },
  { key: 'processing', label: 'Processing Charges (998842)', isQtyRate: true },
  { key: 'sieving', label: 'Sieving Charges (998842)', isQtyRate: true }
];

const OPTIONAL_SERVICE_CHARGES = [
  { key: 'filterBag', label: 'Filter Bag Charges (591190)', isQtyRate: false },
  { key: 'psdReport', label: 'PSD Report Charges (998346)', isQtyRate: false },
  { key: 'liner', label: 'Liner (39233090)', isQtyRate: false },
  { key: 'courier', label: 'Courier (996812)', isQtyRate: false },
  { key: 'fiberDrum', label: 'Fiber Drum (7310)', isQtyRate: false },
  { key: 'transportation', label: 'Transportation (996511)', isQtyRate: false },
  { key: 'hdpeDrum', label: 'HDPE Drum (39233090)', isQtyRate: false },
  { key: 'batchChangeover', label: 'Batch Changeover (998842)', isQtyRate: false }
];

const ALL_CHARGE_DEFS = [...MAIN_CHARGES, ...OPTIONAL_SERVICE_CHARGES];
const ALL_CHARGE_KEYS = ALL_CHARGE_DEFS.map((item) => item.key);

const defaultChargeSection = (key) =>
  MAIN_CHARGES.some((item) => item.key === key) ? 'main' : 'optional';

const getChargeSection = (chargeSection, key) =>
  chargeSection?.[key] || defaultChargeSection(key);

const CHARGE_NOTE_SUGGESTIONS = [
  'Nil if Qty is more than 500kg',
  'if applicable',
  'If Required',
  'Dry Method',
  'Wet Method',
  'Each',
  'Lump Sum'
];

const emptyChargeNotes = () => Object.fromEntries(ALL_CHARGE_KEYS.map((key) => [key, '']));

const ChargeNoteDatalist = () => (
  <datalist id="quote-charge-note-options">
    {CHARGE_NOTE_SUGGESTIONS.map((opt) => (
      <option key={opt} value={opt} />
    ))}
  </datalist>
);

const ChargeNoteInput = ({ value, onChange, placeholder = 'Note e.g. Nil if Qty is more than 500kg' }) => (
  <input
    type="text"
    className="input-field"
    list="quote-charge-note-options"
    placeholder={placeholder}
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', width: '100%' }}
    title="Optional print note — type or pick a suggestion"
  />
);

const RateUnitSelect = ({ chargeKey, value, onChange }) => (
  <SearchableSelect
    allowCustom
    className="input-field"
    style={{ padding: '0.25rem 0.35rem', width: '96px', fontSize: '0.75rem' }}
    value={value ?? defaultRateUnit(chargeKey)}
    onChange={(e) => onChange(chargeKey, e.target.value)}
    placeholder="Type unit"
    memoryKey="quote-rate-unit"
    title="Printed after the rate (e.g. /Each, / Kg, /No)"
  >
    {RATE_UNIT_OPTIONS.map((opt) => (
      <option key={opt.value || 'amount'} value={opt.value}>{opt.label === 'Amount only' ? '—' : opt.label}</option>
    ))}
  </SearchableSelect>
);

/** Quotation only: nothing selected until the user checks a charge. */
const DEFAULT_CHARGES = {
  cleaning: false, filterBag: false, processing: false, sieving: false,
  psdReport: false, liner: false, courier: false, fiberDrum: false,
  transportation: false, hdpeDrum: false, batchChangeover: false
};

const DEFAULT_RATES = {
  cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0,
  liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0
};

const masterCharge = (products, key) => {
  const filled = (products || []).find((prod) => {
    const amount = parseFloat(prod?.charges?.[key]);
    return Number.isFinite(amount) && amount !== 0;
  });
  if (filled) return filled.charges[key];
  const fallback = parseFloat(products?.[0]?.charges?.[key]);
  return Number.isFinite(fallback) ? products[0].charges[key] : 0;
};

const ratesFromMaster = (products = []) => {
  const cleaning = masterCharge(products, 'cleaning');
  return {
    minimum: cleaning,
    filterBag: masterCharge(products, 'filterBag'),
    sieving: masterCharge(products, 'sieving'),
    processing: masterCharge(products, 'processing'),
    cleaning,
    other: masterCharge(products, 'other')
  };
};

const getDefaultForm = () => ({
  quotationNo: '',
  date: new Date().toISOString().split('T')[0],
  partyId: '',
  partyName: '',
  partyAddress: '',
  gstNumber: '',
  contactPerson: '',
  subject: 'Quotation for Micronization Services.',
  description: '',
  productName: '',
  qty: '',
  psdRequirement: '',
  charges: { ...DEFAULT_CHARGES },
  rates: { ...DEFAULT_RATES },
  chargeNotes: emptyChargeNotes(),
  chargeSection: {},
  rateUnits: emptyRateUnits(),
  mainCharges: [],
  optionalCharges: [],
  productSettings: {},
  validityDate: defaultValidityDate(),
  terms: 'Tax: GST will charge extra.\nLoss: Loss occurs during Processing is on your account.\nSame Batch: Same materials requirement of micronization separately batch wise of different specification of same materials then change over charge @ Rs. 500/- batch or per specification will be applicable.\nCharges: This is only processing charges, all other charges like Transportation, Insurance, Repacking material charges will be extra.\nPayment: 100% Advance against PI\nValidity: ' + formatValidityLabel(defaultValidityDate()) + '\nNote: If properties of material change then rate will be change and PSD will change then rate will be change.',
  notes: '',
  signatoryName: 'Amit Patel'
});

const formatChargeRateLabel = (item, rate, unit) => {
  if (!(parseFloat(rate) > 0)) return 'NIL';
  return formatQuotedRate(rate, unit ?? defaultRateUnit(item.key));
};

const customChargeRows = (rows = []) =>
  (rows || []).filter((row) => !row.sourceKey && String(row.description || '').trim());

const buildAutoChargeRows = (section, charges, rates, qty, psdRequirement, chargeNotes = {}, chargeSection = {}, rateUnits = {}) => {
  const rows = [];
  ALL_CHARGE_DEFS.forEach((item) => {
    if (getChargeSection(chargeSection, item.key) !== section) return;
    if (!charges?.[item.key]) return;
    const rate = rates?.[item.key] || 0;
    const unit = rateUnits[item.key] ?? defaultRateUnit(item.key);
    if (section === 'main') {
      rows.push({
        description: item.label,
        psdRequirement: item.key === 'processing' ? (psdRequirement || '') : '',
        qty: item.isQtyRate ? (qty === '' || qty == null ? '' : (parseFloat(qty) || 0)) : '',
        rate: rate > 0 ? formatChargeRateLabel(item, rate, unit) : 'NIL',
        dryRate: rate > 0 ? formatChargeRateLabel(item, rate, unit) : 'NIL',
        wetRate: '',
        sourceKey: item.key,
        note: chargeNotes?.[item.key] || ''
      });
    } else {
      rows.push({
        description: item.label,
        qty: item.isQtyRate ? (qty === '' || qty == null ? '' : (parseFloat(qty) || 0)) : '',
        rate: rate > 0 ? formatChargeRateLabel(item, rate, unit) : 'NIL',
        sourceKey: item.key,
        selected: true,
        note: chargeNotes?.[item.key] || ''
      });
    }
  });
  return rows;
};

const rebuildChargeTables = (
  charges,
  rates,
  qty,
  psdRequirement,
  existingOptional = [],
  chargeNotes = {},
  chargeSection = {},
  existingMain = [],
  rateUnits = {}
) => ({
  mainCharges: [
    ...buildAutoChargeRows('main', charges, rates, qty, psdRequirement, chargeNotes, chargeSection, rateUnits),
    ...customChargeRows(existingMain)
  ],
  optionalCharges: [
    ...buildAutoChargeRows('optional', charges, rates, qty, psdRequirement, chargeNotes, chargeSection, rateUnits),
    ...customChargeRows(existingOptional)
  ]
});

const tablesFromForm = (form, patch = {}) => {
  const next = { ...form, ...patch };
  return rebuildChargeTables(
    next.charges,
    next.rates,
    next.qty,
    next.psdRequirement,
    next.optionalCharges,
    next.chargeNotes,
    next.chargeSection,
    next.mainCharges,
    next.rateUnits
  );
};

const inferChargeSection = (saved) => {
  const section = { ...(saved?.chargeSection || {}) };
  (saved?.mainCharges || []).forEach((row) => {
    if (row?.sourceKey && defaultChargeSection(row.sourceKey) === 'optional') {
      section[row.sourceKey] = 'main';
    }
  });
  (saved?.optionalCharges || []).forEach((row) => {
    if (row?.sourceKey && defaultChargeSection(row.sourceKey) === 'main') {
      section[row.sourceKey] = 'optional';
    }
  });
  return section;
};

const buildChargesFromPartyProduct = (prodConfig) => {
  const defaultRates = prodConfig?.charges || {};
  // Load rates from party master, but do not auto-select any charge for quotation print.
  return {
    charges: { ...DEFAULT_CHARGES },
    rates: { ...DEFAULT_RATES, ...defaultRates },
    psdRequirement: prodConfig?.psdReq || ''
  };
};

const snapshotCurrentProductSettings = (form) => {
  if (!form.productName) return form.productSettings || {};
  return {
    ...(form.productSettings || {}),
    [form.productName]: {
      qty: form.qty,
      psdRequirement: form.psdRequirement || '',
      charges: { ...form.charges },
      rates: { ...form.rates },
      chargeNotes: { ...emptyChargeNotes(), ...(form.chargeNotes || {}) },
      chargeSection: { ...(form.chargeSection || {}) },
      rateUnits: mergeRateUnits(form.rateUnits),
      mainCharges: JSON.parse(JSON.stringify(form.mainCharges || [])),
      optionalCharges: JSON.parse(JSON.stringify(form.optionalCharges || []))
    }
  };
};

const applyProductToQuotation = (baseForm, productName, party) => {
  const productSettings = snapshotCurrentProductSettings(baseForm);
  const saved = productSettings[productName];

  if (saved) {
    const charges = { ...DEFAULT_CHARGES, ...saved.charges };
    const rates = { ...DEFAULT_RATES, ...saved.rates };
    const notesFromRows = {};
    [...(saved.mainCharges || []), ...(saved.optionalCharges || [])].forEach((row) => {
      if (row?.sourceKey && row.note) notesFromRows[row.sourceKey] = row.note;
    });
    const chargeNotes = { ...emptyChargeNotes(), ...notesFromRows, ...(saved.chargeNotes || {}) };
    const chargeSection = inferChargeSection(saved);
    const rateUnits = mergeRateUnits({ ...(baseForm.rateUnits || {}), ...(saved.rateUnits || {}) });
    const tables = rebuildChargeTables(
      charges,
      rates,
      saved.qty,
      saved.psdRequirement,
      saved.optionalCharges,
      chargeNotes,
      chargeSection,
      saved.mainCharges,
      rateUnits
    );
    return {
      ...baseForm,
      productName,
      productSettings,
      qty: saved.qty ?? '',
      psdRequirement: saved.psdRequirement || '',
      charges,
      rates,
      chargeNotes,
      chargeSection,
      rateUnits,
      mainCharges: tables.mainCharges.length ? tables.mainCharges : (saved.mainCharges || []),
      optionalCharges: tables.optionalCharges.length ? tables.optionalCharges : (saved.optionalCharges || [])
    };
  }

  const prodConfig = (party?.products || []).find(p => p.name === productName);
  const { charges, rates, psdRequirement } = buildChargesFromPartyProduct(prodConfig);
  const qty = baseForm.productName === productName ? (baseForm.qty ?? '') : '';
  const tables = rebuildChargeTables(charges, rates, qty, psdRequirement, [], emptyChargeNotes(), {}, [], emptyRateUnits());
  return {
    ...baseForm,
    productName,
    productSettings,
    qty,
    psdRequirement,
    charges,
    rates,
    chargeNotes: emptyChargeNotes(),
    chargeSection: {},
    rateUnits: emptyRateUnits(),
    ...tables
  };
};

const quoteHasProduct = (q, productName) => {
  const name = String(productName || '').trim();
  if (!q || !name) return false;
  if (q.productSettings?.[name]) return true;
  return String(q.productName || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .includes(name);
};

const primaryProductName = (q) => {
  const current = String(q?.productName || '').split(',')[0]?.trim();
  if (current) return current;
  return Object.keys(q?.productSettings || {})[0] || '';
};

const Quotations = () => {
  const { data, updateData, updateItem, deleteItemSoftly, ensureSerialAtLeast } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [pendingEditData, setPendingEditData] = useState(null);
  
  const [formData, setFormData] = useState(getDefaultForm());
  const [dropTarget, setDropTarget] = useState(null);
  const [quotePage, setQuotePage] = useState(0);

  const quotationsList = newestFirst(data.quotations?.filter(q => !q.isDeleted) || []);

  const nextQuoteNumber = (date, excludeId = null) => nextAvailableDocNumber(
    'QTN',
    data.settings?.serials?.QT || 1,
    date,
    data.quotations || [],
    { numberKey: 'quotationNo', excludeId }
  );

  useEffect(() => {
    if (isModalOpen && !formData.id) {
      const { docNo } = nextQuoteNumber(formData.date);
      setFormData(prev => (prev.id ? prev : { ...prev, quotationNo: docNo }));
    }
  }, [isModalOpen, data.settings?.serials?.QT, formData.date, formData.id]);

  const handlePartySelect = (e) => {
    const name = e.target.value || '';
    const party = (data.parties || []).find(p =>
      !p.isDeleted && (p.name || '').trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (party) {
      setFormData(prev => {
        const products = party.products || [];
        const defaults = prev.companyQuoteMode
          ? ratesFromMaster(products)
          : (prev.defaultRates || ratesFromMaster(products));
        const quoteLines = prev.companyQuoteMode
          ? (prev.sameCompanyCopy
            ? (products.length ? products : [{}]).map((prod, index) => ({
              ...blankCompanyLine(prod, defaults),
              id: `ql-${Date.now()}-${index}`
            }))
            : [])
          : prev.quoteLines;
        return {
          ...prev,
          partyId: party.id,
          partyName: party.name,
          partyAddress: party.billAddress || '',
          gstNumber: party.gstinBill || '',
          productName: prev.companyQuoteMode
            ? (quoteLines || []).map((line) => line.name).filter(Boolean).join(', ')
            : '',
          psdRequirement: '',
          productSettings: {},
          chargeNotes: emptyChargeNotes(),
          chargeSection: {},
          defaultRates: prev.companyQuoteMode ? defaults : prev.defaultRates,
          quoteLines
        };
      });
      setQuotePage(0);
      return;
    }
    setFormData(prev => ({
      ...prev,
      partyId: '',
      partyName: name
    }));
  };

  const loadProduct = (productName, baseForm = formData) => {
    const party = data.parties.find(p => p.id === baseForm.partyId);
    let next = applyProductToQuotation(baseForm, productName, party);
    // Switching to a product this saved quote did not cover must not overwrite it.
    if (baseForm.id && !quoteHasProduct(baseForm, productName)) {
      const { docNo } = nextQuoteNumber(next.date, baseForm.id);
      const { id, createdAt, ...rest } = next;
      next = { ...rest, quotationNo: docNo };
    }
    setFormData(next);
  };

  const handleProductSelect = (e) => loadProduct(e.target.value);

  const handleSelectProductFromTable = (productName) => loadProduct(productName);

  const toggleMaterialCharge = (key) => {
    setFormData(prev => {
      const nextCharges = { ...prev.charges, [key]: !prev.charges[key] };
      return {
        ...prev,
        charges: nextCharges,
        ...tablesFromForm(prev, { charges: nextCharges })
      };
    });
  };

  const handleMaterialRateChange = (key, val) => {
    setFormData(prev => {
      const nextRates = { ...prev.rates, [key]: parseChargeFieldValue(val) };
      return {
        ...prev,
        rates: nextRates,
        ...tablesFromForm(prev, { rates: nextRates })
      };
    });
  };

  const handleRateUnitChange = (key, val) => {
    setFormData(prev => {
      const nextUnits = { ...emptyRateUnits(), ...(prev.rateUnits || {}), [key]: val };
      return {
        ...prev,
        rateUnits: nextUnits,
        ...tablesFromForm(prev, { rateUnits: nextUnits })
      };
    });
  };

  const handleChargeNoteChange = (key, val) => {
    setFormData(prev => {
      const chargeNotes = { ...emptyChargeNotes(), ...(prev.chargeNotes || {}), [key]: val };
      return {
        ...prev,
        chargeNotes,
        ...tablesFromForm(prev, { chargeNotes })
      };
    });
  };

  const handleQtyChange = (val) => {
    setFormData(prev => ({
      ...prev,
      qty: val,
      ...tablesFromForm(prev, { qty: val })
    }));
  };

  const quotationPrintData = (q) => {
    const editingThis = isModalOpen && formData && (!q?.id || !formData.id || q.id === formData.id);
    const source = editingThis ? { ...formData, ...tablesFromForm(formData) } : q;
    return source;
  };

  const previewQuotation = (q) => viewPDF('QUOTATION', quotationPrintData(q));

  const selectedParty = data.parties.find(p => p.id === formData.partyId);
  const partyProducts = selectedParty?.products || [];
  const quoteLines = formData.quoteLines || [];
  const quotePageSize = 6;
  const quotePageCount = Math.max(1, Math.ceil(quoteLines.length / quotePageSize));
  const safeQuotePage = Math.min(quotePage, quotePageCount - 1);
  const visibleQuoteLines = quoteLines.slice(safeQuotePage * quotePageSize, safeQuotePage * quotePageSize + quotePageSize);

  const patchCompanyQuote = (updater) => {
    setFormData((prev) => {
      const next = updater(prev);
      const lines = next.quoteLines || prev.quoteLines || [];
      return {
        ...prev,
        ...next,
        productName: lines.map((line) => line.name).filter(Boolean).join(', ')
      };
    });
  };

  const setDefaultCharge = (key, value) => {
    patchCompanyQuote((prev) => {
      const previous = prev.defaultRates?.[key];
      const defaultRates = { ...(prev.defaultRates || {}), [key]: value };
      const column = key === 'minimum' ? null : key;
      if (!column || column === 'other') return { defaultRates };
      const quoteLinesNext = (prev.quoteLines || []).map((line) => {
        const current = line.rates?.[column];
        if (current === '' || current == null || String(current) === String(previous ?? '')) {
          return { ...line, rates: { ...(line.rates || {}), [column]: value } };
        }
        return line;
      });
      return { defaultRates, quoteLines: quoteLinesNext };
    });
  };

  const setQuoteLineField = (id, field, value) => {
    patchCompanyQuote((prev) => ({
      quoteLines: (prev.quoteLines || []).map((line) => {
        if (line.id !== id) return line;
        if (field.startsWith('rate.')) {
          const rateKey = field.slice(5);
          return { ...line, rates: { ...(line.rates || {}), [rateKey]: value } };
        }
        return { ...line, [field]: value };
      })
    }));
  };

  const addCompanyProduct = () => {
    patchCompanyQuote((prev) => {
      const defaults = prev.defaultRates || {};
      const line = blankCompanyLine({}, defaults);
      const quoteLinesNext = [...(prev.quoteLines || []), line];
      setQuotePage(Math.floor((quoteLinesNext.length - 1) / quotePageSize));
      return { quoteLines: quoteLinesNext };
    });
  };

  const removeCompanyProduct = (id) => {
    patchCompanyQuote((prev) => ({
      quoteLines: (prev.quoteLines || []).filter((line) => line.id !== id)
    }));
  };

  const handleSubmit = (e, statusOverride) => {
    e.preventDefault();
    const currentProduct = String(formData.productName || '').trim();
    const synced = tablesFromForm(formData);
    const currentSettings = currentProduct
      ? {
          qty: formData.qty,
          psdRequirement: formData.psdRequirement || '',
          charges: { ...formData.charges },
          rates: { ...formData.rates },
          chargeNotes: { ...emptyChargeNotes(), ...(formData.chargeNotes || {}) },
          chargeSection: { ...(formData.chargeSection || {}) },
                rateUnits: mergeRateUnits(formData.rateUnits),
          mainCharges: synced.mainCharges,
          optionalCharges: synced.optionalCharges
        }
      : null;
    const productSettings = {
      ...(formData.productSettings || {}),
      ...(currentProduct ? { [currentProduct]: currentSettings } : {})
    };
    let payload = {
      ...formData,
      ...synced,
      productSettings,
      productName: currentProduct
    };
    if (formData.companyQuoteMode) {
      const lines = (formData.quoteLines || []).filter((line) => String(line.name || '').trim());
      const companySettings = {};
      lines.forEach((line) => {
        companySettings[line.name] = {
          qty: '',
          psdRequirement: line.psdReq || '',
          charges: { ...DEFAULT_CHARGES, cleaning: true, filterBag: true, processing: true, sieving: true },
          rates: { ...DEFAULT_RATES, ...(line.rates || {}) },
          chargeNotes: emptyChargeNotes(),
          chargeSection: {},
          rateUnits: mergeRateUnits(formData.rateUnits),
          mainCharges: [],
          optionalCharges: []
        };
      });
      const first = lines[0] || {};
      payload = {
        ...payload,
        status: statusOverride || 'generated',
        quoteLines: lines,
        defaultRates: { ...(formData.defaultRates || {}) },
        productSettings: companySettings,
        productName: lines.map((line) => line.name).join(', '),
        psdRequirement: first.psdReq || '',
        rates: { ...DEFAULT_RATES, ...(first.rates || {}) }
      };
    }

    if (formData.id) {
      updateItem('quotations', formData.id, payload);
    } else {
      const usedNos = new Set((data.quotations || []).map((q) => q.quotationNo).filter(Boolean));
      const { docNo, nextSerial } = nextQuoteNumber(payload.date);
      const quotationNo = payload.quotationNo && !usedNos.has(payload.quotationNo)
        ? payload.quotationNo
        : docNo;
      updateData('quotations', {
        ...payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        quotationNo,
        createdAt: new Date().toISOString()
      });
      ensureSerialAtLeast('QT', nextSerial);
    }
    closeQuotationModal();
  };

  const openQuotationForm = (data) => {
    setFormData(data);
    setIsModalOpen(true);
  };

  const closeQuotationModal = () => {
    setIsModalOpen(false);
    setProductPickerOpen(false);
    setPendingEditData(null);
  };

  const handleEdit = (q) => {
    const party = data.parties.find(p => p.id === q.partyId);
    const baseForm = {
      ...getDefaultForm(),
      ...q,
      charges: { ...DEFAULT_CHARGES, ...(q.charges || {}) },
      rates: { ...DEFAULT_RATES, ...(q.rates || {}) },
      chargeNotes: { ...emptyChargeNotes(), ...(q.chargeNotes || {}) },
      chargeSection: inferChargeSection(q),
      rateUnits: mergeRateUnits(q.rateUnits),
      productSettings: { ...(q.productSettings || {}) }
    };

    if (q.productName && !baseForm.productSettings[q.productName?.split(',')[0]?.trim()]) {
      const firstProduct = q.productName.split(',')[0]?.trim();
      if (firstProduct) {
        baseForm.productSettings[firstProduct] = {
          qty: q.qty,
          psdRequirement: q.psdRequirement || '',
          charges: baseForm.charges,
          rates: baseForm.rates,
          chargeNotes: baseForm.chargeNotes,
          chargeSection: baseForm.chargeSection || {},
          rateUnits: mergeRateUnits(baseForm.rateUnits),
          mainCharges: q.mainCharges || [],
          optionalCharges: q.optionalCharges || []
        };
      }
    }

    const configuredProducts = Object.keys(baseForm.productSettings || {});
    if (configuredProducts.length > 1) {
      setPendingEditData({
        baseForm,
        party,
        partyProducts: configuredProducts.map((name) =>
          (party?.products || []).find((p) => p.name === name) || { name }
        )
      });
      setProductPickerOpen(true);
      return;
    }

    const productName = primaryProductName(baseForm) || party?.products?.[0]?.name || '';
    openQuotationForm(applyProductToQuotation(baseForm, productName, party));
  };

  const handleConfirmProductEdit = (productName) => {
    if (!pendingEditData) return;
    const { baseForm, party } = pendingEditData;
    openQuotationForm(applyProductToQuotation(baseForm, productName, party));
    setProductPickerOpen(false);
    setPendingEditData(null);
  };

  const blankCompanyLine = (prod, defaults = {}) => ({
  id: `ql-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: prod?.name || '',
  nickname: prod?.nickname || '',
  psdReq: prod?.psdReq || prod?.psdRequirement || '',
  rates: {
    cleaning: prod?.charges?.cleaning ?? prod?.rates?.cleaning ?? defaults.cleaning ?? 0,
    filterBag: prod?.charges?.filterBag ?? prod?.rates?.filterBag ?? defaults.filterBag ?? 0,
    processing: prod?.charges?.processing ?? prod?.rates?.processing ?? defaults.processing ?? 0,
    sieving: prod?.charges?.sieving ?? prod?.rates?.sieving ?? defaults.sieving ?? 0
  }
});

const handleSameCompanyQuote = (q) => {
  const party = data.parties.find((p) => p.id === q.partyId);
  const savedLines = Array.isArray(q.quoteLines) ? q.quoteLines : [];
  const partyProducts = party?.products || [];
  const sourceProducts = savedLines.length ? savedLines : partyProducts;
  const master = ratesFromMaster(partyProducts);
  const defaults = {
    minimum: master.minimum || q.defaultRates?.minimum || q.rates?.cleaning || 0,
    filterBag: master.filterBag || q.defaultRates?.filterBag || q.rates?.filterBag || 0,
    sieving: master.sieving || q.defaultRates?.sieving || q.rates?.sieving || 0,
    processing: master.processing || q.defaultRates?.processing || q.rates?.processing || 0,
    cleaning: master.cleaning || q.defaultRates?.cleaning || q.rates?.cleaning || 0,
    other: master.other || q.defaultRates?.other || 0
  };
  const quoteLines = (sourceProducts.length ? sourceProducts : [{ name: primaryProductName(q) }])
    .map((prod, index) => ({ ...blankCompanyLine(prod, defaults), id: `ql-${Date.now()}-${index}` }));
  const { id, createdAt, quotationNo, isDeleted, deletedAt, ...rest } = q;
  const { docNo } = nextQuoteNumber(q.date);
  setQuotePage(0);
  openQuotationForm({
    ...getDefaultForm(),
    ...rest,
    id: undefined,
    quotationNo: docNo,
    charges: { ...DEFAULT_CHARGES, ...(q.charges || {}) },
    rates: { ...DEFAULT_RATES, ...(q.rates || {}) },
    chargeNotes: { ...emptyChargeNotes(), ...(q.chargeNotes || {}) },
    companyQuoteMode: true,
    sameCompanyCopy: true,
    defaultRates: defaults,
    quoteLines,
    productName: quoteLines.map((line) => line.name).filter(Boolean).join(', '),
    productSettings: {}
  });
};

  const handleNewQuotation = () => {
    setProductPickerOpen(false);
    setPendingEditData(null);
    setQuotePage(0);
    setFormData({
      ...getDefaultForm(),
      companyQuoteMode: true,
      defaultRates: { minimum: 0, filterBag: 0, sieving: 0, processing: 0, cleaning: 0, other: 0 },
      quoteLines: []
    });
    setIsModalOpen(true);
  };

  const addChargeRow = (type) => {
    setFormData(prev => ({
      ...prev,
      [type]: [
        ...prev[type],
        type === 'mainCharges'
          ? { description: '', psdRequirement: '', qty: '', rate: '', dryRate: '', wetRate: '', note: '' }
          : { description: '', qty: '', rate: '', selected: true, note: '' }
      ]
    }));
  };

  const updateChargeRow = (type, index, field, value) => {
    setFormData(prev => {
      const newCharges = [...prev[type]];
      const row = { ...newCharges[index], [field]: value };
      newCharges[index] = row;
      const next = { ...prev, [type]: newCharges };
      if (field === 'note' && row.sourceKey) {
        next.chargeNotes = { ...emptyChargeNotes(), ...(prev.chargeNotes || {}), [row.sourceKey]: value };
      }
      return next;
    });
  };

  const removeChargeRow = (type, index) => {
    setFormData(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const parseChargeDrag = (e) => {
    try {
      return JSON.parse(e.dataTransfer.getData('text/plain') || '');
    } catch {
      return null;
    }
  };

  const startChargeDrag = (e, payload) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const allowChargeDrop = (e, zone) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== zone) setDropTarget(zone);
  };

  const moveCatalogCharge = (key, section) => {
    if (!key || (section !== 'main' && section !== 'optional')) return;
    setFormData((prev) => {
      const chargeSection = { ...(prev.chargeSection || {}), [key]: section };
      return {
        ...prev,
        chargeSection,
        ...tablesFromForm(prev, { chargeSection })
      };
    });
  };

  const moveTableCharge = (fromType, fromIndex, toType) => {
    if (!fromType || fromIndex == null || !toType) return;
    setFormData((prev) => {
      const fromList = [...(prev[fromType] || [])];
      const item = fromList[fromIndex];
      if (!item) return prev;
      if (fromType === toType) return prev;
      if (item.sourceKey) {
        const chargeSection = {
          ...(prev.chargeSection || {}),
          [item.sourceKey]: toType === 'mainCharges' ? 'main' : 'optional'
        };
        return {
          ...prev,
          chargeSection,
          ...tablesFromForm(prev, { chargeSection })
        };
      }
      fromList.splice(fromIndex, 1);
      const converted = toType === 'mainCharges'
        ? {
            description: item.description || '',
            psdRequirement: item.psdRequirement || '',
            rate: item.rate || item.dryRate || '',
            dryRate: item.dryRate || item.rate || '',
            wetRate: item.wetRate || '',
            note: item.note || ''
          }
        : {
            description: item.description || '',
            rate: item.dryRate || item.rate || '',
            selected: true,
            note: item.note || ''
          };
      const toList = [...(prev[toType] || []), converted];
      return {
        ...prev,
        [fromType]: fromList,
        [toType]: toList
      };
    });
  };

  const handleChargeDrop = (e, zone) => {
    e.preventDefault();
    setDropTarget(null);
    const payload = parseChargeDrag(e);
    if (!payload) return;
    const section = zone === 'mainCatalog' || zone === 'mainTable' ? 'main' : 'optional';
    if (payload.kind === 'catalog') {
      moveCatalogCharge(payload.key, section);
      return;
    }
    if (payload.kind === 'row') {
      const toType = section === 'main' ? 'mainCharges' : 'optionalCharges';
      moveTableCharge(payload.from, payload.index, toType);
    }
  };

  const catalogItemsFor = (section) =>
    ALL_CHARGE_DEFS.filter((item) => getChargeSection(formData.chargeSection, item.key) === section);

  const dropZoneStyle = (zone) => ({
    borderRadius: '8px',
    border: dropTarget === zone ? '2px dashed var(--accent-primary)' : '2px dashed transparent',
    background: dropTarget === zone ? 'rgba(91, 28, 133, 0.06)' : 'transparent',
    padding: dropTarget === zone ? '0.5rem' : '0',
    minHeight: '48px',
    transition: 'border-color 0.15s ease, background 0.15s ease'
  });

  const partyOptions = useMemo(() => uniqueSortedOptions(quotationsList.map((q) => q.partyName)), [quotationsList]);
  const productOptions = useMemo(() => uniqueSortedOptions(quotationsList.map((q) => q.productName)), [quotationsList]);

  const isQuotePending = (q) => {
    const status = String(q.status || '').trim();
    if (status) {
      const s = status.toLowerCase();
      if (s === 'accepted' || s === 'closed' || s === 'generated') return false;
      return true;
    }
    if (q.accepted === true || q.converted) return false;
    return !String(q.partyName || '').trim() || !String(q.productName || '').trim();
  };
  const isQuoteCompleted = (q) => !isQuotePending(q);

  const pendingCount = quotationsList.filter(isQuotePending).length;
  const completedCount = quotationsList.filter(isQuoteCompleted).length;

  const filtered = quotationsList.filter((q) => {
    if (statusTab === 'pending' && !isQuotePending(q)) return false;
    if (statusTab === 'completed' && !isQuoteCompleted(q)) return false;
    if (partyFilter && (q.partyName || '') !== partyFilter) return false;
    if (productFilter && (q.productName || '') !== productFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (q.partyName || '').toLowerCase().includes(term) ||
      (q.quotationNo || '').toLowerCase().includes(term) ||
      (q.productName || '').toLowerCase().includes(term)
    );
  });

  const existingQuotesForCurrentProduct = quotationsList.filter((q) =>
    q.partyId === formData.partyId &&
    q.id !== formData.id &&
    quoteHasProduct(q, formData.productName)
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Quotations</h1>
          <p style={{ color: 'var(--text-muted)' }}>Create and manage commercial proposals.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ExportButton
            data={filtered}
            columns={[
              { label: 'Date', key: 'date' },
              { label: 'Quotation No', key: 'quotationNo' },
              { label: 'Party Name', key: 'partyName' },
              { label: 'Product', key: 'productName' },
              { label: 'Subject', key: 'subject' }
            ]}
            filename="Quotations"
            title="Quotations"
          />
          <button className="btn btn-primary" onClick={handleNewQuotation}>
            <Plus size={18} /> New Quotation
          </button>
        </div>
      </header>

      <StatusTabBar
        value={statusTab}
        onChange={setStatusTab}
        allCount={quotationsList.length}
        pendingCount={pendingCount}
        completedCount={completedCount}
      />

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search quotations..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        productFilter={productFilter}
        onProductChange={setProductFilter}
        productOptions={productOptions}
      />

      <div className="premium-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Quotation No</th>
                <th>Party Name</th>
                <th>Product</th>
                <th>Subject</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id}>
                  <td>{formatDate(q.date)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{q.quotationNo}</td>
                  <td>{q.partyName}</td>
                  <td>{primaryProductName(q) || '—'}</td>
                  <td>{q.subject}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} onClick={() => previewQuotation(q)} title="Preview PDF">
                        <Eye size={14} /> Preview
                      </button>
                      <DocDownloadButtons docType="QUOTATION" title="Quotation" getData={() => quotationPrintData(q)} size={14} />
                      <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(91, 28, 133, 0.1)', color: 'var(--accent-primary)' }} onClick={() => handleSameCompanyQuote(q)} title="Same quotation for same company">
                        <Copy size={14} />
                      </button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'transparent', color: 'var(--text-muted)' }} onClick={() => handleEdit(q)} title="Edit this quotation">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => deleteItemSoftly('quotations', q.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product picker — shown when editing a quotation with multiple party products */}
      {productPickerOpen && pendingEditData && (
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: '560px', maxWidth: '95%', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '0.35rem', fontSize: '1.25rem' }}>Select Product on this Quotation</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              This quotation has more than one product saved. Choose which product to edit. To quote the company again, use Same quotation for same company.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {pendingEditData.partyProducts.map(prod => {
                const settings = pendingEditData.baseForm.productSettings?.[prod.name];
                const isCurrent = pendingEditData.baseForm.productName?.includes(prod.name);
                const displayRates = settings?.rates || prod.charges || {};
                return (
                  <button
                    key={prod.name}
                    type="button"
                    className="btn"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.85rem 1rem',
                      background: isCurrent ? 'rgba(91, 28, 133, 0.06)' : 'var(--input-bg)',
                      border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleConfirmProductEdit(prod.name)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{prod.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Nick: {prod.nickname || 'N/A'} · PSD: {prod.psdReq || '—'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Cleaning ₹{displayRates.cleaning ?? prod.charges?.cleaning ?? 0} · Processing ₹{displayRates.processing ?? prod.charges?.processing ?? 0}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {settings ? 'Configured' : 'Party default'}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.15rem' }}>Click to edit</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={closeQuotationModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: formData.companyQuoteMode ? '1100px' : '900px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{formData.sameCompanyCopy ? 'Same Quotation for Same Company' : (formData.id ? 'Edit Quotation' : 'Create Quotation')}</h2>
            <form onSubmit={(e) => handleSubmit(e, formData.companyQuoteMode ? 'generated' : undefined)}>
              <ChargeNoteDatalist />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Quotation No</label>
                  <input type="text" className="input-field" value={formData.quotationNo} onChange={e => setFormData({ ...formData, quotationNo: e.target.value })} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Date</label>
                  <DateField className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label>Validity Date *</label>
                  <DateField
                    className="input-field"
                    required
                    value={formData.validityDate || ''}
                    onChange={e => {
                      const validityDate = e.target.value;
                      setFormData({ ...formData, validityDate, terms: syncValidityInTerms(formData.terms, validityDate) });
                    }}
                  />
                </div>
                <div>
                  <label>Party Name *</label>
                  <SearchableSelect
                    allowCustom
                    className="input-field"
                    required
                    placeholder="Select or type party name"
                    value={formData.partyName}
                    onChange={handlePartySelect}
                  >
                    <option value="">Select or type party name</option>
                    {data.parties.filter(p => !p.isDeleted && p.type === 'Customer').map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Contact Person / Attn</label>
                  <input type="text" className="input-field" placeholder="e.g. Mr. Sharma" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>Party Address</label>
                  <textarea className="input-field" rows="2" value={formData.partyAddress} onChange={e => setFormData({...formData, partyAddress: e.target.value})}></textarea>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>GST Number</label>
                  <input type="text" className="input-field" value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>Subject</label>
                  <input type="text" className="input-field" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>Description</label>
                  <textarea className="input-field" rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                </div>
              </div>

              {formData.companyQuoteMode && (
                <div style={{ border: '1px solid #ddd6fe', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.25rem', background: '#fff' }}>
                  <div style={{ background: '#5b1c85', color: '#fff', padding: '0.75rem 1rem', fontWeight: 700 }}>
                    Products &amp; Default Charges
                  </div>
                  <p style={{ margin: 0, padding: '0.55rem 1rem', fontSize: '0.75rem', color: '#6d28d9', background: '#f5f3ff' }}>
                    Minimum charge, filter charge, sieving, processing charge and other common charges are applied once for the entire quotation (all products).
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '0.5rem', padding: '0.85rem 1rem' }}>
                    {[
                      ['minimum', 'Minimum Charge'],
                      ['filterBag', 'Filter Bag Charge'],
                      ['sieving', 'Sieving Charge'],
                      ['processing', 'Processing Charge'],
                      ['cleaning', 'Cleaning Charge'],
                      ['other', 'Other Charges (If Any)']
                    ].map(([key, label]) => (
                      <label key={key} style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="input-field"
                          style={{ marginTop: '0.3rem', padding: '0.35rem 0.45rem' }}
                          value={formData.defaultRates?.[key] ?? ''}
                          onChange={(e) => setDefaultCharge(key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <div style={{ overflowX: 'auto', padding: '0 1rem 0.75rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.45rem' }}>Sr.</th>
                          <th style={{ padding: '0.45rem' }}>Product Name</th>
                          <th style={{ padding: '0.45rem' }}>Nick Name</th>
                          <th style={{ padding: '0.45rem' }}>PSD Range</th>
                          <th style={{ padding: '0.45rem' }}>Processing Charges</th>
                          <th style={{ padding: '0.45rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleQuoteLines.map((line, index) => (
                          <tr key={line.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.35rem' }}>{safeQuotePage * quotePageSize + index + 1}</td>
                            <td style={{ padding: '0.35rem', minWidth: '160px' }}>
                              <SearchableSelect
                                allowCustom
                                className="input-field"
                                style={{ width: '180px', padding: '0.3rem 0.4rem', fontSize: '0.78rem' }}
                                value={line.name}
                                onChange={(e) => {
                                  const name = e.target.value;
                                  const match = partyProducts.find((prod) => prod.name === name);
                                  setQuoteLineField(line.id, 'name', name);
                                  if (match) {
                                    setQuoteLineField(line.id, 'nickname', match.nickname || '');
                                    setQuoteLineField(line.id, 'psdReq', match.psdReq || '');
                                    setQuoteLineField(line.id, 'rate.processing', match.charges?.processing ?? '');
                                  }
                                }}
                                placeholder="Product"
                                memoryKey="quote-company-product"
                              >
                                <option value="">Product</option>
                                {partyProducts.map((prod) => (
                                  <option key={prod.name} value={prod.name}>{prod.name}</option>
                                ))}
                              </SearchableSelect>
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <input className="input-field" style={{ padding: '0.3rem 0.4rem', width: '110px' }} value={line.nickname || ''} onChange={(e) => setQuoteLineField(line.id, 'nickname', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <SearchableSelect
                                allowCustom
                                className="input-field"
                                style={{ width: '150px', padding: '0.3rem 0.4rem', fontSize: '0.78rem' }}
                                value={line.psdReq || ''}
                                onChange={(e) => setQuoteLineField(line.id, 'psdReq', e.target.value)}
                                placeholder="Type or select PSD"
                                memoryKey="quote-psd-range"
                              >
                                <option value="">Type or select PSD</option>
                                {(data.psdRequirements || []).map((req) => (
                                  <option key={req} value={req}>{req}</option>
                                ))}
                                {line.psdReq && !(data.psdRequirements || []).includes(line.psdReq) && (
                                  <option value={line.psdReq}>{line.psdReq}</option>
                                )}
                              </SearchableSelect>
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <input
                                className="input-field"
                                type="number"
                                min="0"
                                step="any"
                                style={{ padding: '0.3rem 0.4rem', width: '110px' }}
                                value={line.rates?.processing ?? ''}
                                onChange={(e) => setQuoteLineField(line.id, 'rate.processing', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <button type="button" className="btn" title="Remove product" style={{ padding: '0.25rem', color: '#ef4444', background: 'transparent' }} onClick={() => removeCompanyProduct(line.id)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem 0.85rem' }}>
                    <button type="button" className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={addCompanyProduct}>
                      <Plus size={14} /> Add Product
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Showing {quoteLines.length ? safeQuotePage * quotePageSize + 1 : 0} to {Math.min(quoteLines.length, safeQuotePage * quotePageSize + quotePageSize)} of {quoteLines.length}
                      {quotePageCount > 1 && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          <button type="button" className="btn" style={{ padding: '0.15rem 0.4rem' }} disabled={safeQuotePage === 0} onClick={() => setQuotePage(safeQuotePage - 1)}>Prev</button>
                          <button type="button" className="btn" style={{ padding: '0.15rem 0.4rem', marginLeft: '0.25rem' }} disabled={safeQuotePage >= quotePageCount - 1} onClick={() => setQuotePage(safeQuotePage + 1)}>Next</button>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Associated Products table — same as Party / Material Receipt */}
              {!formData.companyQuoteMode && formData.partyId && partyProducts.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Associated Products &amp; Default Charges</h3>
                    {formData.productName && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        Editing: {formData.productName}
                      </span>
                    )}
                  </div>
                  <div style={{ overflowX: 'auto', background: 'var(--input-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.5rem' }}>Product Name</th>
                          <th style={{ padding: '0.5rem' }}>Nick Name</th>
                          <th style={{ padding: '0.5rem' }}>PSD Req</th>
                          <th style={{ padding: '0.5rem' }}>Cleaning Chg</th>
                          <th style={{ padding: '0.5rem' }}>Filter Bag</th>
                          <th style={{ padding: '0.5rem' }}>Processing</th>
                          <th style={{ padding: '0.5rem' }}>Sieving</th>
                          <th style={{ padding: '0.5rem' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partyProducts.map((prod, idx) => {
                          const isSelected = formData.productName === prod.name;
                          const savedSettings = formData.productSettings?.[prod.name];
                          const displayRates = savedSettings?.rates || prod.charges || {};
                          const isConfigured = Boolean(savedSettings);
                          return (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                background: isSelected ? 'rgba(91, 28, 133, 0.06)' : isConfigured ? 'rgba(91, 28, 133, 0.03)' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '0.5rem', fontWeight: 600 }}>{prod.name}</td>
                              <td style={{ padding: '0.5rem' }}>{prod.nickname || 'N/A'}</td>
                              <td style={{ padding: '0.5rem' }}>{prod.psdReq || '—'}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.cleaning ?? prod.charges?.cleaning ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.filterBag ?? prod.charges?.filterBag ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.processing ?? prod.charges?.processing ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.sieving ?? prod.charges?.sieving ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <button
                                  type="button"
                                  className="btn"
                                  title="Edit quotation for this product"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: isSelected ? 'var(--accent-primary)' : 'transparent', border: '1px solid var(--border-color)', color: isSelected ? '#fff' : 'inherit' }}
                                  onClick={() => handleSelectProductFromTable(prod.name)}
                                >
                                  <Edit2 size={12} /> Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                    Click <strong>Edit</strong> on a product to load its charges below. Saving a <strong>new</strong> quotation always adds a new entry — previous quotations for the same company and product are kept.
                  </p>
                  {!formData.id && existingQuotesForCurrentProduct.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', margin: '0.5rem 0 0', fontWeight: 600 }}>
                      This company already has {existingQuotesForCurrentProduct.length} quotation{existingQuotesForCurrentProduct.length > 1 ? 's' : ''} for {formData.productName} ({existingQuotesForCurrentProduct.map((q) => q.quotationNo).join(', ')}). Save will add a new one; previous quotes stay.
                    </p>
                  )}
                </div>
              )}

              {!formData.companyQuoteMode && (formData.productName ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {partyProducts.length > 1 && (
                  <div style={{ gridColumn: 'span 2', padding: '0.85rem 1rem', background: 'rgba(91, 28, 133, 0.06)', borderRadius: '8px', border: '1px solid rgba(91, 28, 133, 0.2)' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      Which product do you want to edit?
                    </label>
                    <SearchableSelect
                      className="input-field"
                      value={formData.productName || ''}
                      onChange={e => handleSelectProductFromTable(e.target.value)}
                    >
                      {partyProducts.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </SearchableSelect>
                  </div>
                )}
                <div>
                  <label>Product / Material *</label>
                  <input type="text" className="input-field" readOnly value={formData.productName} style={{ background: 'var(--glass-bg)' }} />
                </div>
                <div>
                  <label>Estimated Qty (Kg)</label>
                  <input type="number" min="0" step="any" className="input-field" placeholder="NIL" value={qtyInputValue(formData.qty)} onChange={e => handleQtyChange(e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>PSD Requirement</label>
                  <input type="text" className="input-field" placeholder="e.g. d(0.9) < 10 Micron" value={formData.psdRequirement || ''} onChange={e => setFormData({ ...formData, psdRequirement: e.target.value })} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Signatory Name</label>
                  <input type="text" className="input-field" value={formData.signatoryName} onChange={e => setFormData({...formData, signatoryName: e.target.value})} />
                </div>
              </div>
              ) : partyProducts.length > 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--input-bg)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px dashed var(--border-color)' }}>
                  Select a product from the table above to edit quotation charges and details.
                </div>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Product / Material *</label>
                  <input type="text" className="input-field" placeholder="e.g. Calcium Carbonate" value={formData.productName} onChange={e => setFormData({ ...formData, productName: e.target.value })} />
                </div>
                <div>
                  <label>Estimated Qty (Kg)</label>
                  <input type="number" min="0" step="any" className="input-field" placeholder="NIL" value={qtyInputValue(formData.qty)} onChange={e => handleQtyChange(e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>PSD Requirement</label>
                  <input type="text" className="input-field" placeholder="e.g. d(0.9) < 10 Micron" value={formData.psdRequirement || ''} onChange={e => setFormData({ ...formData, psdRequirement: e.target.value })} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Signatory Name</label>
                  <input type="text" className="input-field" value={formData.signatoryName} onChange={e => setFormData({...formData, signatoryName: e.target.value})} />
                </div>
              </div>
              ))}

              {(formData.companyQuoteMode || formData.productName) && (
              <>
              {!formData.companyQuoteMode && (
              <>
              <div
                style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}
                onDragOver={(e) => allowChargeDrop(e, 'mainCatalog')}
                onDrop={(e) => handleChargeDrop(e, 'mainCatalog')}
              >
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Main Charges (Commercial Offer)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Drag optional charges here to print them in the main commercial table. Use the grip handle on the left.
                </p>
                <div style={dropZoneStyle('mainCatalog')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {catalogItemsFor('main').map((item) => (
                    <div
                      key={item.key}
                      style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    >
                      <span
                        draggable
                        title="Drag to Optional Services"
                        onDragStart={(e) => startChargeDrag(e, { kind: 'catalog', key: item.key })}
                        onDragEnd={() => setDropTarget(null)}
                        style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', paddingTop: '0.15rem', flexShrink: 0 }}
                      >
                        <GripVertical size={16} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={formData.charges?.[item.key] || false} onChange={() => toggleMaterialCharge(item.key)} />
                        {item.label}
                      </label>
                      {formData.charges?.[item.key] && (
                        <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹</span>
                          <input
                            type="number"
                            className="input-field"
                            style={{ padding: '0.25rem', width: '90px', fontSize: '0.8rem' }}
                            value={rateInputValue(formData.rates?.[item.key])}
                            placeholder="0"
                            onChange={e => handleMaterialRateChange(item.key, e.target.value)}
                          />
                          <RateUnitSelect
                            chargeKey={item.key}
                            value={formData.rateUnits?.[item.key]}
                            onChange={handleRateUnitChange}
                          />
                        </div>
                        <div style={{ paddingLeft: '1.5rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Print note</span>
                          <ChargeNoteInput
                            value={formData.chargeNotes?.[item.key] || ''}
                            onChange={(val) => handleChargeNoteChange(item.key, val)}
                          />
                        </div>
                        </>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
                {catalogItemsFor('main').length === 0 && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.75rem' }}>Drop optional charges here to make them main charges.</div>
                )}
                </div>
              </div>

              <div
                style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}
                onDragOver={(e) => allowChargeDrop(e, 'optionalCatalog')}
                onDrop={(e) => handleChargeDrop(e, 'optionalCatalog')}
              >
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Optional Service Charges</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Drag a charge onto <strong>Main Charges</strong> above to print it on the commercial offer instead of OPTIONAL SERVICES.
                </p>
                <div style={dropZoneStyle('optionalCatalog')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {catalogItemsFor('optional').map((item) => (
                    <div
                      key={item.key}
                      style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    >
                      <span
                        draggable
                        title="Drag to Main Charges"
                        onDragStart={(e) => startChargeDrag(e, { kind: 'catalog', key: item.key })}
                        onDragEnd={() => setDropTarget(null)}
                        style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', paddingTop: '0.15rem', flexShrink: 0 }}
                      >
                        <GripVertical size={16} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={formData.charges?.[item.key] || false} onChange={() => toggleMaterialCharge(item.key)} />
                        {item.label}
                      </label>
                      {formData.charges?.[item.key] && (
                        <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹</span>
                          <input
                            type="number"
                            className="input-field"
                            style={{ padding: '0.25rem', width: '90px', fontSize: '0.8rem' }}
                            value={rateInputValue(formData.rates?.[item.key])}
                            placeholder="0"
                            onChange={e => handleMaterialRateChange(item.key, e.target.value)}
                          />
                          <RateUnitSelect
                            chargeKey={item.key}
                            value={formData.rateUnits?.[item.key]}
                            onChange={handleRateUnitChange}
                          />
                        </div>
                        <div style={{ paddingLeft: '1.5rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Print note</span>
                          <ChargeNoteInput
                            value={formData.chargeNotes?.[item.key] || ''}
                            onChange={(val) => handleChargeNoteChange(item.key, val)}
                            placeholder="Note e.g. if applicable"
                          />
                        </div>
                        </>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
                {catalogItemsFor('optional').length === 0 && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.75rem' }}>All service charges are in Main Charges. Drag one back here if needed.</div>
                )}
                </div>
              </div>

              <div
                style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.5rem' }}
                onDragOver={(e) => allowChargeDrop(e, 'mainTable')}
                onDrop={(e) => handleChargeDrop(e, 'mainTable')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600 }}>Main Charges Table</label>
                  <button type="button" className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => addChargeRow('mainCharges')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Main Charge
                  </button>
                </div>
                <div style={dropZoneStyle('mainTable')}>
                {formData.mainCharges.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '22px 1.4fr 1.1fr 0.95fr 110px 0.8fr 0.8fr 30px', gap: '0.5rem', marginBottom: '0.25rem', padding: '0 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <div></div>
                    <div>Charge Description</div>
                    <div>Print note</div>
                    <div>PSD Requirement</div>
                    <div>Qty</div>
                    <div>Dry Rate</div>
                    <div>Wet Rate</div>
                    <div></div>
                  </div>
                )}
                {formData.mainCharges.map((charge, idx) => (
                  <div key={charge.sourceKey || `main-${idx}`} style={{ display: 'grid', gridTemplateColumns: '22px 1.4fr 1.1fr 0.95fr 110px 0.8fr 0.8fr 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span
                      draggable
                      title="Drag to Optional table"
                      onDragStart={(e) => startChargeDrag(e, { kind: 'row', from: 'mainCharges', index: idx })}
                      onDragEnd={() => setDropTarget(null)}
                      style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex' }}
                    >
                      <GripVertical size={16} />
                    </span>
                    <input type="text" className="input-field" placeholder="Charge Description (e.g. Processing Charges)" value={charge.description} onChange={e => updateChargeRow('mainCharges', idx, 'description', e.target.value)} />
                    <ChargeNoteInput value={charge.note || ''} onChange={(val) => updateChargeRow('mainCharges', idx, 'note', val)} />
                    <input type="text" className="input-field" placeholder="PSD Requirement (optional)" value={charge.psdRequirement || ''} onChange={e => updateChargeRow('mainCharges', idx, 'psdRequirement', e.target.value)} />
                    <input type="number" min="0" step="any" className="input-field" placeholder="NIL" value={qtyInputValue(charge.qty)} onChange={e => updateChargeRow('mainCharges', idx, 'qty', e.target.value)} />
                    <input type="text" className="input-field" placeholder="Dry Rate (e.g. 5 / Kg)" value={charge.dryRate !== undefined ? charge.dryRate : (charge.rate || '')} onChange={e => updateChargeRow('mainCharges', idx, 'dryRate', e.target.value)} />
                    <input type="text" className="input-field" placeholder="Wet Rate (e.g. 6 / Kg)" value={charge.wetRate || ''} onChange={e => updateChargeRow('mainCharges', idx, 'wetRate', e.target.value)} />
                    <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeChargeRow('mainCharges', idx)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                ))}
                {formData.mainCharges.length === 0 && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No main charges yet. Drop an optional charge here.</div>
                )}
                </div>
              </div>

              <div
                style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.5rem' }}
                onDragOver={(e) => allowChargeDrop(e, 'optionalTable')}
                onDrop={(e) => handleChargeDrop(e, 'optionalTable')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600 }}>Extra Optional Items (custom rows for print)</label>
                  <button type="button" className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => addChargeRow('optionalCharges')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Optional Charge
                  </button>
                </div>
                <div style={dropZoneStyle('optionalTable')}>
                {formData.optionalCharges.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '22px 1.5fr 1.1fr 110px 1fr 30px', gap: '0.5rem', marginBottom: '0.25rem', padding: '0 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <div></div>
                    <div>Description</div>
                    <div>Print note</div>
                    <div>Qty</div>
                    <div>Rate</div>
                    <div></div>
                  </div>
                )}
                {formData.optionalCharges.map((charge, idx) => (
                  <div key={charge.sourceKey || `opt-${idx}`} style={{ display: 'grid', gridTemplateColumns: '22px 1.5fr 1.1fr 110px 1fr 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span
                      draggable
                      title="Drag to Main Charges table"
                      onDragStart={(e) => startChargeDrag(e, { kind: 'row', from: 'optionalCharges', index: idx })}
                      onDragEnd={() => setDropTarget(null)}
                      style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex' }}
                    >
                      <GripVertical size={16} />
                    </span>
                    <input type="text" className="input-field" placeholder="Description (e.g. HDPE Drums)" value={charge.description} onChange={e => updateChargeRow('optionalCharges', idx, 'description', e.target.value)} />
                    <ChargeNoteInput
                      value={charge.note || ''}
                      onChange={(val) => updateChargeRow('optionalCharges', idx, 'note', val)}
                      placeholder="Note e.g. If Required"
                    />
                    <input type="number" min="0" step="any" className="input-field" placeholder="NIL" value={qtyInputValue(charge.qty)} onChange={e => updateChargeRow('optionalCharges', idx, 'qty', e.target.value)} />
                    <input type="text" className="input-field" placeholder="Rate (e.g. ₹ 500 / PC)" value={charge.rate} onChange={e => updateChargeRow('optionalCharges', idx, 'rate', e.target.value)} />
                    <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeChargeRow('optionalCharges', idx)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                ))}
                {formData.optionalCharges.length === 0 && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No optional charges added. Drop a main charge here if needed.</div>
                )}
                </div>
              </div>
              </>
              )}

              <div>
                <label>Terms & Conditions</label>
                <textarea className="input-field" rows="4" value={formData.terms} onChange={e => setFormData({...formData, terms: e.target.value})}></textarea>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <label>Notes</label>
                <textarea className="input-field" rows="4" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
              </div>
              </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={closeQuotationModal}>Cancel</button>
                {formData.companyQuoteMode && (
                  <button type="button" className="btn" disabled={!quoteLines.some((line) => String(line.name || '').trim())} onClick={(e) => handleSubmit(e, 'draft')}>
                    Save as Draft
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={formData.companyQuoteMode ? !quoteLines.some((line) => String(line.name || '').trim()) : !formData.productName}
                  onClick={() => previewQuotation(formData)}
                >
                  <Eye size={16} /> Preview
                </button>
                <button type="submit" className="btn btn-primary" disabled={formData.companyQuoteMode ? !quoteLines.some((line) => String(line.name || '').trim()) : !formData.productName}>
                  {formData.companyQuoteMode ? 'Generate Quotation' : (formData.id ? 'Update Quotation' : 'Save as New Quotation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
