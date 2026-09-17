import React, { useState, useEffect, useMemo } from 'react';
import { numberInputValue, parseOptionalNumber } from '../utils/numberInput';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import {Eye,  Edit2, Trash2, FileDown, ClipboardList, Plus } from 'lucide-react';
import { exportToPDF, viewPDF } from '../utils/pdfExport';
import SearchableSelect from '../components/SearchableSelect';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import StatusTabBar from '../components/StatusTabBar';
import DateField from '../components/DateField';
import {
  getReceiptProductLabel,
  getReceiptProductSummaries,
  getReceiptProductNames,
  receiptProductOptions,
  findAnyPackingList,
  getPLDisplayProductLabel,
  buildPLBatchesFromMR,
  getProductBatches
} from '../utils/receiptProducts';

const PackingList = () => {
  const { data, updateData, updateItem, incrementSerial, deleteItemSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPL, setEditingPL] = useState(null);
  const [selectedBPR, setSelectedBPR] = useState(null);

  const [form, setForm] = useState({
    plNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    receiptNo: '',
    productName: '',
    productSummaries: [],
    totalWeight: 0,
    totalDrums: 0,
    sievingLumps: '',
    batches: []
  });

  const activeMR = useMemo(() => {
    const receiptId = editingPL?.receiptId || selectedBPR?.receiptId;
    return receiptId ? (data.materialReceipts || []).find(m => m.id === receiptId) : null;
  }, [editingPL, selectedBPR, data.materialReceipts]);

  const prodOpts = activeMR ? receiptProductOptions(activeMR, data) : {};
  const productNames = activeMR ? getReceiptProductNames(activeMR, prodOpts) : [];

  const parseWt = (v) => (v === '' || v === undefined || v === null ? 0 : parseFloat(v) || 0);
  const normProd = (s) => (s || '').trim().toLowerCase();
  const isFilledPlRow = (r) => {
    if (!r) return false;
    const hasWeight = parseWt(r.gross) > 0 || parseWt(r.tare) > 0 || parseWt(r.net) > 0;
    const hasId = String(r.batchNo || '').trim() || String(r.drumNo ?? '').trim();
    return hasWeight || !!hasId;
  };

  const displayProducts = useMemo(() => {
    const fromRows = [...new Set((form.batches || []).map(r => r.productName).filter(Boolean))];
    if (productNames.length) {
      const merged = [...productNames];
      fromRows.forEach((name) => {
        if (!merged.some(p => normProd(p) === normProd(name))) merged.push(name);
      });
      return merged;
    }
    if (fromRows.length) return fromRows;
    if (form.productName) return [form.productName];
    return [''];
  }, [form.batches, form.productName, productNames]);

  const formInitKey = editingPL?.id || selectedBPR?.id || (isModalOpen && !editingPL && !selectedBPR ? 'manual' : '');

  useEffect(() => {
    if (!isModalOpen) return;

    if (editingPL) {
      const mr = (data.materialReceipts || []).find(m => m.id === editingPL.receiptId);
      const opts = mr ? receiptProductOptions(mr, data) : {};
      const summaries = mr
        ? getReceiptProductSummaries(mr, opts).filter(p => p.batchCount > 0 || p.qty > 0)
        : (editingPL.productSummaries || []);
      const mergedBatches = mr
        ? buildPLBatchesFromMR(data, mr, opts, editingPL.batches || [])
        : (editingPL.batches || []);
      setForm({
        ...editingPL,
        partyName: editingPL.partyName || mr?.partyName || '',
        receiptNo: editingPL.receiptNo || mr?.receiptNo || '',
        productName: mr ? getReceiptProductLabel(mr, opts) : (editingPL.productName || ''),
        productSummaries: summaries.length ? summaries : (editingPL.productSummaries || []),
        sievingLumps: editingPL.sievingLumps ?? editingPL.sievingLumpsNet ?? '',
        batches: (mergedBatches || []).filter(isFilledPlRow)
      });
      return;
    }

    if (selectedBPR && activeMR) {
      const plSerial = data.settings?.serials?.PL || 1;
      const docNo = generateDocNumber('PL', plSerial, new Date());
      const summaries = getReceiptProductSummaries(activeMR, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
      const plRows = buildPLBatchesFromMR(data, activeMR, prodOpts);

      setForm({
        plNo: docNo,
        date: new Date().toISOString().split('T')[0],
        partyName: activeMR.partyName || selectedBPR.partyName || '',
        receiptNo: activeMR.receiptNo || '',
        productName: getReceiptProductLabel(activeMR, prodOpts),
        productSummaries: summaries,
        totalWeight: 0,
        totalDrums: plRows.length,
        sievingLumps: selectedBPR.lumpsNetWeight || selectedBPR.lumpsNet || '',
        batches: plRows
      });
    }
  }, [formInitKey, isModalOpen]);

  const grandTotal = useMemo(() => {
    const fromBatches = (form.batches || []).reduce((acc, b) => {
      const net = b.net !== '' && b.net !== undefined ? parseWt(b.net) : Math.max(0, parseWt(b.gross) - parseWt(b.tare));
      return {
        gross: acc.gross + parseWt(b.gross),
        tare: acc.tare + parseWt(b.tare),
        net: acc.net + net,
        drums: acc.drums + 1
      };
    }, { gross: 0, tare: 0, net: 0, drums: 0 });
    const lumps = parseWt(form.sievingLumps);
    return { ...fromBatches, lumps, net: fromBatches.net + lumps };
  }, [form.batches, form.sievingLumps]);

  useEffect(() => {
    setForm(prev => ({ ...prev, totalDrums: prev.batches.length, totalWeight: grandTotal.net }));
  }, [grandTotal.net, form.batches.length]);

  const handleCellChange = (idx, field, val) => {
    setForm(prev => {
      const list = [...prev.batches];
      const item = { ...list[idx] };
      if (field === 'batchNo' || field === 'drumNo' || field === 'productName') {
        item[field] = val;
      } else {
        item[field] = parseOptionalNumber(val);
        if (field === 'gross' || field === 'tare') {
          const g = parseWt(item.gross);
          const t = parseWt(item.tare);
          item.net = (item.gross === '' || item.tare === '') ? '' : Math.max(0, g - t);
        }
      }
      list[idx] = item;
      return { ...prev, batches: list };
    });
  };

  const addCustomRow = (productName = '') => {
    const prod = productName || form.productName || productNames[0] || '';
    setForm(prev => {
      const prodRows = prev.batches.filter(b => normProd(b.productName || prod) === normProd(prod));
      const mrBatchNo = activeMR
        ? (getProductBatches(activeMR, prod, prodOpts)[0]?.batchNo || '')
        : '';
      const batchNo = prodRows.find(b => b.batchNo)?.batchNo || mrBatchNo || '';
      return {
        ...prev,
        batches: [...prev.batches, {
          batchNo,
          drumNo: (prodRows.length + 1).toString(),
          productName: prod,
          gross: '',
          tare: '',
          net: ''
        }]
      };
    });
  };

  const removeRow = (idx) => {
    setForm(prev => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== idx)
    }));
  };

  const rowMatchesProduct = (row, prodName) => {
    const target = (prodName || form.productName || '').trim().toLowerCase();
    const rowProd = (row.productName || '').trim().toLowerCase();
    if (!target) return !rowProd;
    return rowProd === target;
  };

  const handleCreate = (bpr) => {
    const existing = findAnyPackingList(data.packingLists, bpr.receiptId);
    if (existing) {
      setEditingPL(existing);
      setSelectedBPR(null);
    } else {
      setSelectedBPR(bpr);
      setEditingPL(null);
      setForm({
        plNo: '',
        date: new Date().toISOString().split('T')[0],
        partyName: '',
        receiptNo: '',
        productName: '',
        productSummaries: [],
        totalWeight: 0,
        totalDrums: 0,
        sievingLumps: '',
        batches: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedBPR(null);
    setEditingPL(null);
    const plSerial = data.settings?.serials?.PL || 1;
    const docNo = generateDocNumber('PL', plSerial, new Date());
    setForm({
      plNo: docNo,
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      receiptNo: '',
      productName: '',
      productSummaries: [],
      totalWeight: 0,
      totalDrums: 0,
      sievingLumps: '',
      batches: []
    });
    setIsModalOpen(true);
  };

  const handleEdit = (pl) => {
    setEditingPL(pl);
    setSelectedBPR(null);
    setIsModalOpen(true);
  };

  const deletePL = (id) => {
    if (window.confirm("Delete this Packing List record?")) {
      deleteItemSoftly('packingLists', id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const mr = activeMR;
    const opts = mr ? receiptProductOptions(mr, data) : {};
    const summaries = mr
      ? getReceiptProductSummaries(mr, opts).filter(p => p.batchCount > 0 || p.qty > 0)
      : (form.productSummaries || []);

    const finalDoc = {
      ...form,
      receiptId: editingPL ? editingPL.receiptId : (selectedBPR?.receiptId || ''),
      partyName: form.partyName || mr?.partyName || selectedBPR?.partyName || '',
      receiptNo: form.receiptNo || mr?.receiptNo || '',
      productName: mr ? getReceiptProductLabel(mr, opts) : form.productName,
      productSummaries: summaries.length ? summaries : (form.productSummaries || []),
      batches: (form.batches || []).filter(isFilledPlRow),
      totalDrums: (form.batches || []).filter(isFilledPlRow).length,
      sievingLumps: form.sievingLumps === '' || form.sievingLumps == null ? '' : parseWt(form.sievingLumps),
      totalWeight: grandTotal.net
    };

    if (editingPL) {
      updateItem('packingLists', editingPL.id, finalDoc);
    } else {
      if (finalDoc.receiptId && findAnyPackingList(data.packingLists, finalDoc.receiptId)) {
        alert('A Packing List already exists for this Material Receipt. Please edit the existing PL.');
        return;
      }
      updateData('packingLists', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PL');
    }
    setIsModalOpen(false);
  };

  const pendingBPRs = (data.bprs || []).filter(b =>
    !findAnyPackingList(data.packingLists, b.receiptId)
  );

  const seenReceipts = new Set();
  const uniquePendingBPRs = pendingBPRs.filter(b => {
    if (seenReceipts.has(b.receiptId)) return false;
    seenReceipts.add(b.receiptId);
    return true;
  });

  const plList = (data.packingLists || []).filter((pl) => !pl.isDeleted);
  const partyOptions = useMemo(() => uniqueSortedOptions(plList.map((pl) => pl.partyName)), [plList]);
  const productOptions = useMemo(
    () => uniqueSortedOptions(plList.map((pl) => getPLDisplayProductLabel(pl, data))),
    [plList, data]
  );
  const filteredPLs = plList.filter((pl) => {
    const label = getPLDisplayProductLabel(pl, data);
    if (partyFilter && (pl.partyName || '') !== partyFilter) return false;
    if (productFilter && label !== productFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (pl.plNo || '').toLowerCase().includes(q) ||
      (pl.partyName || '').toLowerCase().includes(q) ||
      label.toLowerCase().includes(q)
    );
  });

  const getBPRProductLabel = (bpr) => {
    const mr = (data.materialReceipts || []).find(m => m.id === bpr.receiptId);
    if (mr) return getReceiptProductLabel(mr, receiptProductOptions(mr, data));
    return bpr.productName || '';
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Packing Lists (P.L.)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate batch weight packlists carrying forward dispatched milling data.</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          <Plus size={18} /> Create New PL
        </button>
      </header>

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search PL No, party or chemical..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        productFilter={productFilter}
        onProductChange={setProductFilter}
        productOptions={productOptions}
      />

      <StatusTabBar
        value={statusTab}
        onChange={setStatusTab}
        allCount={uniquePendingBPRs.length + plList.length}
        pendingCount={uniquePendingBPRs.length}
        completedCount={plList.length}
      />

      <div style={{ display: 'grid', gridTemplateColumns: statusTab === 'all' ? '1fr 2fr' : '1fr', gap: '1.5rem' }}>
        {(statusTab === 'all' || statusTab === 'pending') && (
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending BPR to Pack
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a completed batch to compile packing weight lists.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {uniquePendingBPRs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending BPRs awaiting packing lists.</p>
            ) : (
              uniquePendingBPRs.map(bpr => (
                <div
                  key={bpr.id}
                  className="glass-panel"
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }}
                  onClick={() => handleCreate(bpr)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{bpr.bprNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{bpr.partyName}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    {getBPRProductLabel(bpr)} — {bpr.totalDispatchedNet?.toFixed(1) || 0} Kg ({bpr.dispatchedBatches?.length || 0} Drums)
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {(statusTab === 'all' || statusTab === 'completed') && (
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Packing List Log</h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>PL No</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Total Weight</th>
                  <th style={{ padding: '0.75rem' }}>Total Drums</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPLs.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No PL records found.</td></tr>
                ) : (
                  filteredPLs.map(pl => (
                    <tr key={pl.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{pl.plNo}</td>
                      <td style={{ padding: '0.75rem' }}>{getPLDisplayProductLabel(pl, data)}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{pl.totalWeight?.toFixed(2)} Kg</td>
                      <td style={{ padding: '0.75rem' }}>{pl.totalDrums} Drums</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button title="Preview PDF" onClick={() => viewPDF('PL', pl)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Eye size={14} /></button>
                          <button onClick={() => exportToPDF('PL', pl)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(pl)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deletePL(pl.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {isModalOpen && (
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingPL ? 'Modify Packing List' : 'Create Packing List (P.L.)'}</h2>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Packing List No</label>
                  <input type="text" className="input-field" readOnly value={form.plNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Packing List Date</label>
                  <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>Party Name</label>
                  <SearchableSelect
                    allowCustom
                    className="input-field"
                    disabled={!!activeMR}
                    placeholder={activeMR ? '' : 'Select or type party name'}
                    value={form.partyName || ''}
                    onChange={e => setForm({ ...form, partyName: e.target.value })}
                  >
                    <option value="">{activeMR ? '' : 'Select or type party name'}</option>
                    {(data.parties || []).filter(p => !p.isDeleted).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div>
                  <label>MR No</label>
                  <input type="text" className="input-field" readOnly value={form.receiptNo || activeMR?.receiptNo || '—'} />
                </div>
                <div>
                  <label>Product(s)</label>
                  <input
                    type="text"
                    className="input-field"
                    readOnly={!!activeMR}
                    value={form.productName}
                    onChange={e => setForm({ ...form, productName: e.target.value })}
                    placeholder={activeMR ? '' : 'Enter product name'}
                  />
                  {(form.productSummaries || []).length > 1 && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {(form.productSummaries || []).map((p, idx) => (
                        <span key={p.prodName || idx} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {p.prodName} · {parseFloat(p.qty || 0).toFixed(2)} Kg · {p.drums || 0} drums
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label>Sieving Lumps (Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="0.00"
                    value={numberInputValue(form.sievingLumps)}
                    onChange={e => setForm({ ...form, sievingLumps: parseOptionalNumber(e.target.value) })}
                  />
                </div>
                <div>
                  <label>Total Weight (Calculated)</label>
                  <input type="text" className="input-field" readOnly value={`${form.totalWeight.toFixed(2)} Kg`} style={{ fontWeight: 600 }} />
                </div>
                <div>
                  <label>Total Number of Drums</label>
                  <input type="text" className="input-field" readOnly value={`${form.totalDrums} Drums`} style={{ fontWeight: 600 }} />
                </div>
              </div>

              <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Batch-Wise Packing Weight Details</h3>
                </div>

                {displayProducts.map((prodName, pIdx) => {
                  const prodRows = (form.batches || []).map((r, idx) => ({ r, idx })).filter(({ r }) =>
                    rowMatchesProduct(r, prodName)
                  );
                  const sectionLabel = prodName || form.productName || `Product ${pIdx + 1}`;

                  const batchGroups = [];
                  const map = {};
                  prodRows.forEach(({ r, idx }) => {
                    const key = String(r.batchNo ?? '').trim() || '—';
                    if (!map[key]) {
                      map[key] = { batchNo: key, rows: [], gross: 0, tare: 0, net: 0, drums: 0 };
                      batchGroups.push(map[key]);
                    }
                    const net = r.net !== '' && r.net !== undefined && r.net !== null
                      ? parseWt(r.net)
                      : Math.max(0, parseWt(r.gross) - parseWt(r.tare));
                    map[key].rows.push({ ...r, idx, netVal: net });
                    map[key].gross += parseWt(r.gross);
                    map[key].tare += parseWt(r.tare);
                    map[key].net += net;
                    map[key].drums += 1;
                  });

                  return (
                    <div key={`${sectionLabel}-${pIdx}`} style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          Product {pIdx + 1}: {sectionLabel}
                        </h4>
                        <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow(prodName || form.productName)}>+ Add Row</button>
                      </div>
                      <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '0.35rem' }}>Sr No</th>
                              <th style={{ padding: '0.35rem' }}>Batch No</th>
                              <th style={{ padding: '0.35rem' }}>Drum No</th>
                              <th style={{ padding: '0.35rem' }}>Gross Wt (Manual)</th>
                              <th style={{ padding: '0.35rem' }}>Tare Wt (Manual)</th>
                              <th style={{ padding: '0.35rem' }}>Net Wt (Auto)</th>
                              <th style={{ padding: '0.35rem', width: '44px' }}>Del</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prodRows.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  No rows yet — click &quot;+ Add Row&quot; to add drum weights for this product.
                                </td>
                              </tr>
                            ) : batchGroups.map(group => (
                              <React.Fragment key={`${sectionLabel}-batch-${group.batchNo}`}>
                                {group.rows.map((r) => (
                                  <tr key={r.idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.idx + 1}</td>
                                    <td style={{ padding: '0.25rem' }}>
                                      <input type="text" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.batchNo || ''} onChange={e => handleCellChange(r.idx, 'batchNo', e.target.value)} />
                                    </td>
                                    <td style={{ padding: '0.25rem' }}>
                                      <input type="text" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem', width: '60px' }} value={r.drumNo || ''} onChange={e => handleCellChange(r.idx, 'drumNo', e.target.value)} />
                                    </td>
                                    <td style={{ padding: '0.25rem' }}>
                                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={numberInputValue(r.gross)} onChange={e => handleCellChange(r.idx, 'gross', e.target.value)} />
                                    </td>
                                    <td style={{ padding: '0.25rem' }}>
                                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={numberInputValue(r.tare)} onChange={e => handleCellChange(r.idx, 'tare', e.target.value)} />
                                    </td>
                                    <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                      {r.netVal > 0 ? r.netVal.toFixed(2) : '0.00'}
                                    </td>
                                    <td style={{ padding: '0.25rem' }}>
                                      <button
                                        type="button"
                                        title="Delete row"
                                        onClick={() => removeRow(r.idx)}
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer' }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                <tr style={{ background: 'rgba(91, 28, 133, 0.1)', borderBottom: '2px solid var(--accent-primary)' }}>
                                  <td colSpan={3} style={{ padding: '0.45rem 0.35rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '0.8rem' }}>
                                    TOTAL — Batch {group.batchNo}
                                  </td>
                                  <td style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>
                                    {group.gross.toFixed(2)}
                                  </td>
                                  <td style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>
                                    {group.tare.toFixed(2)}
                                  </td>
                                  <td style={{ padding: '0.45rem 0.35rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                                    {group.net.toFixed(2)}
                                  </td>
                                  <td />
                                </tr>
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {!displayProducts.length && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }}>
                    Enter a product name above, then add weight rows.
                  </p>
                )}

                {form.batches.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '0.25rem', border: '1px solid var(--border-color)' }}>
                    <tbody>
                      {grandTotal.lumps > 0 && (
                        <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td colSpan={3} style={{ padding: '0.5rem' }} />
                          <td style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'center' }}>Sieving Lumps</td>
                          <td style={{ padding: '0.5rem' }} />
                          <td style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'center' }}>{grandTotal.lumps.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr style={{ background: 'rgba(91, 28, 133, 0.1)', borderTop: '2px solid var(--accent-primary)' }}>
                        <td colSpan={3} style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                          GRAND TOTAL
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: 'var(--accent-primary)', textAlign: 'center' }}>
                          {grandTotal.gross.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: 'var(--accent-primary)', textAlign: 'center' }}>
                          {grandTotal.tare.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: 'var(--accent-primary)', textAlign: 'center', minWidth: '90px' }}>
                          {grandTotal.net.toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Packing List</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackingList;
