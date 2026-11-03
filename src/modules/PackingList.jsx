import React, { useState, useEffect, useMemo, useRef } from 'react';
import { numberInputValue, parseOptionalNumber } from '../utils/numberInput';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Eye, Edit2, Trash2, Plus, List } from 'lucide-react';
import { viewPDF } from '../utils/pdfExport';
import DocDownloadButtons from '../components/DocDownloadButtons';
import ExportButton from '../components/ExportButton';
import DocCreationLogModal from '../components/DocCreationLogModal';
import SearchableSelect from '../components/SearchableSelect';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import StatusTabBar from '../components/StatusTabBar';
import DateField from '../components/DateField';
import { formatDate, newestFirst } from '../utils/dateUtils';
import {
  getReceiptProductLabel,
  getReceiptProductSummaries,
  getReceiptProductNames,
  receiptProductOptions,
  findReceiptDoc,
  getPLDefaultSelectedProducts,
  getProductsNeedingPL,
  buildPLFieldsFromProducts,
  getPLDisplayProductLabel,
  buildPLBatchesFromMR,
  getProductBatches,
  plRowMicron
} from '../utils/receiptProducts';

const isUmaDrumName = (value) => /^(new uma drum|uma new drum)$/i.test(String(value || '').trim());

const rowAnchorBatch = (row) => {
  const anchor = String(row?.anchorBatch || '').trim();
  if (anchor && anchor !== '—') return anchor;
  if (row?.umaNewDrum || isUmaDrumName(row?.batchNo)) return '';
  return String(row?.batchNo || '').trim();
};

