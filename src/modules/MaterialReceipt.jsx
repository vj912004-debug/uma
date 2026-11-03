import { formatDate, formatTime, newestFirst } from '../utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import ExportButton from '../components/ExportButton';
import DocDownloadButtons from '../components/DocDownloadButtons';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import StatusTabBar from '../components/StatusTabBar';
import {
  getReceiptProductNames,
  getProductBatches,
  getProductQty,
  getReceiptProductLabel,
  syncReceiptProductSummary,
  receiptProductOptions,
  getReceiptProductSummaries,
  getReceiptTotals
} from '../utils/receiptProducts';
import { flattenMRChargeSnapshot, qtyInputValue, rateInputValue, parseChargeFieldValue } from '../utils/documentCharges';
import SearchableSelect from '../components/SearchableSelect';

const CHARGE_KEYS = [
  'cleaning', 'filterBag', 'processing', 'sieving', 'psdReport',
  'liner', 'courier', 'fiberDrum', 'transportation', 'hdpeDrum', 'batchChangeover'
];

const emptyChargeFlags = () =>
  Object.fromEntries(CHARGE_KEYS.map(k => [k, false]));

const emptyChargeRates = () =>
  Object.fromEntries(CHARGE_KEYS.map(k => [k, '']));

const emptyChargeQtys = () =>
  Object.fromEntries(CHARGE_KEYS.map(k => [k, '']));

const normSlot = (s) => String(s || '').trim().toLowerCase();

/** Distinct settings key when same product name has multiple PSD / charge rows. */
const productSlotKey = (name, micron = '') => {
  const n = String(name || '').trim();
  const m = String(micron || '').trim();
  if (!n) return '';
  return m ? `${n}|||${m}` : n;
};

const parseProductSlotKey = (key) => {
  const raw = String(key || '');
  if (raw.includes('|||')) {
    const [n, ...rest] = raw.split('|||');
    return { name: String(n || '').trim(), micron: rest.join('|||').trim() };
  }
  return { name: raw.trim(), micron: '' };
};

/** Prefer master row matching both product name and PSD (processing charge differs per PSD). */
const findPartyProdConfig = (party, name, micron = '') => {
  const products = party?.products || [];
  const n = normSlot(name);
  if (!n) return null;
  const m = normSlot(micron);
  if (m) {
    const hit = products.find((p) => normSlot(p.name) === n && normSlot(p.psdReq) === m);
    if (hit) return hit;
  }
  return products.find((p) => normSlot(p.name) === n) || null;
};

const batchMatchesSlot = (batch, name, micron = '') => {
  if (!batch || batch.isEmptyDrums) return false;
  if (normSlot(batch.productName) !== normSlot(name)) return false;
  if (!String(micron || '').trim()) return true;
  return normSlot(batch.psdReq) === normSlot(micron);
};

const buildProductSettingsFromParty = (prodConfig) => {
  if (!prodConfig) {
    return {
      nickName: '',
      micronSize: '',
      value: '',
      rates: emptyChargeRates(),
      charges: emptyChargeFlags(),
      qtys: emptyChargeQtys(),
      customCharges: []
    };
  }
  const c = prodConfig.charges || {};
  const psdRate = prodConfig.psdMethodDefault === 'Wet'
    ? (c.psdReportWet ?? c.psdReport ?? 0)
    : (c.psdReportDry ?? c.psdReport ?? 0);
  const rates = {
    cleaning: c.cleaning || 0,
    filterBag: c.filterBag || 0,
    processing: c.processing || 0,
    sieving: c.sieving || 0,
    psdReport: psdRate,
    liner: c.liner || 0,
    courier: c.courier || 0,
    fiberDrum: c.fiberDrum || 0,
    transportation: c.transportation || 0,
    hdpeDrum: c.hdpeDrum || 0,
    batchChangeover: c.batchChangeover || 0
  };
  const charges = Object.fromEntries(
    CHARGE_KEYS.map(k => [k, (rates[k] || 0) > 0])
  );
  return {
    nickName: prodConfig.nickname || '',
    micronSize: prodConfig.psdReq || '',
    value: '',
    rates,
    charges,
    qtys: emptyChargeQtys(),
    customCharges: (prodConfig.customCharges || []).map(cc => ({
      ...cc,
      checked: cc.checked !== false,
      qty: cc.qty || 0
    }))
  };
};

