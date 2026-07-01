import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import ExportButton from '../components/ExportButton';
import { exportToPDF } from '../utils/pdfExport';
import { Plus, Search, FileDown, Edit2, Trash2, ShieldAlert } from 'lucide-react';
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
import { flattenMRChargeSnapshot } from '../utils/documentCharges';

const CHARGE_KEYS = [
  'cleaning', 'filterBag', 'processing', 'sieving', 'psdReport',
  'liner', 'courier', 'fiberDrum', 'transportation', 'hdpeDrum', 'batchChangeover'
];

const emptyChargeFlags = () =>
  Object.fromEntries(CHARGE_KEYS.map(k => [k, false]));

const emptyChargeRates = () =>
  Object.fromEntries(CHARGE_KEYS.map(k => [k, 0]));

const emptyChargeQtys = () =>
  Object.fromEntries(CHARGE_KEYS.map(k => [k, 1]));

const buildProductSettingsFromParty = (prodConfig) => {
  if (!prodConfig) {
    return {
      nickName: '',
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
    rates,
    charges,
    qtys: emptyChargeQtys(),
    customCharges: (prodConfig.customCharges || []).map(cc => ({
      ...cc,
      checked: cc.checked !== false,
      qty: cc.qty || 1
    }))
  };
};

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

const buildAllProductSettings = (party, existing = {}) => {
  const settings = { ...existing };
  (party?.products || []).forEach(prod => {
    if (!settings[prod.name]) {
      settings[prod.name] = buildProductSettingsFromParty(prod);
    }
  });
  return settings;
};

const getProductSettings = (formData, party, prodName) =>
  formData.productSettings?.[prodName]
  || buildProductSettingsFromParty((party?.products || []).find(p => p.name === prodName));

const makeDefaultBatch = (prodName, party, productSettings = {}) => {
  const prodConfig = (party?.products || []).find(p => p.name === prodName);
  const settings = productSettings[prodName] || buildProductSettingsFromParty(prodConfig);
  return {
    batchNo: '',
    drums: '',
    qty: '',
    productName: prodName,
    nickName: settings.nickName || prodConfig?.nickname || '',
    psdReq: prodConfig?.psdReq || '90% < 10M',
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
    const prodConfig = (party?.products || []).find(p => p.name === pName);
    const settings = mr.productSettings?.[pName] || buildProductSettingsFromParty(prodConfig);
    return {
      ...b,
      productName: pName,
      nickName: b.nickName || settings.nickName || prodConfig?.nickname || ''
    };
  });

  let productSettings = { ...(mr.productSettings || {}) };
  const productNames = getReceiptProductNames({ ...mr, batches }, { party });
  productNames.forEach(pName => {
    if (!productSettings[pName]) {
      const prodConfig = (party?.products || []).find(p => p.name === pName);
      productSettings[pName] = buildProductSettingsFromParty(prodConfig);
    }
  });

  const firstProduct = productNames[0] || mr.productName?.split(',')[0]?.trim() || '';
  if (firstProduct && !productSettings[firstProduct] && mr.rates) {
    productSettings[firstProduct] = {
      nickName: mr.nickName || '',
      rates: { ...mr.rates },
      charges: { ...mr.charges },
      qtys: { ...(mr.qtys || emptyChargeQtys()) },
      customCharges: JSON.parse(JSON.stringify(mr.customCharges || []))
    };
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
    batches: [], // Array of { batchNo, drums: 0, qty: 0, psdReq: '', psdReport: 'No', psdMethod: '', isEmptyDrums: false }
    totalDrums: 0,
    totalQty: 0,
    charges: { cleaning: false, filterBag: false, processing: false, sieving: false, psdReport: false, liner: false, courier: false, fiberDrum: false, transportation: false, hdpeDrum: false, batchChangeover: false },
    rates: { cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0, liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0 },
    qtys: { cleaning: 1, filterBag: 1, processing: 1, sieving: 1, psdReport: 1, liner: 1, courier: 1, fiberDrum: 1, transportation: 1, hdpeDrum: 1, batchChangeover: 1 },
    customCharges: [],
    productSettings: {}
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
    const pId = e.target.value;
    if (!pId) {
      setFormData(prev => ({
        ...prev,
        partyId: '',
        partyName: '',
        billAddress: '',
        gstinBill: '',
        shipAddress: '',
        gstinShip: '',
        productName: '',
        nickName: '',
        batches: [],
        productSettings: {}
      }));
      return;
    }

    const party = data.parties.find(p => p.id === pId);
    if (party) {
      setFormData(prev => ({
        ...prev,
        partyId: pId,
        partyName: party.name,
        billAddress: party.billAddress || '',
        gstinBill: party.gstinBill || '',
        shipAddress: party.shipAddress || '',
        gstinShip: party.gstinShip || '',
        productName: '',
        nickName: '',
        batches: [],
        productSettings: buildAllProductSettings(party)
      }));
    }
  };

  const patchProductSettings = (prodName, updater) => {
    setFormData(prev => {
      const party = data.parties.find(p => p.id === prev.partyId);
      const current = getProductSettings(prev, party, prodName);
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return {
        ...prev,
        productSettings: { ...prev.productSettings, [prodName]: next }
      };
    });
  };

  const handleAddBatchForProduct = (prodName) => {
    setFormData(prev => {
      const party = data.parties.find(p => p.id === prev.partyId);
      const defaultBatch = makeDefaultBatch(prodName, party, prev.productSettings);
      return { ...prev, batches: [...prev.batches, defaultBatch] };
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

  const handleEdit = (mr) => {
    const prepared = prepareReceiptEditData(mr, data.parties);
    const productSettings = buildAllProductSettings(prepared.party, prepared.baseForm.productSettings);
    setFormData({
      ...prepared.baseForm,
      productSettings,
      productName: prepared.baseForm.productName || '',
      nickName: '',
      totalDrums: prepared.baseForm.totalDrums || 0,
      totalQty: prepared.baseForm.totalQty || 0,
      charges: { ...emptyChargeFlags(), ...(prepared.baseForm.charges || {}) },
      rates: { ...emptyChargeRates(), ...(prepared.baseForm.rates || {}) },
      qtys: { ...emptyChargeQtys(), ...(prepared.baseForm.qtys || {}) },
      customCharges: prepared.baseForm.customCharges || []
    });
    setIsEditing(mr.id);
    setIsModalOpen(true);
  };

  const closeReceiptModal = () => {
    setIsModalOpen(false);
    setIsEditing(null);
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
      batches: [],
    totalDrums: 0,
    totalQty: 0,
    charges: { cleaning: false, filterBag: false, processing: false, sieving: false, psdReport: false, liner: false, courier: false, fiberDrum: false, transportation: false, hdpeDrum: false, batchChangeover: false },
    rates: { cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0, liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0 },
    qtys: { cleaning: 1, filterBag: 1, processing: 1, sieving: 1, psdReport: 1, liner: 1, courier: 1, fiberDrum: 1, transportation: 1, hdpeDrum: 1, batchChangeover: 1 },
    customCharges: [],
    productSettings: {}
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const buildPlansFromReceipt = (receipt) => {
    const party = data.parties.find(p => p.id === receipt.partyId)
      || data.parties.find(p => p.name === receipt.partyName);

    return (receipt.batches || [])
      .filter(b => !b.isEmptyDrums)
      .map((batch, idx) => {
        const batchProduct = batch.productName || receipt.productName?.split(',')[0]?.trim() || '';
        const prodConfig = (party?.products || []).find(p => p.name === batchProduct);
        return {
          id: `${receipt.id}_batch_${idx}`,
          receiptId: receipt.id,
          createdAt: receipt.createdAt || new Date().toISOString(),
          customer: receipt.partyName || party?.name || '',
          productName: batchProduct,
          productNickName: batch.nickName || prodConfig?.nickname || receipt.nickName || '',
          psdReq: batch.psdReq || prodConfig?.psdReq || '',
          psdNote: prodConfig?.psdNote || '',
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
      if (!formData.partyId) {
        alert("Please select a Party.");
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

      const syncedProductSettings = { ...(formData.productSettings || {}) };
      (selectedPartyObj?.products || []).forEach(prod => {
        const hasBatch = formData.batches.some(
          b => !b.isEmptyDrums
            && (b.productName || '').trim().toLowerCase() === prod.name.trim().toLowerCase()
        );
        if (!hasBatch) return;
        const live = getProductSettings(formData, selectedPartyObj, prod.name);
        syncedProductSettings[prod.name] = {
          nickName: live.nickName || '',
          charges: { ...emptyChargeFlags(), ...(live.charges || {}) },
          rates: { ...emptyChargeRates(), ...(live.rates || {}) },
          qtys: { ...emptyChargeQtys(), ...(live.qtys || {}) },
          customCharges: JSON.parse(JSON.stringify(live.customCharges || []))
        };
      });

      const receiptPayload = isEditing
        ? { ...formData, ...productSummary, productSettings: syncedProductSettings, id: isEditing }
        : { ...formData, ...productSummary, productSettings: syncedProductSettings, id: Date.now().toString(), status: 'Pending', createdAt: new Date().toISOString() };

      const chargeFlatten = flattenMRChargeSnapshot(receiptPayload, selectedPartyObj);
      if (chargeFlatten) {
        receiptPayload.charges = chargeFlatten.charges;
        receiptPayload.rates = chargeFlatten.rates;
        receiptPayload.qtys = chargeFlatten.qtys;
        receiptPayload.customCharges = chargeFlatten.customCharges;
      }

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

  // Filtered List
  const filteredReceipts = (data.materialReceipts || []).filter(mr => 
    (mr.receiptNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mr.partyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mr.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mr.partyDocNo && mr.partyDocNo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          required
          value={batch.batchNo}
          onChange={e => handleBatchCellChange(idx, 'batchNo', e.target.value)}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          type="number"
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          required
          min="1"
          value={batch.drums === 0 || batch.drums === '' ? '' : batch.drums}
          onChange={e => handleBatchCellChange(idx, 'drums', e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          type="number"
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          required
          value={batch.qty === 0 || batch.qty === '' ? '' : batch.qty}
          onChange={e => handleBatchCellChange(idx, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          type="text"
          list="psdReqOptions"
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          required
          value={batch.psdReq}
          onChange={e => handleBatchCellChange(idx, 'psdReq', e.target.value)}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <select
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          value={batch.psdReport}
          onChange={e => handleBatchCellChange(idx, 'psdReport', e.target.value)}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </td>
      <td style={{ padding: '0.5rem' }}>
        <select
          className="input-field"
          style={{ padding: '0.3rem', fontSize: '0.825rem' }}
          value={batch.psdMethod}
          onChange={e => handleBatchCellChange(idx, 'psdMethod', e.target.value)}
        >
          <option value="Dry">Dry</option>
          <option value="Wet">Wet</option>
          <option value="">None</option>
        </select>
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

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Material Received Data (M.R.)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Log incoming supplier raw materials, batches, and PSD method specifications.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filteredReceipts} columns={tableCols} filename="Material_Receipts" title="Material Receipts Log" />
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Add Material Receipt
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by M.R. No, Supplier Doc, Party or Product..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
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
                  <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No receipts found.</td>
                </tr>
              ) : (
                filteredReceipts.map(mr => {
                  const prodOpts = receiptProductOptions(mr, data);
                  const productNames = getReceiptProductNames(mr, prodOpts);
                  const productSummaries = getReceiptProductSummaries(mr, prodOpts);
                  const totals = getReceiptTotals(mr, prodOpts);
                  const isMultiProduct = productSummaries.length > 1;
                  return (
                    <tr key={mr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{mr.receiptNo}</td>
                      <td style={{ padding: '1rem' }}>{formatDate(mr.date)} {mr.time}</td>
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
                          background: mr.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: mr.status === 'Completed' ? '#10b981' : '#f59e0b',
                          fontWeight: 600
                        }}>
                          {mr.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', overflowY: 'auto', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '1050px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{isEditing ? 'Modify Material Receipt' : 'Register Material Receipt'}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>M.R.: {formData.receiptNo}</span>
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>M.R. Date *</label>
                  <input type="date" className="input-field" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label>M.R. Time *</label>
                  <input type="time" className="input-field" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Document No *</label>
                  <input type="text" className="input-field" required placeholder="Challan / Invoice No" value={formData.partyDocNo} onChange={e => setFormData({...formData, partyDocNo: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Doc Date *</label>
                  <input type="date" className="input-field" required value={formData.partyDocDate} onChange={e => setFormData({...formData, partyDocDate: e.target.value})} />
                </div>

                <div style={{ gridColumn: 'span 4', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0.5rem 0' }}></div>

                {/* Party Selection */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Party Name *</label>
                  <select 
                    className="input-field" 
                    required 
                    value={formData.partyId}
                    onChange={handlePartyChange}
                  >
                    <option value="">Select Customer / Supplier</option>
                    {data.parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.vendorCode})</option>
                    ))}
                  </select>
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

                <div>
                  <label>Material Declared Value (₹)</label>
                  <input type="number" className="input-field" placeholder="Editable" value={formData.value} onChange={e => setFormData({...formData, value: parseFloat(e.target.value) || ''})} />
                </div>
              </div>

              <datalist id="psdReqOptions">
                {(data.psdRequirements || []).map((r, idx) => (
                  <option key={idx} value={r} />
                ))}
              </datalist>

              {formData.partyId && partyProducts.length === 0 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--input-bg)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px dashed var(--border-color)' }}>
                  No products configured for this party. Add products in Party master first.
                </div>
              )}

              {formData.partyId && partyProducts.map((prod, pIdx) => {
                const settings = getProductSettings(formData, selectedPartyObj, prod.name);
                const productBatchEntries = formData.batches
                  .map((batch, idx) => ({ batch, idx }))
                  .filter(({ batch }) => !batch.isEmptyDrums && batch.productName === prod.name);
                const productDrums = productBatchEntries.reduce((sum, { batch }) => sum + (parseInt(batch.drums) || 0), 0);
                const productQty = productBatchEntries.reduce((sum, { batch }) => sum + (parseFloat(batch.qty) || 0), 0);

                return (
                  <div key={prod.name} style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', background: 'var(--input-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--accent-primary)' }}>
                          Product {pIdx + 1}: {prod.name}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                          PSD Req: {prod.psdReq || '—'} · Cleaning ₹{settings.rates?.cleaning ?? prod.charges?.cleaning ?? 0} · Processing ₹{settings.rates?.processing ?? prod.charges?.processing ?? 0} · Filter Bag ₹{settings.rates?.filterBag ?? prod.charges?.filterBag ?? 0}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label>Nickname</label>
                      <input type="text" className="input-field" value={settings.nickName || ''} onChange={e => patchProductSettings(prod.name, s => ({ ...s, nickName: e.target.value }))} />
                    </div>

                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Pre-defined Applicable Charges</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      {CHARGE_ITEMS.map(item => (
                        <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="checkbox"
                              checked={settings.charges?.[item.key] || false}
                              onChange={() => patchProductSettings(prod.name, s => ({ ...s, charges: { ...s.charges, [item.key]: !s.charges[item.key] } }))}
                            />
                            {item.label}
                          </label>
                          {settings.charges?.[item.key] && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty:</span>
                              <input
                                type="number"
                                className="input-field"
                                style={{ padding: '0.2rem', width: '60px', height: 'auto', fontSize: '0.8rem' }}
                                value={settings.qtys?.[item.key] || 1}
                                onChange={e => patchProductSettings(prod.name, s => ({ ...s, qtys: { ...s.qtys, [item.key]: parseFloat(e.target.value) || 0 } }))}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹</span>
                              <input
                                type="number"
                                className="input-field"
                                style={{ padding: '0.2rem', width: '80px', height: 'auto', fontSize: '0.8rem' }}
                                value={settings.rates?.[item.key] || 0}
                                onChange={e => patchProductSettings(prod.name, s => ({ ...s, rates: { ...s.rates, [item.key]: parseFloat(e.target.value) || 0 } }))}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-primary)', margin: 0 }}>Custom / Extra Charges</h4>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => patchProductSettings(prod.name, s => ({ ...s, customCharges: [...(s.customCharges || []), { name: '', hsn: '', rate: 0, qty: 1, checked: true }] }))}>
                          + Add Custom Charge
                        </button>
                      </div>
                      {(settings.customCharges || []).length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No custom charges added.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {(settings.customCharges || []).map((charge, cIdx) => (
                            <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <input type="checkbox" checked={charge.checked} onChange={e => patchProductSettings(prod.name, s => {
                                const customCharges = [...(s.customCharges || [])];
                                customCharges[cIdx] = { ...customCharges[cIdx], checked: e.target.checked };
                                return { ...s, customCharges };
                              })} />
                              <input type="text" className="input-field" style={{ flex: 2, padding: '0.2rem', fontSize: '0.8rem' }} placeholder="Charge Name" value={charge.name} onChange={e => patchProductSettings(prod.name, s => {
                                const customCharges = [...(s.customCharges || [])];
                                customCharges[cIdx] = { ...customCharges[cIdx], name: e.target.value };
                                return { ...s, customCharges };
                              })} />
                              <input type="text" className="input-field" style={{ flex: 1, padding: '0.2rem', fontSize: '0.8rem' }} placeholder="HSN" value={charge.hsn} onChange={e => patchProductSettings(prod.name, s => {
                                const customCharges = [...(s.customCharges || [])];
                                customCharges[cIdx] = { ...customCharges[cIdx], hsn: e.target.value };
                                return { ...s, customCharges };
                              })} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty:</span>
                              <input type="number" className="input-field" style={{ width: '60px', padding: '0.2rem', fontSize: '0.8rem' }} value={charge.qty} onChange={e => patchProductSettings(prod.name, s => {
                                const customCharges = [...(s.customCharges || [])];
                                customCharges[cIdx] = { ...customCharges[cIdx], qty: parseFloat(e.target.value) || 0 };
                                return { ...s, customCharges };
                              })} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹</span>
                              <input type="number" className="input-field" style={{ width: '80px', padding: '0.2rem', fontSize: '0.8rem' }} value={charge.rate} onChange={e => patchProductSettings(prod.name, s => {
                                const customCharges = [...(s.customCharges || [])];
                                customCharges[cIdx] = { ...customCharges[cIdx], rate: parseFloat(e.target.value) || 0 };
                                return { ...s, customCharges };
                              })} />
                              <button type="button" className="btn" style={{ padding: '0.3rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }} onClick={() => patchProductSettings(prod.name, s => ({ ...s, customCharges: (s.customCharges || []).filter((_, i) => i !== cIdx) }))}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Batch Details</h4>
                      <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleAddBatchForProduct(prod.name)}>
                        <Plus size={14} /> Add Batch Row
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto', background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.5rem', width: '60px' }}>Sr No</th>
                            <th style={{ padding: '0.5rem' }}>Batch Number *</th>
                            <th style={{ padding: '0.5rem', width: '120px' }}>No of Drums *</th>
                            <th style={{ padding: '0.5rem', width: '150px' }}>Quantity (Kg) *</th>
                            <th style={{ padding: '0.5rem' }}>PSD Req *</th>
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
                );
              })}

              {formData.partyId && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
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
                <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.06)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Receipt Grand Total</span>
                  <span style={{ fontWeight: 600 }}>{activeProductCount} Product{activeProductCount !== 1 ? 's' : ''} · {activeBatchCount} Active Batch{activeBatchCount !== 1 ? 'es' : ''} · {formData.totalDrums || 0} Drums · {(formData.totalQty || 0).toFixed(2)} Kg</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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