const PackingList = () => {
  const { data, updateData, updateItem, incrementSerial, deleteItemSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [showCreationLog, setShowCreationLog] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPL, setEditingPL] = useState(null);
  const [selectedBPR, setSelectedBPR] = useState(null);

  const [form, setForm] = useState({
    plNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    receiptNo: '',
    selectedProducts: [],
    productName: '',
    productSummaries: [],
    totalWeight: 0,
    totalDrums: 0,
    sievingLumps: '',
    productSievingLumps: {},
    batches: []
  });

  const activeMR = useMemo(() => {
    const receiptId = editingPL?.receiptId || selectedBPR?.receiptId;
    return receiptId ? (data.materialReceipts || []).find(m => m.id === receiptId) : null;
  }, [editingPL, selectedBPR, data.materialReceipts]);

  const prodOpts = activeMR ? receiptProductOptions(activeMR, data) : {};
  const productNames = activeMR ? getReceiptProductNames(activeMR, prodOpts) : [];
  const availableProducts = activeMR
    ? getReceiptProductSummaries(activeMR, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0)
    : [];
  const allBatchPoolRef = useRef([]);

  const parseWt = (v) => (v === '' || v === undefined || v === null ? 0 : parseFloat(v) || 0);
  const normProd = (s) => (s || '').trim().toLowerCase();
  const isFilledPlRow = (r) => {
    if (!r) return false;
    const hasWeight = parseWt(r.gross) > 0 || parseWt(r.tare) > 0 || parseWt(r.net) > 0;
    const hasId = String(r.batchNo || '').trim() || String(r.drumNo ?? '').trim();
    return hasWeight || !!hasId;
  };

  // Always show a separate batch block (+ Add Row) for every MR product
  const displayProducts = useMemo(() => {
    if (availableProducts.length) return availableProducts.map((p) => p.prodName);
    if (productNames.length) return productNames;
    const fromRows = [...new Set((form.batches || []).map(r => r.productName).filter(Boolean))];
    if (fromRows.length) return fromRows;
    if ((form.selectedProducts || []).length) return form.selectedProducts;
    if (form.productName) {
      return form.productName.includes(',')
        ? form.productName.split(',').map((s) => s.trim()).filter(Boolean)
        : [form.productName];
    }
    return [''];
  }, [availableProducts, productNames, form.batches, form.selectedProducts, form.productName]);

  const formInitKey = editingPL?.id || selectedBPR?.id || (isModalOpen && !editingPL && !selectedBPR ? 'manual' : '');

  const getProductSievingLumps = (prodName) => {
    if (form.productSievingLumps?.[prodName] !== undefined) {
      return form.productSievingLumps[prodName];
    }
    if (displayProducts.length === 1) {
      return form.sievingLumps ?? '';
    }
    return '';
  };

  const handleProductSievingLumpsChange = (prodName, val) => {
    setForm(prev => {
      const nextMap = { ...(prev.productSievingLumps || {}), [prodName]: val };
      const totalLumps = Object.values(nextMap).reduce((sum, v) => sum + parseWt(v), 0);
      return {
        ...prev,
        productSievingLumps: nextMap,
        sievingLumps: totalLumps || ''
      };
    });
  };

  useEffect(() => {
    if (!isModalOpen) return;

    if (editingPL) {
      const mr = (data.materialReceipts || []).find(m => m.id === editingPL.receiptId);
      const opts = mr ? receiptProductOptions(mr, data) : {};
      const allRows = mr
        ? buildPLBatchesFromMR(data, mr, opts, null)
        : (editingPL.batches || []);
      allBatchPoolRef.current = allRows;
      const selected = editingPL.selectedProducts?.length
        ? editingPL.selectedProducts
        : (editingPL.productName
          ? editingPL.productName.split(',').map((s) => s.trim()).filter(Boolean)
          : []);
      const fields = mr
        ? buildPLFieldsFromProducts(mr, allRows, selected, opts, editingPL.batches || [], editingPL.productSievingLumps || {})
        : {
            selectedProducts: selected,
            productName: editingPL.productName || '',
            productSummaries: editingPL.productSummaries || [],
            batches: (allRows || []).filter(isFilledPlRow),
            productSievingLumps: editingPL.productSievingLumps || {},
            sievingLumps: editingPL.sievingLumps ?? '',
            totalDrums: (editingPL.batches || []).length
          };
      setForm({
        ...editingPL,
        partyName: editingPL.partyName || mr?.partyName || '',
        receiptNo: editingPL.receiptNo || mr?.receiptNo || '',
        sievingLumps: editingPL.sievingLumps ?? editingPL.sievingLumpsNet ?? fields.sievingLumps,
        ...fields,
        batches: (fields.batches || []).filter(isFilledPlRow)
      });
      return;
    }

    if (selectedBPR && activeMR) {
      const plSerial = data.settings?.serials?.PL || 1;
      const docNo = generateDocNumber('PL', plSerial, new Date());
      const preferred = selectedBPR.productName || '';
      const selected = getPLDefaultSelectedProducts(activeMR, data.packingLists, prodOpts, preferred);
      const allRows = buildPLBatchesFromMR(data, activeMR, prodOpts);
      allBatchPoolRef.current = allRows;
      const lumpMap = { ...(selectedBPR.productSievingLumps || {}) };
      if (!Object.keys(lumpMap).length && selected.length === 1 && (selectedBPR.lumpsNetWeight || selectedBPR.lumpsNet)) {
        lumpMap[selected[0]] = selectedBPR.lumpsNetWeight || selectedBPR.lumpsNet;
      }
      const fields = buildPLFieldsFromProducts(activeMR, allRows, selected, prodOpts, [], lumpMap);
      setForm({
        plNo: docNo,
        date: new Date().toISOString().split('T')[0],
        partyName: activeMR.partyName || selectedBPR.partyName || '',
        receiptNo: activeMR.receiptNo || '',
        totalWeight: 0,
        ...fields
      });
    }
  }, [formInitKey, isModalOpen]);

  const applyProductSelection = (nextSelected, prevForm) => {
    if (!activeMR) return prevForm;
    const pool = allBatchPoolRef.current.length
      ? allBatchPoolRef.current
      : buildPLBatchesFromMR(data, activeMR, prodOpts);
    const fields = buildPLFieldsFromProducts(
      activeMR,
      pool,
      nextSelected,
      prodOpts,
      prevForm.batches || [],
      prevForm.productSievingLumps || {}
    );
    return { ...prevForm, ...fields };
  };

  const selectAllProducts = () => {
    const allNames = availableProducts.map((p) => p.prodName);
    setForm((prev) => applyProductSelection(allNames, prev));
  };

  const selectSingleProduct = (prodName) => {
    setForm((prev) => applyProductSelection([prodName], prev));
  };

  const toggleProductSelection = (prodName) => {
    setForm((prev) => {
      const current = prev.selectedProducts || [];
      const isSelected = current.some((p) => normProd(p) === normProd(prodName));
      let next;
      if (isSelected) {
        next = current.filter((p) => normProd(p) !== normProd(prodName));
        if (next.length === 0) next = [prodName];
      } else {
        next = [...current, prodName];
      }
      return applyProductSelection(next, prev);
    });
  };

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
    let lumps = 0;
    if (form.productSievingLumps && Object.keys(form.productSievingLumps).length > 0) {
      lumps = Object.values(form.productSievingLumps).reduce((acc, v) => acc + parseWt(v), 0);
    } else {
      lumps = parseWt(form.sievingLumps);
    }
    return { ...fromBatches, lumps, net: fromBatches.net + lumps };
  }, [form.batches, form.sievingLumps, form.productSievingLumps]);

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

  const addCustomRow = (productName = '', batchNo = '', psdReq = '') => {
    const prod = (productName || '').includes(',')
      ? productNames[0] || productName
      : (productName || productNames[0] || form.productName || '');
    setForm(prev => {
      const prodRows = prev.batches.filter(b => normProd(b.productName || prod) === normProd(prod));
      const requested = String(batchNo || '').trim();
      const requestedPsd = String(psdReq || '').trim();
      const scoped = requestedPsd
        ? prodRows.filter((b) => {
          const rowPsd = plRowMicron(b, activeMR);
          return !rowPsd || normProd(rowPsd) === normProd(requestedPsd);
        })
        : prodRows;
      const lastBatch = [...scoped].reverse().find((b) => String(b.batchNo || '').trim())?.batchNo || '';
      const mrBatchNo = activeMR
        ? (getProductBatches(activeMR, prod, prodOpts).find((b) => !requestedPsd || normProd(b.psdReq) === normProd(requestedPsd))?.batchNo || '')
        : '';
      const batch = requested && requested !== '—' ? requested : (lastBatch || mrBatchNo || '');
      const psd = requestedPsd || plRowMicron([...scoped].reverse().find((b) => String(b.batchNo || '').trim() === batch) || {}, activeMR);
      const batchRows = scoped.filter((b) => String(b.batchNo || '').trim() === batch);
      const nextDrum = batchRows.reduce((max, b) => {
        const n = parseInt(b.drumNo, 10);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0) + 1;
      const selected = prev.selectedProducts || [];
      const nextSelected = !prod
        ? selected
        : (selected.some((p) => normProd(p) === normProd(prod)) ? selected : [...selected, prod]);
      const row = {
        batchNo: batch,
        drumNo: String(nextDrum),
        productName: prod,
        psdReq: psd,
        gross: '',
        tare: '',
        net: ''
      };
      const lastIdx = prev.batches.reduce((found, b, i) => (
        normProd(b.productName || prod) === normProd(prod)
          && String(b.batchNo || '').trim() === batch
          && (!psd || !plRowMicron(b, activeMR) || normProd(plRowMicron(b, activeMR)) === normProd(psd))
          ? i
          : found
      ), -1);
      const batches = [...prev.batches];
      if (lastIdx >= 0) batches.splice(lastIdx + 1, 0, row);
      else batches.push(row);
      return {
        ...prev,
        selectedProducts: nextSelected,
        productName: nextSelected.length ? nextSelected.join(', ') : prev.productName,
        batches
      };
    });
  };

  const addUmaNewDrum = (productName = '', batchNo = '', psdReq = '') => {
    const prod = (productName || '').includes(',')
      ? productNames[0] || productName
      : (productName || productNames[0] || form.productName || '');
    setForm(prev => {
      const prodRows = prev.batches.filter((b) => normProd(b.productName || prod) === normProd(prod));
      const requested = String(batchNo || '').trim();
      const requestedPsd = String(psdReq || '').trim();
      const scoped = requestedPsd
        ? prodRows.filter((b) => {
          const rowPsd = plRowMicron(b, activeMR);
          return !rowPsd || normProd(rowPsd) === normProd(requestedPsd);
        })
        : prodRows;
      const anchor = requested && requested !== '—' && !isUmaDrumName(requested)
        ? requested
        : ([...scoped].reverse().map(rowAnchorBatch).find(Boolean) || '');
      const psd = requestedPsd || plRowMicron(
        scoped.find((b) => rowAnchorBatch(b) === anchor) || {},
        activeMR
      );
      const inPlace = (b) => {
        const place = anchor
          ? rowAnchorBatch(b) === anchor
          : !!(b.umaNewDrum || isUmaDrumName(b.batchNo));
        if (!place) return false;
        if (!psd) return true;
        const rowPsd = plRowMicron(b, activeMR);
        return !rowPsd || normProd(rowPsd) === normProd(psd);
      };
      const batchRows = prodRows.filter(inPlace);
      const nextDrum = batchRows.reduce((max, b) => {
        const n = parseInt(b.drumNo, 10);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0) + 1;
      const selected = prev.selectedProducts || [];
      const nextSelected = !prod
        ? selected
        : (selected.some((p) => normProd(p) === normProd(prod)) ? selected : [...selected, prod]);
      const row = {
        batchNo: 'New Uma Drum',
        drumNo: String(nextDrum),
        productName: prod,
        psdReq: psd,
        umaNewDrum: true,
        ...(anchor ? { anchorBatch: anchor } : {}),
        gross: '',
        tare: '',
        net: ''
      };
      const lastIdx = prev.batches.reduce((found, b, i) => (
        normProd(b.productName || prod) === normProd(prod) && inPlace(b)
          ? i
          : found
      ), -1);
      const batches = [...prev.batches];
      if (lastIdx >= 0) batches.splice(lastIdx + 1, 0, row);
      else batches.push(row);
      return {
        ...prev,
        selectedProducts: nextSelected,
        productName: nextSelected.length ? nextSelected.join(', ') : prev.productName,
        batches
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
    const preferred = bpr.productName || '';
    const existing = preferred
      ? findReceiptDoc(data.packingLists, bpr.receiptId, preferred)
      : null;
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
        selectedProducts: [],
        productName: '',
        productSummaries: [],
        totalWeight: 0,
        totalDrums: 0,
        sievingLumps: '',
        productSievingLumps: {},
        batches: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedBPR(null);
    setEditingPL(null);
    allBatchPoolRef.current = [];
    const plSerial = data.settings?.serials?.PL || 1;
    const docNo = generateDocNumber('PL', plSerial, new Date());
    setForm({
      plNo: docNo,
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      receiptNo: '',
      selectedProducts: [],
      productName: '',
      productSummaries: [],
      totalWeight: 0,
      totalDrums: 0,
      sievingLumps: '',
      productSievingLumps: {},
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
    const selected = (form.selectedProducts || []).length
      ? form.selectedProducts
      : (mr ? getReceiptProductNames(mr, opts) : []);

    if (mr && availableProducts.length > 1 && !selected.length) {
      alert('Select at least one product for this Packing List.');
      return;
    }

    const fields = mr
      ? buildPLFieldsFromProducts(
          mr,
          allBatchPoolRef.current.length ? allBatchPoolRef.current : (form.batches || []),
          selected.length ? selected : productNames,
          opts,
          form.batches || [],
          form.productSievingLumps || {}
        )
      : {
          selectedProducts: form.selectedProducts || [],
          productName: form.productName,
          productSummaries: form.productSummaries || [],
          batches: form.batches || [],
          productSievingLumps: form.productSievingLumps || {},
          sievingLumps: form.sievingLumps,
          totalDrums: (form.batches || []).length
        };

    const filledBatches = (fields.batches || form.batches || []).filter(isFilledPlRow);
    const totalLumps = fields.productSievingLumps && Object.keys(fields.productSievingLumps).length > 0
      ? Object.values(fields.productSievingLumps).reduce((sum, v) => sum + parseWt(v), 0)
      : parseWt(form.sievingLumps);

    const finalDoc = {
      ...form,
      ...fields,
      receiptId: editingPL ? editingPL.receiptId : (selectedBPR?.receiptId || ''),
      partyName: form.partyName || mr?.partyName || selectedBPR?.partyName || '',
      receiptNo: form.receiptNo || mr?.receiptNo || '',
      productName: fields.productName || form.productName,
      batches: filledBatches,
      totalDrums: filledBatches.length,
      sievingLumps: totalLumps || '',
      productSievingLumps: fields.productSievingLumps || {},
      totalWeight: grandTotal.net
    };

    if (editingPL) {
      updateItem('packingLists', editingPL.id, finalDoc);
    } else {
      const selectedNames = finalDoc.selectedProducts?.length
        ? finalDoc.selectedProducts
        : (finalDoc.productName ? [finalDoc.productName] : []);
      if (finalDoc.receiptId && selectedNames.length) {
        const alreadyCovered = selectedNames.filter((name) =>
          findReceiptDoc(data.packingLists, finalDoc.receiptId, name)
        );
        if (alreadyCovered.length) {
          alert(`A Packing List already exists for ${alreadyCovered.join(', ')}. Unmark those products or edit the existing PL.`);
          return;
        }
      }
      updateData('packingLists', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PL');
    }
    setIsModalOpen(false);
  };

  const pendingBPRs = newestFirst((data.bprs || []).filter((b) => {
    const mr = (data.materialReceipts || []).find((m) => m.id === b.receiptId);
    if (!mr) return true;
    const opts = receiptProductOptions(mr, data);
    const needing = getProductsNeedingPL(mr, data.packingLists, opts);
    if (!needing.length) return false;
    if (b.productName) {
      return needing.some((n) => normProd(n) === normProd(b.productName));
    }
    return true;
  }));

  const seenPending = new Set();
  const uniquePendingBPRs = pendingBPRs.filter((b) => {
    const key = `${b.receiptId}::${normProd(b.productName || '')}`;
    if (seenPending.has(key)) return false;
    seenPending.add(key);
    return true;
  });

  const plList = newestFirst((data.packingLists || []).filter((pl) => !pl.isDeleted));
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
    if (bpr.productName) return bpr.productName;
    const mr = (data.materialReceipts || []).find(m => m.id === bpr.receiptId);
    if (mr) return getReceiptProductLabel(mr, receiptProductOptions(mr, data));
    return '';
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Packing Lists (P.L.)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate batch weight packlists carrying forward dispatched milling data.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ExportButton
            data={filteredPLs}
            columns={[
              { label: 'PL No', key: 'plNo' },
              { label: 'Product', key: 'productName' },
              { label: 'Total Weight (Kg)', key: 'totalWeight', type: 'number', total: true },
              { label: 'Total Drums', key: 'totalDrums', type: 'int', total: true }
            ]}
            filename="Packing_Lists"
            title="Packing Lists"
            groupBy="partyName"
            docType="PL"
          />
          <button type="button" className="btn btn-primary" onClick={() => setShowCreationLog(true)}>
            <List size={18} /> Packing List Log ({plList.length})
          </button>
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={18} /> Create New PL
          </button>
        </div>
      </header>

      <DocCreationLogModal
        open={showCreationLog}
        onClose={() => setShowCreationLog(false)}
        title="Packing List Log"
        rows={plList}
        auditLogs={data.auditLogs}
        module="packingLists"
        searchPlaceholder="Search by PL no, party, product, or done by..."
        getSearchText={(row) => `${row.plNo || ''} ${row.partyName || ''} ${row.productName || ''}`}
        onEdit={(row) => {
          setShowCreationLog(false);
          handleEdit(row);
        }}
        onDelete={(row) => deletePL(row.id)}
        columns={[
          { key: 'plNo', label: 'PL No' },
          { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
          { key: 'partyName', label: 'Party' },
          { key: 'productName', label: 'Product', render: (r) => getPLDisplayProductLabel(r, data) },
          {
            key: 'totalWeight',
            label: 'Weight (Kg)',
            render: (r) => Number(r.totalWeight || 0).toFixed(2)
          },
          { key: 'totalDrums', label: 'Drums' }
        ]}
      />

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

      {statusTab === 'pending' ? (
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Awaiting Packing List</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Sr. No</th>
                  <th style={{ padding: '0.75rem' }}>BPR No</th>
                  <th style={{ padding: '0.75rem' }}>Party</th>
                  <th style={{ padding: '0.75rem' }}>Product / Weight</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uniquePendingBPRs.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No BPRs awaiting packing lists.</td></tr>
                ) : (
                  uniquePendingBPRs.map((bpr, idx) => (
                    <tr key={bpr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem' }}>{idx + 1}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{bpr.bprNo}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{bpr.partyName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {getBPRProductLabel(bpr)} — {bpr.totalDispatchedNet?.toFixed(1) || 0} Kg ({bpr.dispatchedBatches?.length || 0} Drums)
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleCreate(bpr)}>
                          Generate PL
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Packing List Log</h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Sr. No</th>
                  <th style={{ padding: '0.75rem' }}>PL No</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Total Weight</th>
                  <th style={{ padding: '0.75rem' }}>Total Drums</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPLs.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No PL records found.</td></tr>
                ) : (
                  filteredPLs.map((pl, idx) => (
                    <tr key={pl.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem' }}>{idx + 1}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{pl.plNo}</td>
                      <td style={{ padding: '0.75rem' }}>{getPLDisplayProductLabel(pl, data)}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{pl.totalWeight?.toFixed(2)} Kg</td>
                      <td style={{ padding: '0.75rem' }}>{pl.totalDrums} Drums</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button title="Preview PDF" onClick={() => viewPDF('PL', pl)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Eye size={14} /></button>
                          <DocDownloadButtons docType="PL" title="Packing List" getData={() => pl} />
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

                {activeMR && availableProducts.length > 1 && (
                  <div style={{ gridColumn: 'span 3', marginBottom: '0.25rem', background: 'rgba(155, 98, 196, 0.04)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(155, 98, 196, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)', margin: 0 }}>
                          Pack Selection ({form.selectedProducts?.length || 0} of {availableProducts.length} Product{(form.selectedProducts?.length || 0) !== 1 ? 's' : ''} Selected)
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Mark which product(s) this Packing List should include
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.78rem',
                            background: (form.selectedProducts || []).length === availableProducts.length ? 'var(--accent-primary)' : '#fff',
                            color: (form.selectedProducts || []).length === availableProducts.length ? '#fff' : 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)',
                            fontWeight: 600
                          }}
                          onClick={selectAllProducts}
                        >
                          Pack All ({availableProducts.length} Products)
                        </button>
                        {availableProducts.map((p, pIdx) => {
                          const isOnlyThis = (form.selectedProducts || []).length === 1 && normProd((form.selectedProducts || [])[0]) === normProd(p.prodName);
                          return (
                            <button
                              key={p.prodName}
                              type="button"
                              className="btn"
                              style={{
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.78rem',
                                background: isOnlyThis ? 'var(--accent-primary)' : '#fff',
                                color: isOnlyThis ? '#fff' : 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                fontWeight: 600
                              }}
                              onClick={() => selectSingleProduct(p.prodName)}
                            >
                              Product {pIdx + 1} Only
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                      {availableProducts.map((p, idx) => {
                        const checked = (form.selectedProducts || []).some((n) => normProd(n) === normProd(p.prodName));
                        return (
                          <label
                            key={p.prodName}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.9rem',
                              background: checked ? '#fff' : 'var(--input-bg)',
                              border: `2px solid ${checked ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                              borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                              boxShadow: checked ? '0 2px 6px rgba(155, 98, 196, 0.12)' : 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProductSelection(p.prodName)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Product {idx + 1}</span>
                                <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.prodName}</span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                {parseFloat(p.qty || 0).toFixed(2)} Kg · {p.drums || 0} drum{(p.drums || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {displayProducts.length > 1 ? (
                  displayProducts.map((pName, pIdx) => (
                    <div key={`lump-top-${pName}-${pIdx}`}>
                      <label>Product {pIdx + 1} ({pName}) Lumps (Kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        placeholder="0.00"
                        value={numberInputValue(getProductSievingLumps(pName))}
                        onChange={e => handleProductSievingLumpsChange(pName, parseOptionalNumber(e.target.value))}
                      />
                    </div>
                  ))
                ) : (
                  <div>
                    <label>Lumps (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      placeholder="0.00"
                      value={numberInputValue(form.sievingLumps)}
                      onChange={e => {
                        const val = parseOptionalNumber(e.target.value);
                        const pName = displayProducts[0] || 'default';
                        setForm({
                          ...form,
                          sievingLumps: val,
                          productSievingLumps: { ...(form.productSievingLumps || {}), [pName]: val }
                        });
                      }}
                    />
                  </div>
                )}
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
                  prodRows.forEach(({ r, idx }, localIdx) => {
                    const micron = plRowMicron(r, activeMR);
                    const anchor = String(r.anchorBatch || '').trim();
                    const batchKey = (r.umaNewDrum && anchor && anchor !== '—')
                      ? anchor
                      : (String(r.batchNo ?? '').trim() || '—');
                    const key = `${micron.toLowerCase()}|||${batchKey}`;
                    if (!map[key]) {
                      map[key] = { batchNo: batchKey, micron, rows: [], gross: 0, tare: 0, net: 0, drums: 0 };
                      batchGroups.push(map[key]);
                    }
                    const net = r.net !== '' && r.net !== undefined && r.net !== null
                      ? parseWt(r.net)
                      : Math.max(0, parseWt(r.gross) - parseWt(r.tare));
                    map[key].rows.push({ ...r, idx, netVal: net, srNo: localIdx + 1 });
                    map[key].gross += parseWt(r.gross);
                    map[key].tare += parseWt(r.tare);
                    map[key].net += net;
                    map[key].drums += 1;
                  });

                  return (
                    <div key={`${sectionLabel}-${pIdx}`} style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          Product {pIdx + 1}: {sectionLabel}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Lumps (Kg):</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field"
                            style={{ padding: '0.25rem 0.4rem', width: '100px', fontSize: '0.8rem' }}
                            placeholder="0.00"
                            value={numberInputValue(getProductSievingLumps(prodName))}
                            onChange={e => handleProductSievingLumpsChange(prodName, parseOptionalNumber(e.target.value))}
                          />
                          <button
                            type="button"
                            className="btn"
                            style={{
                              padding: '0.3rem 0.75rem',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              borderRadius: '999px',
                              border: '1px solid var(--accent-primary)',
                              color: 'var(--accent-primary)',
                              background: '#fff',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => addCustomRow(prodName || form.productName)}
                          >
                            + Add Row
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{
                              padding: '0.3rem 0.75rem',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              borderRadius: '999px',
                              border: '1px solid var(--accent-primary)',
                              color: 'var(--accent-primary)',
                              background: '#fff',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => addUmaNewDrum(prodName || form.productName)}
                          >
                            + Add Uma New Drum
                          </button>
                        </div>
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
                            ) : (() => {
                              const micronBlocks = [];
                              const micronMap = {};
                              batchGroups.forEach((group) => {
                                const id = String(group.micron || '').trim().toLowerCase();
                                if (!micronMap[id]) {
                                  micronMap[id] = { micron: group.micron || '', groups: [] };
                                  micronBlocks.push(micronMap[id]);
                                }
                                micronMap[id].groups.push(group);
                              });
                              const showMicron = micronBlocks.some((block) => block.micron);
                              return micronBlocks.map((block) => (
                              <React.Fragment key={`${sectionLabel}-micron-${block.micron || 'none'}`}>
                                {showMicron && (
                                  <tr>
                                    <td colSpan={7} style={{ padding: '0.45rem 0.35rem', fontWeight: 800, color: 'var(--accent-primary)', background: 'rgba(155, 98, 196, 0.08)' }}>
                                      Micron: {block.micron || '—'}
                                    </td>
                                  </tr>
                                )}
                                {block.groups.map(group => (
                              <React.Fragment key={`${sectionLabel}-batch-${block.micron}-${group.batchNo}`}>
                                {group.rows.map((r) => (
                                  <tr key={r.idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.srNo}</td>
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
                                <tr>
                                  <td colSpan={7} style={{ padding: '0.35rem 0.35rem 0.2rem', textAlign: 'right' }}>
                                    <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                                      <button
                                        type="button"
                                        className="btn"
                                        style={{
                                          padding: '0.25rem 0.7rem',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          borderRadius: '999px',
                                          border: '1px solid var(--accent-primary)',
                                          color: 'var(--accent-primary)',
                                          background: '#fff'
                                        }}
                                        onClick={() => addCustomRow(prodName || form.productName, group.batchNo, group.micron)}
                                      >
                                        + Add Row
                                      </button>
                                      <button
                                        type="button"
                                        className="btn"
                                        style={{
                                          padding: '0.25rem 0.7rem',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          borderRadius: '999px',
                                          border: '1px solid var(--accent-primary)',
                                          color: 'var(--accent-primary)',
                                          background: '#fff'
                                        }}
                                        onClick={() => addUmaNewDrum(prodName || form.productName, group.batchNo, group.micron)}
                                      >
                                        + Add Uma New Drum
                                      </button>
                                    </span>
                                  </td>
                                </tr>
                                <tr style={{ background: 'rgba(155, 98, 196, 0.1)', borderBottom: '2px solid var(--accent-primary)' }}>
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
                              </React.Fragment>
                              ));
                            })()}
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
                          <td style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'center' }}>Lumps</td>
                          <td style={{ padding: '0.5rem' }} />
                          <td style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'center' }}>{grandTotal.lumps.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr style={{ background: 'rgba(155, 98, 196, 0.1)', borderTop: '2px solid var(--accent-primary)' }}>
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