const sumDeclaredValues = (productSettings = {}) =>
  Object.values(productSettings).reduce((sum, block) => {
    const v = parseFloat(block?.value);
    return sum + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);

const CHARGE_ITEMS = [
  { key: 'cleaning', label: 'Minimum cleaning charges (998842)', isQtyRate: true },
  { key: 'filterBag', label: 'Filter Bag charges (591190)', isQtyRate: false },
  { key: 'processing', label: 'Processing charges (998842)', isQtyRate: true },
  { key: 'sieving', label: 'Sieving charges (998842)', isQtyRate: true },
  { key: 'psdReport', label: 'PSD report charges (998346)', isQtyRate: false },
  { key: 'liner', label: 'Liner (39233090)', isQtyRate: false },
  { key: 'courier', label: 'Courier (996812)', isQtyRate: false },
  { key: 'fiberDrum', label: 'Fiber Drum (7310)', isQtyRate: false },
  { key: 'transportation', label: 'Transportation (996511)', isQtyRate: false },
  { key: 'hdpeDrum', label: 'HDPE Drum (39233090)', isQtyRate: false },
  { key: 'batchChangeover', label: 'Batch Changeover (998842)', isQtyRate: false }
];

const parseChargeMeta = (label) => {
  const m = String(label).match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m ? { name: m[1].trim(), code: m[2] } : { name: label, code: '' };
};

const COMMON_CHARGE_KEYS = CHARGE_KEYS.filter((k) => k !== 'processing');
const COMMON_CHARGE_ITEMS = CHARGE_ITEMS
  .filter((i) => i.key !== 'processing')
  .map((i) => ({ ...i, ...parseChargeMeta(i.label) }));

const emptyChargeNotes = () => Object.fromEntries(CHARGE_KEYS.map((k) => [k, '']));

const CHARGE_NOTE_SUGGESTIONS = [
  'Nil if Qty is more than 500kg',
  'if applicable',
  'If Required',
  'Dry Method',
  'Wet Method',
  'Each',
  'Lump Sum'
];

const applyCommonChargesToProductSettings = (productSettings, charges, rates, qtys) => {
  const next = { ...(productSettings || {}) };
  Object.keys(next).forEach((name) => {
    const block = next[name] || {};
    next[name] = {
      ...block,
      charges: { ...emptyChargeFlags(), ...(block.charges || {}), ...Object.fromEntries(COMMON_CHARGE_KEYS.map((k) => [k, !!charges?.[k]])) },
      rates: { ...emptyChargeRates(), ...(block.rates || {}), ...Object.fromEntries(COMMON_CHARGE_KEYS.map((k) => [k, parseFloat(rates?.[k]) || 0])) },
      qtys: { ...emptyChargeQtys(), ...(block.qtys || {}), ...Object.fromEntries(COMMON_CHARGE_KEYS.map((k) => [k, parseFloat(qtys?.[k]) || 0])) }
    };
    // Keep per-product processing
    next[name].charges.processing = block.charges?.processing || false;
    next[name].rates.processing = parseFloat(block.rates?.processing) || 0;
    next[name].qtys.processing = parseFloat(block.qtys?.processing) || 0;
  });
  return next;
};

const getProductSettings = (formData, party, prodName, micron = '') => {
  const map = formData.productSettings || {};
  const key = productSlotKey(prodName, micron);
  if (key && map[key]) return map[key];
  if (micron) {
    const match = Object.entries(map).find(([k, v]) => {
      const parsed = parseProductSlotKey(k);
      return normSlot(parsed.name || k) === normSlot(prodName)
        && (normSlot(parsed.micron) === normSlot(micron) || normSlot(v?.micronSize) === normSlot(micron));
    });
    if (match) return match[1];
  }
  const plain = map[prodName];
  if (plain) {
    const plainMicron = String(plain.micronSize || '').trim();
    if (!micron || !plainMicron || normSlot(plainMicron) === normSlot(micron)) return plain;
  }
  return buildProductSettingsFromParty(findPartyProdConfig(party, prodName, micron));
};

const makeDefaultBatch = (prodName, party, productSettings = {}, micronOverride = '') => {
  const micronHint = String(micronOverride || '').trim();
  const key = productSlotKey(prodName, micronHint);
  const prodConfig = findPartyProdConfig(party, prodName, micronHint);
  const settings = (key && productSettings[key])
    || productSettings[prodName]
    || buildProductSettingsFromParty(prodConfig);
  const micronSize = micronHint || settings.micronSize || prodConfig?.psdReq || '90% < 10M';
  return {
    batchNo: '',
    drums: '',
    qty: '',
    productName: prodName,
    nickName: settings.nickName || prodConfig?.nickname || '',
    psdReq: micronSize,
    psdReport: 'Yes',
    psdMethod: prodConfig?.psdMethodDefault || 'Dry',
    isEmptyDrums: false
  };
};

const prepareReceiptEditData = (mr, parties) => {
  const party = parties.find(p => p.id === mr.partyId);
  const summaryNames = mr.productName?.includes(',')
    ? mr.productName.split(',').map(s => s.trim()).filter(Boolean)
    : mr.productName ? [mr.productName] : [];

  const batches = (mr.batches || []).map(b => {
    if (b.isEmptyDrums) return b;
    let pName = b.productName || '';
    if (!pName && summaryNames.length === 1) {
      pName = summaryNames[0];
    }
    const micron = String(b.psdReq || '').trim();
    const slotKey = productSlotKey(pName, micron);
    const prodConfig = findPartyProdConfig(party, pName, micron);
    const settings = mr.productSettings?.[slotKey]
      || mr.productSettings?.[pName]
      || buildProductSettingsFromParty(prodConfig);
    return {
      ...b,
      productName: pName,
      nickName: b.nickName || settings.nickName || prodConfig?.nickname || '',
      psdReq: b.psdReq || settings.micronSize || prodConfig?.psdReq || ''
    };
  });

  let productSettings = { ...(mr.productSettings || {}) };
  const productNames = getReceiptProductNames({ ...mr, batches }, { party });
  productNames.forEach(pName => {
    const sample = batches.find((b) => !b.isEmptyDrums && normSlot(b.productName) === normSlot(pName));
    const micron = String(sample?.psdReq || '').trim();
    const slotKey = productSlotKey(pName, micron);
    if (!productSettings[slotKey] && !productSettings[pName]) {
      const prodConfig = findPartyProdConfig(party, pName, micron);
      productSettings[slotKey || pName] = buildProductSettingsFromParty(prodConfig);
    }
  });

  const firstProduct = productNames[0] || mr.productName?.split(',')[0]?.trim() || '';
  if (firstProduct && !productSettings[firstProduct] && mr.rates) {
    productSettings[firstProduct] = {
      nickName: mr.nickName || '',
      value: '',
      rates: { ...mr.rates },
      charges: { ...mr.charges },
      qtys: { ...(mr.qtys || emptyChargeQtys()) },
      customCharges: JSON.parse(JSON.stringify(mr.customCharges || []))
    };
  }

  // Migrate legacy single MR value onto product settings when none are set
  const legacyValue = parseFloat(mr.value);
  const anyProductValue = productNames.some((n) => parseFloat(productSettings[n]?.value) > 0);
  if (!anyProductValue && Number.isFinite(legacyValue) && legacyValue > 0 && productNames.length) {
    if (productNames.length === 1) {
      productSettings[productNames[0]] = {
        ...(productSettings[productNames[0]] || {}),
        value: legacyValue
      };
    } else {
      // Keep top-level mr.value as fallback via getMRMaterialValue until user splits per product
    }
  }

  return {
    baseForm: { ...mr, batches, productSettings },
    party
  };
};

const MaterialReceipt = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [pendingProductName, setPendingProductName] = useState('');
  const [pendingMicronSize, setPendingMicronSize] = useState('');

  // Primary MR Form State
  const [formData, setFormData] = useState({
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    partyDocNo: '',
    partyDocDate: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    billAddress: '',
    gstinBill: '',
    shipAddress: '',
    gstinShip: '',
    productName: '',
    nickName: '',
    value: '', // Editable value of the material
    deliveryNotes: '', // Shown on linked Delivery Challan print
    productDeliveryNotes: {}, // Per-product delivery notes { [prodName]: noteText }
    batches: [], // Array of { batchNo, drums: 0, qty: 0, psdReq: '', psdReport: 'No', psdMethod: '', isEmptyDrums: false }
    totalDrums: 0,
    totalQty: 0,
    charges: { cleaning: false, filterBag: false, processing: false, sieving: false, psdReport: false, liner: false, courier: false, fiberDrum: false, transportation: false, hdpeDrum: false, batchChangeover: false },
    rates: { cleaning: '', filterBag: '', processing: '', sieving: '', psdReport: '', liner: '', courier: '', fiberDrum: '', transportation: '', hdpeDrum: '', batchChangeover: '' },
    qtys: { cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0, liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0 },
    customCharges: [],
    productSettings: {},
    chargeNotes: emptyChargeNotes()
  });

  // Keep serial code synced on open modal or date changes
  useEffect(() => {
    if (isModalOpen && !isEditing) {
      const mrSerial = data.settings?.serials?.MR || 1;
      const code = generateDocNumber('MR', mrSerial, new Date(formData.date));
      setFormData(prev => ({ ...prev, receiptNo: code }));
    }
  }, [formData.date, isModalOpen, isEditing, data.settings?.serials?.MR]);

  // Recalculate totals in real time whenever batches change
  useEffect(() => {
    const totalDrums = formData.batches.reduce((sum, b) => sum + (parseInt(b.drums) || 0), 0);
    const totalQty = formData.batches.reduce((sum, b) => sum + (b.isEmptyDrums ? 0 : (parseFloat(b.qty) || 0)), 0);
    setFormData(prev => ({ ...prev, totalDrums, totalQty }));
  }, [formData.batches]);

  // Triggered when Party selection changes
  const handlePartyChange = (e) => {
    const name = e.target.value || '';
    const party = (data.parties || []).find(p =>
      !p.isDeleted && (p.name || '').trim().toLowerCase() === name.trim().toLowerCase()
    );
    setPendingMicronSize('');
    if (!party) {
      setFormData(prev => ({
        ...prev,
        partyId: '',
        partyName: name,
        ...(name ? {} : {
          billAddress: '',
          gstinBill: '',
          shipAddress: '',
          gstinShip: '',
          deliveryNotes: '',
          productName: '',
          nickName: '',
          batches: [],
          productSettings: {}
        })
      }));
      return;
    }

    setFormData(prev => {
      if (prev.partyId === party.id) {
        return { ...prev, partyId: party.id, partyName: party.name };
      }
      return {
        ...prev,
        partyId: party.id,
        partyName: party.name,
        billAddress: party.billAddress || '',
        gstinBill: party.gstinBill || '',
        shipAddress: party.shipAddress || '',
        gstinShip: party.gstinShip || '',
        deliveryNotes: party.deliveryNote || '',
        productName: '',
        nickName: '',
        batches: [],
        productSettings: {}
      };
    });
  };

  const patchProductSettings = (prodName, updater, micron = '') => {
    setFormData(prev => {
      const party = data.parties.find(p => p.id === prev.partyId);
      const current = getProductSettings(prev, party, prodName, micron);
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      const key = productSlotKey(prodName, micron || next.micronSize || '');
      return {
        ...prev,
        productSettings: { ...prev.productSettings, [key || prodName]: next }
      };
    });
  };

  const patchCommonCharges = (patch) => {
    setFormData(prev => {
      const charges = { ...emptyChargeFlags(), ...(prev.charges || {}), ...(patch.charges || {}) };
      const rates = { ...emptyChargeRates(), ...(prev.rates || {}), ...(patch.rates || {}) };
      const qtys = { ...emptyChargeQtys(), ...(prev.qtys || {}), ...(patch.qtys || {}) };
      const chargeNotes = { ...emptyChargeNotes(), ...(prev.chargeNotes || {}), ...(patch.chargeNotes || {}) };
      return {
        ...prev,
        charges,
        rates,
        qtys,
        chargeNotes,
        productSettings: applyCommonChargesToProductSettings(prev.productSettings, charges, rates, qtys)
      };
    });
  };

  const handleRemoveAllReceivedProducts = () => {
    if (!formData.batches.some(b => !b.isEmptyDrums)) return;
    if (!window.confirm('Remove all received products and their batches from this receipt?')) return;
    setFormData(prev => ({
      ...prev,
      batches: prev.batches.filter(b => b.isEmptyDrums)
    }));
  };

  const handleAddBatchForProduct = (prodName, micronOverride = '') => {
    setFormData(prev => {
      const party = data.parties.find(p => p.id === prev.partyId);
      const productSettings = { ...(prev.productSettings || {}) };
      const micronSize = String(micronOverride || '').trim();
      const slotKey = productSlotKey(prodName, micronSize);
      const prodConfig = findPartyProdConfig(party, prodName, micronSize);
      const seeded = {
        ...buildProductSettingsFromParty(prodConfig),
        micronSize: micronSize || prodConfig?.psdReq || ''
      };
      productSettings[slotKey || prodName] = seeded;
      const defaultBatch = makeDefaultBatch(prodName, party, productSettings, micronSize);
      const hasCommon = COMMON_CHARGE_KEYS.some(k => prev.charges?.[k] || (parseFloat(prev.rates?.[k]) || 0) > 0);
      let charges = { ...emptyChargeFlags(), ...(prev.charges || {}) };
      let rates = { ...emptyChargeRates(), ...(prev.rates || {}) };
      let qtys = { ...emptyChargeQtys(), ...(prev.qtys || {}) };
      if (!hasCommon) {
        COMMON_CHARGE_KEYS.forEach((k) => {
          charges[k] = !!seeded.charges?.[k];
          rates[k] = parseFloat(seeded.rates?.[k]) || 0;
          qtys[k] = parseFloat(seeded.qtys?.[k]) || 0;
        });
      }
      return {
        ...prev,
        charges,
        rates,
        qtys,
        productSettings: applyCommonChargesToProductSettings(productSettings, charges, rates, qtys),
        batches: [...prev.batches, defaultBatch]
      };
    });
  };

  const handleProductMicronSizeChange = (prodName, micronSize, prevMicron = '') => {
    const value = String(micronSize || '').trim();
    setFormData(prev => {
      const party = data.parties.find(p => p.id === prev.partyId);
      const current = getProductSettings(prev, party, prodName, prevMicron);
      const master = findPartyProdConfig(party, prodName, value);
      const fromMaster = buildProductSettingsFromParty(master);
      const nextBlock = {
        ...fromMaster,
        nickName: current.nickName || fromMaster.nickName,
        value: current.value,
        customCharges: current.customCharges?.length ? current.customCharges : fromMaster.customCharges,
        micronSize: value
      };
      const oldKey = productSlotKey(prodName, prevMicron || current.micronSize || '');
      const newKey = productSlotKey(prodName, value);
      const productSettings = { ...(prev.productSettings || {}) };
      if (oldKey && oldKey !== newKey && productSettings[oldKey]) delete productSettings[oldKey];
      if (!prevMicron && productSettings[prodName] && oldKey !== prodName) {
        const plainMic = String(productSettings[prodName]?.micronSize || '').trim();
        if (!plainMic || normSlot(plainMic) === normSlot(prevMicron || current.micronSize)) {
          delete productSettings[prodName];
        }
      }
      productSettings[newKey || prodName] = nextBlock;
      return {
        ...prev,
        productSettings: applyCommonChargesToProductSettings(
          productSettings,
          prev.charges,
          prev.rates,
          prev.qtys
        ),
        batches: prev.batches.map((b) => (
          batchMatchesSlot(b, prodName, prevMicron || current.micronSize)
            ? { ...b, psdReq: value }
            : b
        ))
      };
    });
  };

  const handleAddEmptyDrumsRow = () => {
    setFormData(prev => ({
      ...prev,
      batches: [
        ...prev.batches,
        { 
          batchNo: 'Empty Drums', 
          drums: 1, 
          qty: 0, 
          psdReq: '', 
          psdReport: 'No', 
          psdMethod: '', 
          isEmptyDrums: true 
        }
      ]
    }));
  };

  const handleRemoveBatchRow = (idx) => {
    setFormData(prev => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== idx)
    }));
  };

  const handleBatchCellChange = (idx, field, val) => {
    setFormData(prev => ({
      ...prev,
      batches: prev.batches.map((b, i) => i === idx ? { ...b, [field]: val } : b)
    }));
  };

  const handleProductQtyChange = (prodName, raw, micron = '') => {
    setFormData((prev) => {
      const idxs = prev.batches
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => batchMatchesSlot(b, prodName, micron))
        .map(({ i }) => i);
      if (!idxs.length) return prev;
      const next = [...prev.batches];
      if (raw === '') {
        idxs.forEach((i, n) => {
          next[i] = { ...next[i], qty: n === 0 ? '' : 0 };
        });
        return { ...prev, batches: next };
      }
      const n = parseFloat(raw);
      if (!Number.isFinite(n)) return prev;
      if (idxs.length === 1) {
        next[idxs[0]] = { ...next[idxs[0]], qty: raw };
        return { ...prev, batches: next };
      }
      const others = idxs.slice(0, -1).reduce((s, i) => s + (parseFloat(next[i].qty) || 0), 0);
      if (n < others) {
        idxs.forEach((i, k) => {
          next[i] = { ...next[i], qty: k === 0 ? raw : 0 };
        });
      } else {
        next[idxs[idxs.length - 1]] = { ...next[idxs[idxs.length - 1]], qty: raw === '' ? '' : (n - others) };
      }
      return { ...prev, batches: next };
    });
  };

  const handleEdit = (mr) => {
    const prepared = prepareReceiptEditData(mr, data.parties);
    // Keep settings for product+PSD slots that have batches on this receipt
    const receivedSlots = [];
    (prepared.baseForm.batches || []).forEach((b) => {
      if (b.isEmptyDrums || !b.productName) return;
      const name = b.productName.trim();
      const micron = String(b.psdReq || '').trim();
      const key = productSlotKey(name, micron);
      if (receivedSlots.some((s) => s.key === key)) return;
      receivedSlots.push({ name, micron, key });
    });
    const receivedNames = new Set(receivedSlots.map((s) => s.name.toLowerCase()));
    const productSettings = {};
    Object.entries(prepared.baseForm.productSettings || {}).forEach(([name, settings]) => {
      const parsed = parseProductSlotKey(name);
      const base = parsed.name || name;
      if (
        receivedNames.has(base.trim().toLowerCase())
        || receivedSlots.some((s) => s.key === name || normSlot(s.name) === normSlot(name))
      ) {
        productSettings[name] = settings;
      }
    });
    receivedSlots.forEach(({ name, micron, key }) => {
      if (productSettings[key] || (!micron && productSettings[name])) return;
      const prod = findPartyProdConfig(prepared.party, name, micron);
      if (prod) productSettings[key || name] = buildProductSettingsFromParty(prod);
    });
    const firstSettings = Object.values(productSettings)[0];
    const seededCharges = { ...emptyChargeFlags(), ...(prepared.baseForm.charges || {}) };
    const seededRates = { ...emptyChargeRates(), ...(prepared.baseForm.rates || {}) };
    const seededQtys = { ...emptyChargeQtys(), ...(prepared.baseForm.qtys || {}) };
    const hasCommon = COMMON_CHARGE_KEYS.some(k => seededCharges[k] || (parseFloat(seededRates[k]) || 0) > 0);
    if (!hasCommon && firstSettings) {
      COMMON_CHARGE_KEYS.forEach((k) => {
        seededCharges[k] = !!firstSettings.charges?.[k];
        seededRates[k] = parseFloat(firstSettings.rates?.[k]) || 0;
        seededQtys[k] = parseFloat(firstSettings.qtys?.[k]) || 0;
      });
    }
    setFormData({
      ...prepared.baseForm,
      productDeliveryNotes: prepared.baseForm.productDeliveryNotes || {},
      productSettings: applyCommonChargesToProductSettings(productSettings, seededCharges, seededRates, seededQtys),
      productName: prepared.baseForm.productName || '',
      nickName: '',
      totalDrums: prepared.baseForm.totalDrums || 0,
      totalQty: prepared.baseForm.totalQty || 0,
      charges: seededCharges,
      rates: seededRates,
      qtys: seededQtys,
      customCharges: prepared.baseForm.customCharges || [],
      chargeNotes: { ...emptyChargeNotes(), ...(prepared.baseForm.chargeNotes || {}) }
    });
    setIsEditing(mr.id);
    setPendingMicronSize('');
    setIsModalOpen(true);
  };

  const closeReceiptModal = () => {
    setIsModalOpen(false);
    setIsEditing(null);
    setPendingMicronSize('');
  };

  const deleteReceipt = (id) => {
    if (window.confirm("Delete this material receipt? This will delete stock entries and affect downstream tracking.")) {
      deleteItemSoftly('materialReceipts', id);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      receiptNo: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      partyDocNo: '',
      partyDocDate: new Date().toISOString().split('T')[0],
      partyId: '',
      partyName: '',
      billAddress: '',
      gstinBill: '',
      shipAddress: '',
      gstinShip: '',
      productName: '',
      nickName: '',
      value: '',
      deliveryNotes: '',
      productDeliveryNotes: {},
      batches: [],
    totalDrums: 0,
    totalQty: 0,
    charges: { cleaning: false, filterBag: false, processing: false, sieving: false, psdReport: false, liner: false, courier: false, fiberDrum: false, transportation: false, hdpeDrum: false, batchChangeover: false },
    rates: { cleaning: '', filterBag: '', processing: '', sieving: '', psdReport: '', liner: '', courier: '', fiberDrum: '', transportation: '', hdpeDrum: '', batchChangeover: '' },
    qtys: { cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0, liner: 0, courier: 0, fiberBag: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0 },
    customCharges: [],
    productSettings: {},
    chargeNotes: emptyChargeNotes()
    });
    setIsEditing(null);
    setPendingMicronSize('');
    setIsModalOpen(true);
  };

  const buildPlansFromReceipt = (receipt) => {
    const party = data.parties.find(p => p.id === receipt.partyId)
      || data.parties.find(p => p.name === receipt.partyName);

    return (receipt.batches || [])
      .filter(b => !b.isEmptyDrums)
      .map((batch, idx) => {
        const batchProduct = batch.productName || receipt.productName?.split(',')[0]?.trim() || '';
        const prodConfig = findPartyProdConfig(party, batchProduct, batch.psdReq);
        return {
          id: `${receipt.id}_batch_${idx}`,
          receiptId: receipt.id,
          createdAt: receipt.createdAt || new Date().toISOString(),
          customer: receipt.partyName || party?.name || '',
          productName: batchProduct,
          productNickName: batch.nickName || prodConfig?.nickname || receipt.nickName || '',
          psdReq: batch.psdReq || prodConfig?.psdReq || '',
          psdNote: prodConfig?.psdNote || '',
          specialNote: prodConfig?.specialNote || '',
          batchNo: batch.batchNo || '',
          qty: batch.qty ?? '',
          priorityLevel: '',
          specialInstructions: '',
          status: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          hours: '',
          notes: '',
          supervisor: '',
          delayReason: ''
        };
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      if (!formData.partyName?.trim()) {
        alert("Please select or enter a Party name.");
        return;
      }
      const hasProductBatch = formData.batches.some(b => !b.isEmptyDrums && b.productName);
      if (!hasProductBatch) {
        alert("Please add at least one batch row for any product.");
        return;
      }
      if (formData.batches.length === 0) {
        alert("Please add at least one batch details row.");
        return;
      }
      const missingProductBatch = formData.batches.find(b => !b.isEmptyDrums && !b.productName);
      if (missingProductBatch) {
        alert("Please assign a product to every active batch row.");
        return;
      }

      const productSummary = syncReceiptProductSummary(
        formData.batches,
        selectedPartyObj,
        formData,
        data.productionPlans || []
      );

      const syncedProductSettings = {};
      const saveSlots = [];
      (formData.batches || []).forEach((b) => {
        if (b.isEmptyDrums) return;
        const name = String(b.productName || '').trim();
        if (!name) return;
        const micron = String(b.psdReq || '').trim();
        if (saveSlots.some((s) => normSlot(s.name) === normSlot(name) && normSlot(s.micron) === normSlot(micron))) return;
        saveSlots.push({ name, micron, key: productSlotKey(name, micron) });
      });
      saveSlots.forEach(({ name, micron, key }) => {
        const live = getProductSettings(formData, selectedPartyObj, name, micron);
        const declared = live.value === '' || live.value == null ? '' : (parseFloat(live.value) || '');
        const settingsKey = key || name;
        syncedProductSettings[settingsKey] = {
          nickName: live.nickName || '',
          micronSize: micron || live.micronSize || '',
          value: declared,
          charges: {
            ...emptyChargeFlags(),
            ...(formData.charges || {}),
            processing: live.charges?.processing || false
          },
          rates: {
            ...emptyChargeRates(),
            ...(formData.rates || {}),
            processing: parseFloat(live.rates?.processing) || 0
          },
          qtys: {
            ...emptyChargeQtys(),
            ...(formData.qtys || {}),
            processing: parseFloat(live.qtys?.processing) || 0
          },
          customCharges: JSON.parse(JSON.stringify(live.customCharges || [])),
          chargeNotes: { ...emptyChargeNotes(), ...(formData.chargeNotes || {}) }
        };
      });

      const declaredTotal = sumDeclaredValues(syncedProductSettings);
      const receiptPayload = isEditing
        ? { ...formData, ...productSummary, productSettings: syncedProductSettings, value: declaredTotal || formData.value || '', id: isEditing }
        : { ...formData, ...productSummary, productSettings: syncedProductSettings, value: declaredTotal || formData.value || '', id: Date.now().toString(), status: 'Pending', createdAt: new Date().toISOString() };

      const chargeFlatten = flattenMRChargeSnapshot(receiptPayload, selectedPartyObj);
      if (chargeFlatten) {
        receiptPayload.charges = chargeFlatten.charges;
        receiptPayload.rates = chargeFlatten.rates;
        // Keep user-entered common qtys (cleaning etc.) — do not sum per product (2 → 4)
        receiptPayload.qtys = {
          ...emptyChargeQtys(),
          ...(chargeFlatten.qtys || {}),
          ...(formData.qtys || {})
        };
        receiptPayload.customCharges = chargeFlatten.customCharges;
      }
      receiptPayload.chargeNotes = { ...emptyChargeNotes(), ...(formData.chargeNotes || {}) };

      const processingFields = ['startDate', 'startTime', 'endDate', 'endTime', 'hours', 'supervisor', 'delayReason', 'status', 'priorityLevel', 'specialInstructions', 'notes'];
      const isAutoFilledProcessing = (plan) => {
        const hoursNum = parseFloat(plan?.hours);
        return plan?.startTime === '09:00'
          && plan?.endTime === '17:00'
          && (hoursNum === 8 || plan?.hours === '8.00');
      };

      setData(prev => {
        const existingLinked = (prev.productionPlans || []).filter(p => p.receiptId === receiptPayload.id);
        const linkedPlans = buildPlansFromReceipt(receiptPayload).map(plan => {
          const existing = existingLinked.find(p => p.id === plan.id);
          if (!existing || isAutoFilledProcessing(existing)) return plan;
          const preserved = {};
          processingFields.forEach(key => {
            if (existing[key]) preserved[key] = existing[key];
          });
          return { ...plan, ...preserved };
        });
        const otherPlans = (prev.productionPlans || []).filter(p => p.receiptId !== receiptPayload.id);
        const materialReceipts = isEditing
          ? (prev.materialReceipts || []).map(mr => mr.id === isEditing ? receiptPayload : mr)
          : [...(prev.materialReceipts || []), receiptPayload];

        return {
          ...prev,
          materialReceipts,
          productionPlans: [...otherPlans, ...linkedPlans]
        };
      });

      if (!isEditing) {
        incrementSerial('MR');
      }
      closeReceiptModal();
    } catch (error) {
      console.error("Failed to save receipt:", error);
      alert("Error saving material receipt.");
    }
  };

  // Get active products for selected party
  const selectedPartyObj = data.parties.find(p => p.id === formData.partyId);
  const partyProducts = selectedPartyObj?.products || [];
  const micronsForProduct = (productName) => {
    const target = String(productName || '').trim().toLowerCase();
    if (!target) return [];
    const seen = new Set();
    const list = [];
    (partyProducts || []).forEach((p) => {
      if (String(p.name || '').trim().toLowerCase() !== target) return;
      const saved = String(p.psdReq || '').trim();
      if (!saved) return;
      const key = saved.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(saved);
    });
    return list;
  };

  // Products on this receipt — same name + different PSD count as separate slots
  const receivedProducts = (() => {
    const slots = [];
    (formData.batches || []).forEach((b) => {
      if (b.isEmptyDrums) return;
      const name = String(b.productName || '').trim();
      if (!name) return;
      const micron = String(
        b.psdReq
        || getProductSettings(formData, selectedPartyObj, name).micronSize
        || ''
      ).trim();
      if (slots.some((s) => normSlot(s.name) === normSlot(name) && normSlot(s.micron) === normSlot(micron))) {
        return;
      }
      const partyProd = findPartyProdConfig(selectedPartyObj, name, micron);
      slots.push({
        name,
        micron,
        key: productSlotKey(name, micron),
        ...(partyProd || { name, psdReq: micron, charges: {} }),
        psdReq: micron || partyProd?.psdReq || ''
      });
    });
    return slots;
  })();

  // One dropdown row per master product; same-name rows stay distinct via micron label.
  // Do not merge remembered custom products from other parties into this list.
  const productsAvailableToAdd = (() => {
    const nameCounts = {};
    (partyProducts || []).forEach((prod) => {
      const key = String(prod?.name || '').trim().toLowerCase();
      if (!key) return;
      nameCounts[key] = (nameCounts[key] || 0) + 1;
    });
    return (partyProducts || [])
      .filter((prod) => {
        const name = String(prod?.name || '').trim();
        if (!name) return false;
        const micron = String(prod.psdReq || '').trim();
        return !receivedProducts.some((r) =>
          normSlot(r.name) === normSlot(name)
          && normSlot(r.micron || r.psdReq) === normSlot(micron)
        );
      })
      .map((prod, idx) => {
        const name = String(prod.name || '').trim();
        const micron = String(prod.psdReq || '').trim();
        const dup = (nameCounts[name.toLowerCase()] || 0) > 1;
        const label = dup && micron ? `${name} (${micron})` : name;
        // Unique value so duplicate master names both appear in the select
        const optionValue = dup && micron ? `${name}|||${micron}` : name;
        return {
          ...prod,
          _optionLabel: label,
          _optionValue: optionValue,
          _optionKey: `${name}::${micron}::${idx}`
        };
      });
  })();

  const chooseProductToAdd = (rawName) => {
    const typed = String(rawName || '').trim();
    if (!typed) {
      setPendingProductName('');
      setPendingMicronSize('');
      return;
    }
    const fromEncoded = typed.includes('|||')
      ? (() => {
          const [n, m] = typed.split('|||');
          return { name: String(n || '').trim(), micron: String(m || '').trim() };
        })()
      : null;
    const labeled = productsAvailableToAdd.find((p) =>
      String(p._optionValue || '').trim().toLowerCase() === typed.toLowerCase()
      || String(p._optionLabel || '').trim().toLowerCase() === typed.toLowerCase()
      || String(p.name || '').trim().toLowerCase() === typed.toLowerCase()
    );
    const name = labeled?.name || fromEncoded?.name || typed.replace(/\s*\([^)]*\)\s*$/, '').trim() || typed;
    const micron = labeled?.psdReq || fromEncoded?.micron || '';
    if (receivedProducts.some((p) =>
      normSlot(p.name) === normSlot(name)
      && (!micron || normSlot(p.micron || p.psdReq) === normSlot(micron))
    )) return;
    // Master option already carries PSD — add immediately with that row's charges
    if (micron && (labeled || fromEncoded)) {
      handleAddBatchForProduct(name, micron);
      setPendingProductName('');
      setPendingMicronSize('');
      return;
    }
    setPendingProductName(name);
    setPendingMicronSize(micron || micronsForProduct(name)[0] || '');
  };

  const confirmProductMicron = (micron) => {
    const name = String(pendingProductName || '').trim();
    const value = String(micron || '').trim();
    if (!name || !value) return;
    if (receivedProducts.some((p) =>
      normSlot(p.name) === normSlot(name)
      && normSlot(p.micron || p.psdReq) === normSlot(value)
    )) return;
    handleAddBatchForProduct(name, value);
    setPendingProductName('');
    setPendingMicronSize('');
  };

  // Filtered List
  const mrList = newestFirst(data.materialReceipts || []);
  const partyOptions = useMemo(() => uniqueSortedOptions(mrList.map((r) => r.partyName)), [mrList]);
  const productOptions = useMemo(() => uniqueSortedOptions(mrList.map((r) => r.productName)), [mrList]);
  const pendingCount = mrList.filter((mr) => mr.status !== 'Completed').length;
  const completedCount = mrList.filter((mr) => mr.status === 'Completed').length;
  const filteredReceipts = mrList.filter((mr) => {
    const isDone = mr.status === 'Completed';
    if (statusTab === 'pending' && isDone) return false;
    if (statusTab === 'completed' && !isDone) return false;
    if (partyFilter && (mr.partyName || '') !== partyFilter) return false;
    if (productFilter && (mr.productName || '') !== productFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (mr.receiptNo || '').toLowerCase().includes(q) ||
      (mr.partyName || '').toLowerCase().includes(q) ||
      (mr.productName || '').toLowerCase().includes(q) ||
      (mr.partyDocNo && mr.partyDocNo.toLowerCase().includes(q))
    );
  });

  // Active batch count (excluding Empty Drums)
  const activeBatchCount = formData.batches.filter(b => !b.isEmptyDrums).length;
  const activeProductCount = new Set(
    formData.batches.filter(b => !b.isEmptyDrums && b.productName).map(b => b.productName)
  ).size;

  const renderProductBatchRow = (batch, idx, rowNum) => (
    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{rowNum}</td>
      <td style={{ padding: '0.5rem' }}>
        <input
          type="text"
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem', width: '100%', boxSizing: 'border-box' }}
          value={batch.batchNo}
          onChange={e => handleBatchCellChange(idx, 'batchNo', e.target.value)}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          type="number"
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem', width: '100%', boxSizing: 'border-box' }}
          value={batch.drums === 0 || batch.drums === '' ? '' : batch.drums}
          onChange={e => handleBatchCellChange(idx, 'drums', e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          type="number"
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem', width: '100%', boxSizing: 'border-box' }}
          value={batch.qty === 0 || batch.qty === '' ? '' : batch.qty}
          onChange={e => handleBatchCellChange(idx, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <SearchableSelect
          allowCustom
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          value={batch.psdReq || ''}
          onChange={e => handleBatchCellChange(idx, 'psdReq', e.target.value)}
          placeholder="Type micron size"
          remember={false}
        >
          <option value="">Select…</option>
          {micronsForProduct(batch.productName).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </SearchableSelect>
      </td>
      <td style={{ padding: '0.5rem' }}>
        <SearchableSelect
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          value={batch.psdReport}
          onChange={e => handleBatchCellChange(idx, 'psdReport', e.target.value)}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </SearchableSelect>
      </td>
      <td style={{ padding: '0.5rem' }}>
        <SearchableSelect
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          value={batch.psdMethod}
          onChange={e => handleBatchCellChange(idx, 'psdMethod', e.target.value)}
        >
          <option value="Dry">Dry</option>
          <option value="Wet">Wet</option>
          <option value="N/A">N/A</option>
          <option value="">None</option>
        </SearchableSelect>
      </td>
      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
        <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }} onClick={() => handleRemoveBatchRow(idx)}>
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );

  const tableCols = [
    { key: 'receiptNo', label: 'M.R. Number' },
    { key: 'date', label: 'Received Date' },
    { key: 'partyName', label: 'Party Name' },
    { key: 'productName', label: 'Product Name' },
    { key: 'totalDrums', label: 'Batches / Drums' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'status', label: 'Status' }
  ];

  const thStyle = { padding: '0.45rem 0.4rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'left', borderBottom: '1px solid var(--border-color)' };
  const tdStyle = { padding: '0.4rem 0.35rem', fontSize: '0.8rem', verticalAlign: 'middle', borderBottom: '1px solid var(--border-color)' };
  const renderCommonChargeTable = (items, startIndex) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '36px' }}>#</th>
            <th style={thStyle}>Material / Service Name</th>
            <th style={{ ...thStyle, width: '88px' }}>Code</th>
            <th style={{ ...thStyle, width: '78px', textAlign: 'center' }}>Applicable</th>
            <th style={{ ...thStyle, width: '120px' }}>Qty</th>
            <th style={{ ...thStyle, width: '120px' }}>Rate (₹)</th>
            <th style={{ ...thStyle, width: '100px' }}>Amount (₹)</th>
            <th style={{ ...thStyle, minWidth: '140px' }}>Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const applicable = !!formData.charges?.[item.key];
            const qty = parseFloat(formData.qtys?.[item.key]) || 0;
            const rate = parseFloat(formData.rates?.[item.key]) || 0;
            const amount = applicable ? qty * rate : 0;
            return (
              <tr key={item.key}>
                <td style={tdStyle}>{startIndex + idx}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                <td style={tdStyle}>{item.code || '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={applicable}
                    onChange={() => patchCommonCharges({ charges: { [item.key]: !applicable } })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    className="input-field"
                    min="0"
                    step="any"
                    value={qtyInputValue(formData.qtys?.[item.key])}
                    placeholder="NIL"
                    onChange={(e) => patchCommonCharges({ qtys: { [item.key]: e.target.value } })}
                    style={{ padding: '0.45rem 0.55rem', fontSize: '0.88rem', width: '100%', minHeight: '38px', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    className="input-field"
                    min="0"
                    step="any"
                    value={rateInputValue(formData.rates?.[item.key])}
                    onChange={(e) => patchCommonCharges({ rates: { [item.key]: parseChargeFieldValue(e.target.value) } })}
                    placeholder="0"
                    style={{ padding: '0.45rem 0.55rem', fontSize: '0.88rem', width: '100%', minHeight: '38px', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {applicable ? amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </td>
                <td style={tdStyle}>
                  <input
                    type="text"
                    className="input-field"
                    list="mr-charge-note-options"
                    placeholder="Note e.g. if applicable"
                    value={formData.chargeNotes?.[item.key] || ''}
                    onChange={(e) => patchCommonCharges({ chargeNotes: { [item.key]: e.target.value } })}
                    style={{ padding: '0.25rem 0.35rem', fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Material Received Data (M.R.)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Log incoming supplier raw materials, batches, and PSD method specifications.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filteredReceipts} columns={tableCols} filename="Material_Receipts" title="Material Receipts Log" groupBy="partyName" docType="MR" />
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Add Material Receipt
          </button>
        </div>
      </header>

      <StatusTabBar
        value={statusTab}
        onChange={setStatusTab}
        allCount={mrList.length}
        pendingCount={pendingCount}
        completedCount={completedCount}
      />

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by M.R. No, Supplier Doc, Party or Product..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        productFilter={productFilter}
        onProductChange={setProductFilter}
        productOptions={productOptions}
      />

      <div className="premium-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sr. No</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>M.R. Number</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Received Date</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Party Name</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Product Name</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Batches / Drums</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Qty</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No receipts found.</td>
                </tr>
              ) : (
                filteredReceipts.map((mr, idx) => {
                  const prodOpts = receiptProductOptions(mr, data);
                  const productNames = getReceiptProductNames(mr, prodOpts);
                  const productSummaries = getReceiptProductSummaries(mr, prodOpts);
                  const totals = getReceiptTotals(mr, prodOpts);
                  const isMultiProduct = productSummaries.length > 1;
                  return (
                    <tr key={mr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem' }}>{idx + 1}</td>
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{mr.receiptNo}</td>
                      <td style={{ padding: '1rem' }}>{formatDate(mr.date)} {mr.time ? formatTime(mr.time) : ''}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{mr.partyName}</td>
                      <td style={{ padding: '1rem' }}>
                        {productNames.length === 0 ? (
                          <span>{mr.productName || '—'}</span>
                        ) : productNames.length === 1 ? (
                          <>
                            <span>{productNames[0]}</span>
                            {(mr.productSettings?.[productNames[0]]?.nickName || mr.nickName) && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                                ({mr.productSettings?.[productNames[0]]?.nickName || mr.nickName})
                              </span>
                            )}
                          </>
                        ) : (
                          productNames.map((name, i) => {
                            const settings = mr.productSettings?.[name]
                              || buildProductSettingsFromParty((prodOpts.party?.products || []).find(p => p.name === name));
                            return (
                              <span key={name} style={{ display: 'block', fontSize: i === 0 ? 'inherit' : '0.85rem' }}>
                                {name}
                                {settings.nickName && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> ({settings.nickName})</span>
                                )}
                              </span>
                            );
                          })
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                        {isMultiProduct ? (
                          <>
                            {productSummaries.map((ps, i) => (
                              <p key={ps.prodName} style={{ margin: i === 0 ? 0 : '0.35rem 0 0', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>P{i + 1}:</span>{' '}
                                {ps.batchCount} batch{ps.batchCount !== 1 ? 'es' : ''} · {ps.drums} drum{ps.drums !== 1 ? 's' : ''}
                              </p>
                            ))}
                            <p style={{
                              margin: '0.5rem 0 0',
                              paddingTop: '0.35rem',
                              borderTop: '1px solid var(--border-color)',
                              fontWeight: 700,
                              fontSize: '0.8rem'
                            }}>
                              Total: {totals.batchCount} batch{totals.batchCount !== 1 ? 'es' : ''} · {totals.drums} drum{totals.drums !== 1 ? 's' : ''}
                            </p>
                          </>
                        ) : (
                          <>
                            <p style={{ margin: 0 }}>Batches: {totals.batchCount}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drums: {totals.drums}</p>
                          </>
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>
                        {isMultiProduct ? (
                          <>
                            {productSummaries.map((ps, i) => (
                              <p key={ps.prodName} style={{ margin: i === 0 ? 0 : '0.35rem 0 0', fontSize: '0.85rem', fontWeight: 500 }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>P{i + 1}:</span> {ps.qty.toFixed(2)} Kg
                              </p>
                            ))}
                            <p style={{
                              margin: '0.5rem 0 0',
                              paddingTop: '0.35rem',
                              borderTop: '1px solid var(--border-color)',
                              fontWeight: 700
                            }}>
                              {totals.qty.toFixed(2)} Kg
                            </p>
                          </>
                        ) : (
                          <span>{totals.qty.toFixed(2)} Kg</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem',
                          background: mr.status === 'Completed' ? 'rgba(155, 98, 196, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: mr.status === 'Completed' ? '#10b981' : '#f59e0b',
                          fontWeight: 600
                        }}>
                          {mr.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <DocDownloadButtons docType="Material Receipt" title="Material Receipt" getData={() => mr} size={16} />
                          <button onClick={() => handleEdit(mr)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                          <button onClick={() => deleteReceipt(mr.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Material Receipt Modal */}
      {isModalOpen && (
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: '100%', maxWidth: '100%', height: '100%', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{isEditing ? 'Modify Material Receipt' : 'Register Material Receipt'}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>M.R.: {formData.receiptNo}</span>
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>M.R. Date *</label>
                  <DateField className="input-field" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label>M.R. Time *</label>
                  <TimeField className="input-field" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Document No *</label>
                  <input type="text" className="input-field" required placeholder="Challan / Invoice No" value={formData.partyDocNo} onChange={e => setFormData({...formData, partyDocNo: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Doc Date *</label>
                  <DateField className="input-field" required value={formData.partyDocDate} onChange={e => setFormData({...formData, partyDocDate: e.target.value})} />
                </div>

                <div style={{ gridColumn: 'span 4', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }}></div>

                {/* Party Selection */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Party Name *</label>
                  <SearchableSelect
                    allowCustom
                    className="input-field"
                    required
                    placeholder="Select or type party name"
                    value={formData.partyName}
                    onChange={handlePartyChange}
                  >
                    <option value="">Select or type party name</option>
                    {(data.parties || []).filter(p => !p.isDeleted).map(p => (
                      <option key={p.id} value={p.name}>{p.name}{p.vendorCode ? ` (${p.vendorCode})` : ''}</option>
                    ))}
                  </SearchableSelect>
                </div>

                {/* Addresses */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Bill To Address</label>
                  <textarea className="input-field" rows="2" value={formData.billAddress} onChange={e => setFormData({...formData, billAddress: e.target.value})} style={{ background: 'var(--glass-bg)', opacity: 0.8 }} />
                  <label style={{ marginTop: '0.5rem' }}>Bill To GSTIN</label>
                  <input type="text" className="input-field" value={formData.gstinBill} onChange={e => setFormData({...formData, gstinBill: e.target.value})} style={{ background: 'var(--glass-bg)', opacity: 0.8 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ship To Address</label>
                  <textarea className="input-field" rows="2" value={formData.shipAddress} onChange={e => setFormData({...formData, shipAddress: e.target.value})} style={{ background: 'var(--glass-bg)', opacity: 0.8 }} />
                  <label style={{ marginTop: '0.5rem' }}>Ship To GSTIN</label>
                  <input type="text" className="input-field" value={formData.gstinShip} onChange={e => setFormData({...formData, gstinShip: e.target.value})} style={{ background: 'var(--glass-bg)', opacity: 0.8 }} />
                </div>

                {receivedProducts.length > 1 ? (
                  <div style={{ gridColumn: 'span 4' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>Material Declared Value (₹)</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>(Separate value for each product)</span>
                      {sumDeclaredValues(formData.productSettings) > 0 && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginLeft: 'auto' }}>
                          Total: ₹ {sumDeclaredValues(formData.productSettings).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      {receivedProducts.map((prod, pIdx) => {
                        const slotMicron = prod.micron || prod.psdReq || '';
                        const settings = getProductSettings(formData, selectedPartyObj, prod.name, slotMicron);
                        const settingsKey = prod.key || productSlotKey(prod.name, slotMicron) || prod.name;
                        return (
                          <div key={`declared-${settingsKey || pIdx}`} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-card)' }}>
                            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '0.4rem', display: 'block' }}>
                              Product {pIdx + 1}: {prod.name}{slotMicron ? ` (${slotMicron})` : ''}
                            </label>
                            <input
                              type="number"
                              className="input-field"
                              min="0"
                              step="0.01"
                              placeholder="Editable"
                              value={settings.value === 0 || settings.value === '' || settings.value == null ? '' : settings.value}
                              onChange={(e) => {
                                const nextVal = e.target.value === '' ? '' : (parseFloat(e.target.value) || '');
                                setFormData((prev) => {
                                  const current = getProductSettings(prev, selectedPartyObj, prod.name, slotMicron);
                                  const productSettings = {
                                    ...(prev.productSettings || {}),
                                    [settingsKey]: { ...current, value: nextVal, micronSize: slotMicron || current.micronSize }
                                  };
                                  return {
                                    ...prev,
                                    productSettings,
                                    value: sumDeclaredValues(productSettings) || ''
                                  };
                                });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label>Material Declared Value (₹)</label>
                    <input
                      type="number"
                      className="input-field"
                      min="0"
                      step="0.01"
                      placeholder="Editable"
                      value={(() => {
                        const only = receivedProducts[0];
                        if (only?.name) {
                          const settings = getProductSettings(
                            formData,
                            selectedPartyObj,
                            only.name,
                            only.micron || only.psdReq || ''
                          );
                          if (settings.value !== '' && settings.value != null) return settings.value;
                        }
                        return formData.value === 0 || formData.value === '' || formData.value == null ? '' : formData.value;
                      })()}
                      onChange={(e) => {
                        const nextVal = e.target.value === '' ? '' : (parseFloat(e.target.value) || '');
                        const only = receivedProducts[0];
                        if (!only?.name) {
                          setFormData({ ...formData, value: nextVal });
                          return;
                        }
                        const slotMicron = only.micron || only.psdReq || '';
                        const settingsKey = only.key || productSlotKey(only.name, slotMicron) || only.name;
                        setFormData((prev) => {
                          const current = getProductSettings(prev, selectedPartyObj, only.name, slotMicron);
                          const productSettings = {
                            ...(prev.productSettings || {}),
                            [settingsKey]: { ...current, value: nextVal, micronSize: slotMicron || current.micronSize }
                          };
                          return {
                            ...prev,
                            productSettings,
                            value: nextVal
                          };
                        });
                      }}
                    />
                  </div>
                )}

                {receivedProducts.length > 1 ? (
                  <div style={{ gridColumn: 'span 4' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Delivery Notes</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>(Separate note for each product)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                      {receivedProducts.map((prod, pIdx) => {
                        const prodNote = (formData.productDeliveryNotes && formData.productDeliveryNotes[prod.name] !== undefined)
                          ? formData.productDeliveryNotes[prod.name]
                          : (formData.deliveryNotes || '');
                        return (
                          <div key={prod.name || pIdx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-card)' }}>
                            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '0.4rem', display: 'block' }}>
                              Product {pIdx + 1}: {prod.name}
                            </label>
                            {(data.dcDeliveryNotes || []).length > 0 && (
                              <SearchableSelect
                                className="input-field"
                                value=""
                                onChange={(e) => {
                                  const picked = e.target.value;
                                  if (picked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      productDeliveryNotes: {
                                        ...(prev.productDeliveryNotes || {}),
                                        [prod.name]: picked
                                      },
                                      deliveryNotes: prev.deliveryNotes || picked
                                    }));
                                  }
                                }}
                                placeholder="Pick from master…"
                                style={{ marginBottom: '0.5rem' }}
                              >
                                <option value="">Pick from master…</option>
                                {(data.dcDeliveryNotes || []).map((n, idx) => (
                                  <option key={idx} value={n}>{n}</option>
                                ))}
                              </SearchableSelect>
                            )}
                            <textarea
                              className="input-field"
                              rows="2"
                              list="dcDeliveryNoteOptions"
                              placeholder={`Shown on Delivery Challan print for ${prod.name}`}
                              value={prodNote}
                              onChange={e => {
                                const val = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  productDeliveryNotes: {
                                    ...(prev.productDeliveryNotes || {}),
                                    [prod.name]: val
                                  },
                                  deliveryNotes: val || prev.deliveryNotes
                                }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ gridColumn: 'span 4' }}>
                    <label>Delivery Notes</label>
                    {(data.dcDeliveryNotes || []).length > 0 && (
                      <SearchableSelect
                        className="input-field"
                        value=""
                        onChange={(e) => {
                          const picked = e.target.value;
                          if (picked) {
                            const singleProd = receivedProducts[0]?.name;
                            setFormData(prev => ({
                              ...prev,
                              deliveryNotes: picked,
                              productDeliveryNotes: singleProd ? { ...(prev.productDeliveryNotes || {}), [singleProd]: picked } : (prev.productDeliveryNotes || {})
                            }));
                          }
                        }}
                        placeholder="Pick from master…"
                        style={{ marginBottom: '0.5rem' }}
                      >
                        <option value="">Pick from master…</option>
                        {(data.dcDeliveryNotes || []).map((n, idx) => (
                          <option key={idx} value={n}>{n}</option>
                        ))}
                      </SearchableSelect>
                    )}
                    <textarea
                      className="input-field"
                      rows="2"
                      list="dcDeliveryNoteOptions"
                      placeholder="Shown on Delivery Challan print (e.g. Material sent for Micronisation on Job Work basis.)"
                      value={formData.deliveryNotes || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const singleProd = receivedProducts[0]?.name;
                        setFormData(prev => ({
                          ...prev,
                          deliveryNotes: val,
                          productDeliveryNotes: singleProd ? { ...(prev.productDeliveryNotes || {}), [singleProd]: val } : (prev.productDeliveryNotes || {})
                        }));
                      }}
                    />
                  </div>
                )}
              </div>

              <datalist id="psdReqOptions">
                {(data.psdRequirements || []).map((r, idx) => (
                  <option key={idx} value={r} />
                ))}
                {!(data.psdRequirements || []).some((r) => String(r).trim().toUpperCase() === 'N/A') && (
                  <option value="N/A" />
                )}
              </datalist>
              <datalist id="dcDeliveryNoteOptions">
                {(data.dcDeliveryNotes || []).map((n, idx) => (
                  <option key={idx} value={n} />
                ))}
              </datalist>
              <datalist id="mr-charge-note-options">
                {CHARGE_NOTE_SUGGESTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>

              {formData.partyId && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Products ({receivedProducts.length})</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Choose a product first. The micron size list opens after that product is selected.
                    </div>
                  </div>

                  {receivedProducts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {receivedProducts.map((prod, pIdx) => {
                        const slotMicron = prod.micron || prod.psdReq || '';
                        const settings = getProductSettings(formData, selectedPartyObj, prod.name, slotMicron);
                        const productBatchEntries = formData.batches
                          .map((batch, idx) => ({ batch, idx }))
                          .filter(({ batch }) => batchMatchesSlot(batch, prod.name, slotMicron));
                        const productDrums = productBatchEntries.reduce((sum, { batch }) => sum + (parseInt(batch.drums) || 0), 0);
                        const productQty = productBatchEntries.reduce((sum, { batch }) => sum + (parseFloat(batch.qty) || 0), 0);
                        const patchSlot = (updater) => patchProductSettings(prod.name, updater, slotMicron);

                        return (
                          <div key={prod.key || `${prod.name}::${slotMicron}::${pIdx}`} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.9rem', background: 'rgba(155, 98, 196, 0.08)', borderBottom: '1px solid var(--border-color)' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)', minWidth: 0 }}>
                                {pIdx + 1}. Product: {prod.name}{slotMicron ? ` (${slotMicron})` : ''}
                              </div>
                              <button
                                type="button"
                                style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.95)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: 0, flexShrink: 0 }}
                                onClick={() => {
                                  const label = slotMicron ? `${prod.name} (${slotMicron})` : prod.name;
                                  if (!window.confirm(`Remove all batches for "${label}" from this receipt?`)) return;
                                  const removeKey = productSlotKey(prod.name, slotMicron);
                                  setFormData(prev => {
                                    const nextSettings = { ...(prev.productSettings || {}) };
                                    if (removeKey && nextSettings[removeKey]) delete nextSettings[removeKey];
                                    return {
                                      ...prev,
                                      productSettings: nextSettings,
                                      batches: prev.batches.filter(
                                        (b) => b.isEmptyDrums || !batchMatchesSlot(b, prod.name, slotMicron)
                                      )
                                    };
                                  });
                                }}
                              >
                                Remove
                              </button>
                            </div>

                            <div style={{ padding: '0.9rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                Cleaning ₹{settings.rates?.cleaning ?? prod.charges?.cleaning ?? 0} · Processing ₹{settings.rates?.processing ?? prod.charges?.processing ?? 0} · Filter Bag ₹{settings.rates?.filterBag ?? prod.charges?.filterBag ?? 0}
                              </p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                              <div>
                                <label>Nick Name</label>
                                <input type="text" className="input-field" value={settings.nickName || ''} onChange={e => patchSlot(s => ({ ...s, nickName: e.target.value }))} />
                              </div>
                              <div>
                                <label>Micron Size</label>
                                <SearchableSelect
                                  allowCustom
                                  className="input-field"
                                  value={settings.micronSize || prod.psdReq || ''}
                                  onChange={(e) => handleProductMicronSizeChange(prod.name, e.target.value, slotMicron)}
                                  placeholder="Type or select micron size"
                                  remember={false}
                                >
                                  <option value="">Select micron size…</option>
                                  {micronsForProduct(prod.name).map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </SearchableSelect>
                              </div>
                              <div>
                                <label>Processing Charges (₹)</label>
                                <input
                                  type="number"
                                  className="input-field"
                                  min="0"
                                  step="any"
                                  value={rateInputValue(settings.rates?.processing)}
                                  onChange={e => patchSlot(s => {
                                    const nextRate = parseChargeFieldValue(e.target.value);
                                    return {
                                      ...s,
                                      rates: { ...s.rates, processing: nextRate },
                                      charges: { ...s.charges, processing: parseFloat(nextRate) > 0 ? true : s.charges.processing }
                                    };
                                  })}
                                  placeholder="0"
                                />
                                <input
                                  type="text"
                                  className="input-field"
                                  list="mr-charge-note-options"
                                  placeholder="Note e.g. Nil if Qty is more than 500kg"
                                  value={formData.chargeNotes?.processing || ''}
                                  onChange={e => patchCommonCharges({ chargeNotes: { processing: e.target.value } })}
                                  style={{ marginTop: '0.35rem', padding: '0.3rem 0.4rem', fontSize: '0.75rem' }}
                                />
                              </div>
                              <div>
                                <label>Quantity</label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="input-field"
                                    placeholder="NIL"
                                    value={qtyInputValue(productQty)}
                                    onChange={(e) => handleProductQtyChange(prod.name, e.target.value, slotMicron)}
                                    style={{ paddingRight: '2.5rem' }}
                                  />
                                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, pointerEvents: 'none' }}>Kg</span>
                                </div>
                              </div>
                              <div>
                                <label>Material Declared Value (₹)</label>
                                <input
                                  type="number"
                                  className="input-field"
                                  min="0"
                                  step="0.01"
                                  placeholder="Editable"
                                  value={settings.value === 0 || settings.value === '' || settings.value == null ? '' : settings.value}
                                  onChange={(e) => {
                                    const nextVal = e.target.value === '' ? '' : (parseFloat(e.target.value) || '');
                                    setFormData((prev) => {
                                      const current = getProductSettings(prev, selectedPartyObj, prod.name, slotMicron);
                                      const key = productSlotKey(prod.name, slotMicron) || prod.name;
                                      const productSettings = {
                                        ...(prev.productSettings || {}),
                                        [key]: { ...current, value: nextVal, micronSize: slotMicron || current.micronSize }
                                      };
                                      return {
                                        ...prev,
                                        productSettings,
                                        value: sumDeclaredValues(productSettings) || ''
                                      };
                                    });
                                  }}
                                />
                              </div>
                              </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <label style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>Manual Custom Charges</label>
                        <button type="button" className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => patchSlot(s => ({ ...s, customCharges: [...(s.customCharges || []), { id: Date.now() + Math.random(), name: '', hsn: '', rate: '', qty: '', checked: true }] }))}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Row
                        </button>
                      </div>
                      {(settings.customCharges || []).map((charge, cIdx) => (
                        <div key={charge.id || cIdx} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1.4fr) minmax(70px, 0.6fr) 110px 110px minmax(120px, 1fr) 28px', gap: '0.4rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                          <input type="checkbox" checked={charge.checked !== false} onChange={e => patchSlot(s => {
                            const newC = [...(s.customCharges || [])];
                            newC[cIdx] = { ...newC[cIdx], checked: e.target.checked };
                            return { ...s, customCharges: newC };
                          })} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                          <input type="text" className="input-field" placeholder="Description" value={charge.name} onChange={e => patchSlot(s => {
                            const newC = [...(s.customCharges || [])];
                            newC[cIdx] = { ...newC[cIdx], name: e.target.value };
                            return { ...s, customCharges: newC };
                          })} />
                          <input type="text" className="input-field" placeholder="HSN" value={charge.hsn} onChange={e => patchSlot(s => {
                            const newC = [...(s.customCharges || [])];
                            newC[cIdx] = { ...newC[cIdx], hsn: e.target.value };
                            return { ...s, customCharges: newC };
                          })} />
                          <input type="number" className="input-field" placeholder="NIL" value={qtyInputValue(charge.qty)} onChange={e => patchSlot(s => {
                            const newC = [...(s.customCharges || [])];
                            newC[cIdx] = { ...newC[cIdx], qty: e.target.value };
                            return { ...s, customCharges: newC };
                          })} min="0" step="any" />
                          <input type="number" className="input-field" placeholder="Rate" value={rateInputValue(charge.rate)} onChange={e => patchSlot(s => {
                            const newC = [...(s.customCharges || [])];
                            newC[cIdx] = { ...newC[cIdx], rate: parseChargeFieldValue(e.target.value) };
                            return { ...s, customCharges: newC };
                          })} min="0" step="any" />
                          <input type="text" className="input-field" list="mr-charge-note-options" placeholder="Note" value={charge.note || ''} onChange={e => patchSlot(s => {
                            const newC = [...(s.customCharges || [])];
                            newC[cIdx] = { ...newC[cIdx], note: e.target.value };
                            return { ...s, customCharges: newC };
                          })} />
                          <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => patchSlot(s => ({ ...s, customCharges: (s.customCharges || []).filter((_, i) => i !== cIdx) }))}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        </div>
                      ))}
                      {(settings.customCharges || []).length === 0 && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No manual charges added.</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Batch Details</h4>
                      <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleAddBatchForProduct(prod.name, slotMicron)}>
                        <Plus size={14} /> Add Batch Row
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto', background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'auto' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.5rem', width: '60px' }}>Sr No</th>
                            <th style={{ padding: '0.5rem' }}>Batch Number</th>
                            <th style={{ padding: '0.5rem', width: '120px' }}>No of Drums</th>
                            <th style={{ padding: '0.5rem', width: '150px' }}>Quantity (Kg)</th>
                            <th style={{ padding: '0.5rem' }}>Micron Size</th>
                            <th style={{ padding: '0.5rem', width: '120px' }}>PSD Report</th>
                            <th style={{ padding: '0.5rem', width: '120px' }}>PSD Method</th>
                            <th style={{ padding: '0.5rem', width: '60px' }}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productBatchEntries.length === 0 ? (
                            <tr>
                              <td colSpan="8" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No batches yet. Click &quot;Add Batch Row&quot; to add batches for Product {pIdx + 1}.
                              </td>
                            </tr>
                          ) : (
                            productBatchEntries.map(({ batch, idx }, rowIdx) => renderProductBatchRow(batch, idx, rowIdx + 1))
                          )}
                        </tbody>
                        {productBatchEntries.length > 0 && (
                          <tfoot>
                            <tr style={{ background: 'var(--glass-bg)', fontWeight: 'bold' }}>
                              <td style={{ padding: '0.5rem' }}>Subtotal</td>
                              <td style={{ padding: '0.5rem' }}>{productBatchEntries.length} batch{productBatchEntries.length !== 1 ? 'es' : ''}</td>
                              <td style={{ padding: '0.5rem' }}>{productDrums} Drums</td>
                              <td style={{ padding: '0.5rem' }}>{productQty.toFixed(2)} Kg</td>
                              <td colSpan="4"></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <SearchableSelect
                      allowCustom
                      remember={false}
                      className="input-field"
                      style={{ width: '220px', maxWidth: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                      value={pendingProductName}
                      onCommit={chooseProductToAdd}
                      placeholder="Type or add product"
                    >
                      <option value="">Type or add product</option>
                      {productsAvailableToAdd.map((prod) => (
                        <option key={prod._optionKey} value={prod._optionValue || prod.name}>
                          {prod._optionLabel || prod.name}
                        </option>
                      ))}
                    </SearchableSelect>
                    {pendingProductName ? (
                      <SearchableSelect
                        allowCustom
                        className="input-field"
                        style={{ width: '220px', maxWidth: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                        value={pendingMicronSize}
                        onCommit={confirmProductMicron}
                        placeholder="Type or select micron size"
                        remember={false}
                      >
                        <option value="">Type or select micron size</option>
                        {micronsForProduct(pendingProductName).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </SearchableSelect>
                    ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', alignSelf: 'flex-end' }}
                      disabled={receivedProducts.length === 0}
                      onClick={handleRemoveAllReceivedProducts}
                    >
                      Remove All
                    </button>
                  </div>

                  {receivedProducts.length > 0 && (
                    <div style={{ marginTop: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', background: 'rgba(155, 98, 196, 0.08)', borderBottom: '1px solid var(--border-color)' }}>
                        <FileText size={16} color="var(--accent-primary)" />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Applicable Charges (Common for All Products except Processing)</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Each row has its own note box. Processing stays on the product card above.</div>
                        </div>
                      </div>
                      <div style={{ padding: '0.85rem' }}>
                        {renderCommonChargeTable(COMMON_CHARGE_ITEMS, 1)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.partyId && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Empty Drums (All Products)</h3>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleAddEmptyDrumsRow}>
                      + Add Empty Drums Row
                    </button>
                  </div>
                  {formData.batches.filter(b => b.isEmptyDrums).length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No empty drum rows added.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', background: 'var(--input-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.5rem' }}>Batch</th>
                            <th style={{ padding: '0.5rem' }}>Drums</th>
                            <th style={{ padding: '0.5rem' }}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.batches.map((batch, idx) => batch.isEmptyDrums ? (
                            <tr key={idx}>
                              <td style={{ padding: '0.5rem' }}>{batch.batchNo}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <input type="number" className="input-field" style={{ padding: '0.3rem', width: '80px' }} min="1" value={batch.drums} onChange={e => handleBatchCellChange(idx, 'drums', parseInt(e.target.value) || 0)} />
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }} onClick={() => handleRemoveBatchRow(idx)}><Trash2 size={14} /></button>
                              </td>
                            </tr>
                          ) : null)}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {formData.partyId && partyProducts.length > 0 && (
                <div style={{ padding: '1rem', background: 'rgba(155, 98, 196, 0.06)', borderRadius: '8px', border: '1px solid rgba(155, 98, 196, 0.2)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Receipt Grand Total</span>
                  <span style={{ fontWeight: 600 }}>{activeProductCount} Product{activeProductCount !== 1 ? 's' : ''} · {activeBatchCount} Active Batch{activeBatchCount !== 1 ? 'es' : ''} · {formData.totalDrums || 0} Drums · {(formData.totalQty || 0).toFixed(2)} Kg</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={closeReceiptModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!formData.batches.some(b => !b.isEmptyDrums && b.productName)}>{isEditing ? 'Apply Updates' : 'Confirm Log Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialReceipt;
