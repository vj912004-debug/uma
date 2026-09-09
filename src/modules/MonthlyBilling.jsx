import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  Calendar,
  Bell,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  ArrowLeft
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import GstTaxBlock from '../components/GstTaxBlock';
import { formatDate } from '../utils/dateUtils';
import { nextAvailableDocNumber } from '../utils/numbering';
import { findAnyTaxInvoice, findAnyProformaInvoice } from '../utils/documentCharges';
import { getMRMaterialValue } from '../utils/receiptProducts';
import { viewPDF } from '../utils/pdfExport';
import {
  GST_TYPE_CGST_SGST,
  GST_TYPE_IGST,
  normalizeGstType,
  splitTaxableGstAmount
} from '../utils/taxInvoiceLayout';

const STEPS = [
  'Select Party & Month',
  'Verify Dispatches',
  'Generate Invoice',
  'Review & Send'
];

const REVIEW_STEPS = ['Dispatch Summary', 'Invoice Summary', 'Download / Print'];

const money = (n) =>
  `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const monthValue = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const shortMonth = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
};

const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const parseMoney = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const StatusBadge = ({ kind, children }) => (
  <span className={`mb-badge mb-badge-${kind}`}>{children}</span>
);

const MonthlyBilling = () => {
  const { data, updateData, updateItem, ensureSerialAtLeast } = useAppContext();
  const { currentUser } = useAuth();
  const parties = (data.parties || []).filter((p) => !p.isDeleted);
  const mrs = data.materialReceipts || [];
  const invoices = data.invoices || [];
  const dcs = data.deliveryChallans || [];

  const [activeStep, setActiveStep] = useState(0);
  const [reviewStep, setReviewStep] = useState(1);
  const [partyId, setPartyId] = useState('');
  const [billingMonth, setBillingMonth] = useState(monthValue());
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterTab, setFilterTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showTax, setShowTax] = useState(true);
  const [taxRate, setTaxRate] = useState(18);
  const [gstType, setGstType] = useState(GST_TYPE_CGST_SGST);
  const [discount, setDiscount] = useState(0);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  const selectedParty = parties.find((p) => p.id === partyId) || null;
  const partyName = selectedParty?.name || '';
  const userName = currentUser?.name || currentUser?.username || 'Admin';
  const userRole = currentUser?.role || data?.settings?.userRole || 'Admin';
  const userInitials = String(userName).slice(0, 2).toUpperCase();

  const findMr = (dc) =>
    mrs.find((m) => !m.isDeleted && (
      m.id === dc.receiptId ||
      m.id === dc.mrId ||
      (dc.receiptNo && m.receiptNo === dc.receiptNo)
    )) || null;

  const resolveDcPartyId = (dc, mr) =>
    dc.partyId || mr?.partyId || parties.find((p) => p.name === (dc.partyName || mr?.partyName))?.id || '';

  const isDcInvoiced = (dc) => {
    if (dc.monthlyInvoiceId) {
      const inv = invoices.find((i) => i.id === dc.monthlyInvoiceId && !i.isDeleted);
      if (inv) return inv;
    }
    if (dc.receiptId) {
      const ti = findAnyTaxInvoice(invoices, dc.receiptId);
      if (ti) return ti;
    }
    const monthly = invoices.find((inv) =>
      !inv.isDeleted &&
      inv.monthlyBilling &&
      Array.isArray(inv.linkedDcIds) &&
      inv.linkedDcIds.includes(dc.id)
    );
    return monthly || null;
  };

  const resolveAmount = (dc, mr) => {
    const pi = mr ? findAnyProformaInvoice(invoices, mr.id) : null;
    if (pi) {
      const sub = parseMoney(pi.subtotal);
      const disc = parseMoney(pi.discount);
      const taxable = Math.max(0, sub - disc);
      if (taxable > 0) return { amount: taxable, source: 'pi', taxRate: pi.taxRate ?? 18, gstType: pi.gstType };
    }
    const dcVal = parseMoney(dc.value);
    if (dcVal > 0) return { amount: dcVal, source: 'dc' };
    const mrVal = getMRMaterialValue(mr);
    if (mrVal > 0) return { amount: mrVal, source: 'mr' };
    return { amount: 0, source: 'none' };
  };

  const mapDcToRow = (dc) => {
    const mr = findMr(dc);
    const linkedTi = isDcInvoiced(dc);
    const qty = parseMoney(dc.qty) || parseMoney(dc.totalQty) || parseMoney(mr?.totalQty) || 0;
    const { amount, source, taxRate: rowRate, gstType: rowGst } = resolveAmount(dc, mr);
    const productName = dc.productName || mr?.productName || '—';
    const processDone = Boolean(dc.date) && qty > 0;
    let billingStatus = 'Billable';
    if (linkedTi) billingStatus = 'Not Billable';
    else if (!qty || amount <= 0 || productName === '—') billingStatus = 'Missing';

    return {
      id: dc.id,
      receiptId: dc.receiptId || mr?.id || '',
      partyId: resolveDcPartyId(dc, mr),
      partyName: dc.partyName || mr?.partyName || '',
      dcNo: dc.dcNo || '—',
      partyDocNo: dc.partyDocNo || mr?.partyDocNo || '',
      date: dc.date || '',
      productName,
      qty,
      amount,
      amountSource: source,
      taxRate: rowRate,
      gstType: rowGst,
      processStatus: processDone ? 'Completed' : 'In Process',
      billingStatus,
      invoiceStatus: linkedTi ? 'Invoiced' : 'Not Invoiced',
      invoiceNo: linkedTi?.invoiceNo || '',
      raw: dc
    };
  };

  const loadData = () => {
    if (!partyId) {
      alert('Please select a party first.');
      return;
    }
    if (!billingMonth) {
      alert('Please select a billing month.');
      return;
    }

    const [y, m] = billingMonth.split('-').map(Number);
    const party = parties.find((p) => p.id === partyId);
    if (!party) {
      alert('Selected party was not found.');
      return;
    }

    const next = dcs
      .filter((dc) => !dc.isDeleted)
      .filter((dc) => {
        const mr = findMr(dc);
        const pid = resolveDcPartyId(dc, mr);
        const name = dc.partyName || mr?.partyName || '';
        return pid === partyId || name === party.name;
      })
      .filter((dc) => {
        if (!dc.date) return false;
        const d = new Date(`${dc.date}T00:00:00`);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      })
      .map(mapDcToRow)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    setRows(next);
    setSelectedIds(next.filter((r) => r.billingStatus === 'Billable').map((r) => r.id));
    setLoaded(true);
    setGeneratedInvoice(null);
    setActiveStep(1);
    setFilterTab('all');
    setSearch('');

    const firstPi = next.find((r) => r.amountSource === 'pi');
    if (firstPi?.taxRate != null) setTaxRate(parseInt(firstPi.taxRate, 10) || 18);
    if (firstPi?.gstType) setGstType(normalizeGstType(firstPi.gstType));
  };

  const counts = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.processStatus === 'Completed').length;
    const missing = rows.filter((r) => r.billingStatus === 'Missing').length;
    const ready = rows.filter((r) => r.billingStatus === 'Billable').length;
    const notBillable = rows.filter((r) => r.billingStatus === 'Not Billable').length;
    return { total, completed, missing, ready, notBillable };
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterTab === 'ready') list = list.filter((r) => r.billingStatus === 'Billable');
    if (filterTab === 'missing') list = list.filter((r) => r.billingStatus === 'Missing');
    if (filterTab === 'not') list = list.filter((r) => r.billingStatus === 'Not Billable');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        [r.dcNo, r.productName, r.partyDocNo, r.invoiceNo]
          .some((v) => String(v || '').toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, filterTab, search]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(r.id) && r.billingStatus === 'Billable'),
    [rows, selectedIds]
  );
  const selectedPreview = selectedRows.slice(0, 5);
  const moreSelected = Math.max(0, selectedRows.length - selectedPreview.length);

  const totals = useMemo(() => {
    const qty = selectedRows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
    const subtotal = selectedRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const taxable = Math.max(0, subtotal - (parseFloat(discount) || 0));
    const split = splitTaxableGstAmount(taxable, taxRate, gstType);
    return {
      qty,
      subtotal,
      taxable,
      ...split,
      grand: taxable + split.taxAmount
    };
  }, [selectedRows, discount, taxRate, gstType]);

  const toggleOne = (id) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.billingStatus !== 'Billable') return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const ids = filteredRows.filter((r) => r.billingStatus === 'Billable').map((r) => r.id);
    const allOn = ids.length && ids.every((id) => selectedIds.includes(id));
    if (allOn) setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    else setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const dateRange = useMemo(() => {
    if (!selectedRows.length) return '—';
    const dates = selectedRows.map((r) => r.date).filter(Boolean).sort();
    if (!dates.length) return '—';
    const a = formatDate(dates[0]);
    const b = formatDate(dates[dates.length - 1]);
    return a === b ? a : `${a} – ${b}`;
  }, [selectedRows]);

  const viewDc = (row) => {
    const dc = dcs.find((d) => d.id === row.id) || row.raw;
    if (!dc) {
      alert('Delivery challan not found.');
      return;
    }
    viewPDF('DC', dc);
  };

  const generateInvoice = () => {
    if (!selectedParty) {
      alert('Select a party and load data first.');
      return;
    }
    if (!selectedRows.length) {
      alert('Select at least one billable dispatch.');
      return;
    }

    const invoiceDate = new Date().toISOString().split('T')[0];
    const tiPool = invoices.filter((inv) =>
      !inv.isDeleted && (inv.type === 'Tax Invoice' || inv.invoiceNo?.includes('/IN/'))
    );
    const { docNo, nextSerial } = nextAvailableDocNumber(
      'IN',
      data.settings?.serials?.TI || 1,
      invoiceDate,
      tiPool
    );

    const customCharges = selectedRows.map((r, idx) => ({
      id: `mb-${r.id}-${idx}`,
      description: `${r.productName} (${r.dcNo})`,
      note: r.partyDocNo || '',
      qty: r.qty,
      rate: r.qty > 0 ? +(r.amount / r.qty).toFixed(2) : r.amount,
      amount: r.amount
    }));

    const first = selectedRows[0];
    const finalDoc = {
      id: Date.now().toString(),
      invoiceNo: docNo,
      date: invoiceDate,
      type: 'Tax Invoice',
      monthlyBilling: true,
      billingMonth,
      billingMonthLabel: monthLabel(billingMonth),
      partyId: selectedParty.id,
      partyName: selectedParty.name,
      billAddress: selectedParty.billAddress || '',
      shipAddress: selectedParty.shipAddress || selectedParty.billAddress || '',
      gstinBill: selectedParty.gstinBill || selectedParty.gstin || '',
      gstinShip: selectedParty.gstinShip || selectedParty.gstinBill || '',
      receiptId: first.receiptId || '',
      linkedDcIds: selectedRows.map((r) => r.id),
      linkedReceiptIds: [...new Set(selectedRows.map((r) => r.receiptId).filter(Boolean))],
      dcNo: selectedRows.map((r) => r.dcNo).join(', '),
      productName: selectedRows.map((r) => r.productName).filter(Boolean).join(', '),
      qty: totals.qty,
      customCharges,
      discount: parseFloat(discount) || 0,
      taxRate,
      gstType: normalizeGstType(gstType),
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.grand,
      terms: `Monthly consolidated invoice for ${monthLabel(billingMonth)}.`
    };

    updateData('invoices', finalDoc);
    ensureSerialAtLeast('TI', nextSerial);

    selectedRows.forEach((r) => {
      const dc = dcs.find((d) => d.id === r.id);
      if (!dc) return;
      updateItem('deliveryChallans', r.id, {
        ...dc,
        monthlyInvoiceId: finalDoc.id,
        monthlyInvoiceNo: finalDoc.invoiceNo
      });
    });

    setGeneratedInvoice(finalDoc);
    setActiveStep(3);
    setReviewStep(1);

    // Refresh row invoice status in-place
    setRows((prev) => prev.map((r) => (
      selectedIds.includes(r.id)
        ? {
          ...r,
          billingStatus: 'Not Billable',
          invoiceStatus: 'Invoiced',
          invoiceNo: finalDoc.invoiceNo
        }
        : r
    )));
    setSelectedIds([]);
  };

  const downloadExcel = () => {
    const sourceRows = generatedInvoice
      ? rows.filter((r) => (generatedInvoice.linkedDcIds || []).includes(r.id))
      : selectedRows;
    if (!sourceRows.length) {
      alert('Nothing to export. Select dispatches or generate an invoice first.');
      return;
    }

    const inv = generatedInvoice;
    const taxable = inv
      ? Math.max(0, (inv.subtotal || 0) - (inv.discount || 0))
      : totals.taxable;
    const split = inv
      ? splitTaxableGstAmount(taxable, inv.taxRate, inv.gstType)
      : { cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst, taxAmount: totals.taxAmount };
    const rate = inv?.taxRate ?? taxRate;
    const type = normalizeGstType(inv?.gstType || gstType);

    const detail = sourceRows.map((r, i) => {
      const lineTax = (r.amount || 0) * (rate / 100);
      return {
        'Sr No': i + 1,
        'DC No': r.dcNo,
        'Party Doc No': r.partyDocNo || '',
        Date: formatDate(r.date),
        Product: r.productName,
        'Qty (Kg)': r.qty,
        Amount: r.amount,
        ...(type === GST_TYPE_IGST
          ? { 'IGST %': rate, IGST: lineTax }
          : { 'CGST %': rate / 2, CGST: lineTax / 2, 'SGST %': rate / 2, SGST: lineTax / 2 }),
        Total: r.amount + lineTax
      };
    });

    const summary = [{
      Party: partyName || inv?.partyName || '',
      'Billing Month': monthLabel(billingMonth),
      'Invoice No': inv?.invoiceNo || '',
      'Invoice Date': inv?.date ? formatDate(inv.date) : '',
      'Total Qty': inv?.qty ?? totals.qty,
      Subtotal: inv?.subtotal ?? totals.subtotal,
      Discount: inv?.discount ?? discount,
      Taxable: taxable,
      ...(type === GST_TYPE_IGST
        ? { IGST: split.igst }
        : { CGST: split.cgst, SGST: split.sgst }),
      'Grand Total': inv?.total ?? totals.grand
    }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Dispatches');
    const fileStub = (inv?.invoiceNo || `Monthly_${billingMonth}`).replace(/\//g, '-');
    XLSX.writeFile(wb, `${fileStub}.xlsx`);
    setActiveStep(3);
    setReviewStep(2);
  };

  const printInvoice = () => {
    if (!generatedInvoice && !selectedRows.length) {
      alert('Generate an invoice first, or select billable dispatches.');
      return;
    }
    setReviewStep(2);
    setTimeout(() => window.print(), 50);
  };

  const displayInvoiceNo = generatedInvoice?.invoiceNo || '—';
  const displayInvoiceDate = generatedInvoice?.date
    ? formatDate(generatedInvoice.date)
    : formatDate(new Date().toISOString().slice(0, 10));

  const invoiceLines = generatedInvoice
    ? rows.filter((r) => (generatedInvoice.linkedDcIds || []).includes(r.id))
    : selectedRows;

  const invoiceTotals = generatedInvoice
    ? (() => {
      const taxable = Math.max(0, (generatedInvoice.subtotal || 0) - (generatedInvoice.discount || 0));
      const split = splitTaxableGstAmount(taxable, generatedInvoice.taxRate, generatedInvoice.gstType);
      return {
        qty: generatedInvoice.qty || 0,
        subtotal: generatedInvoice.subtotal || 0,
        taxable,
        ...split,
        grand: generatedInvoice.total || taxable + split.taxAmount,
        taxRate: generatedInvoice.taxRate || 18,
        gstType: normalizeGstType(generatedInvoice.gstType)
      };
    })()
    : { ...totals, taxRate, gstType: normalizeGstType(gstType) };

  return (
    <div className="mb-page">
      <div className="mb-topbar no-print">
        <div>
          <h1 className="mb-title">Monthly Billing</h1>
          <p className="mb-subtitle">
            Create one consolidated invoice for the selected dispatches. Verify, review and download.
          </p>
        </div>
        <div className="mb-top-tools">
          <div className="mb-chip">
            <Calendar size={14} />
            <span>{shortMonth(billingMonth)}</span>
          </div>
          {generatedInvoice?.invoiceNo ? (
            <div className="mb-chip mb-chip-code">Invoice: {generatedInvoice.invoiceNo}</div>
          ) : (
            <div className="mb-chip mb-chip-code">Month: {monthLabel(billingMonth)}</div>
          )}
          <button type="button" className="mb-icon-btn" aria-label="Notifications">
            <Bell size={16} />
          </button>
          <div className="mb-user">
            <div className="mb-avatar">{userInitials}</div>
            <div>
              <div className="mb-user-name">{userName}</div>
              <div className="mb-user-role">{userRole}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-stepper no-print">
        {STEPS.map((label, idx) => (
          <button
            key={label}
            type="button"
            className={`mb-step ${idx === activeStep ? 'active' : ''} ${idx < activeStep ? 'done' : ''}`}
            onClick={() => {
              if (idx === 0 || (idx === 1 && loaded) || (idx >= 2 && generatedInvoice)) {
                setActiveStep(idx);
              }
            }}
          >
            <span className="mb-step-num">{idx + 1}</span>
            <span className="mb-step-label">{label}</span>
            {idx < STEPS.length - 1 && <span className="mb-step-line" />}
          </button>
        ))}
      </div>

      <div className="mb-layout no-print">
        <div className="mb-main">
          <section className="mb-card">
            <div className="mb-card-head">
              <h2>1. Select Party &amp; Month</h2>
            </div>
            <div className="mb-select-row">
              <div className="mb-field">
                <label>Party Name</label>
                <SearchableSelect
                  className="input-field"
                  value={partyId}
                  onChange={(e) => {
                    setPartyId(e.target.value);
                    setLoaded(false);
                    setRows([]);
                    setSelectedIds([]);
                    setGeneratedInvoice(null);
                    setActiveStep(0);
                  }}
                  placeholder="Select party"
                  required
                >
                  <option value="">Select party</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </SearchableSelect>
              </div>
              <div className="mb-field">
                <label>Billing Month</label>
                <input
                  type="month"
                  className="input-field"
                  value={billingMonth}
                  onChange={(e) => {
                    setBillingMonth(e.target.value);
                    setLoaded(false);
                    setGeneratedInvoice(null);
                    setActiveStep(0);
                  }}
                />
              </div>
              <button type="button" className="btn btn-primary mb-load-btn" onClick={loadData}>
                <Search size={16} /> Load Data
              </button>
            </div>

            <div className="mb-kpi-grid">
              <div className="mb-kpi">
                <div className="mb-kpi-icon purple"><Truck size={18} /></div>
                <div>
                  <div className="mb-kpi-label">Total Dispatches</div>
                  <div className="mb-kpi-value">{loaded ? counts.total : 0}</div>
                </div>
              </div>
              <div className="mb-kpi">
                <div className="mb-kpi-icon green"><CheckCircle2 size={18} /></div>
                <div>
                  <div className="mb-kpi-label">Completed</div>
                  <div className="mb-kpi-value">{loaded ? counts.completed : 0}</div>
                </div>
              </div>
              <div className="mb-kpi">
                <div className="mb-kpi-icon orange"><AlertTriangle size={18} /></div>
                <div>
                  <div className="mb-kpi-label">Missing / Not Billable</div>
                  <div className="mb-kpi-value">{loaded ? counts.missing + counts.notBillable : 0}</div>
                </div>
              </div>
              <div className="mb-kpi">
                <div className="mb-kpi-icon blue"><FileText size={18} /></div>
                <div>
                  <div className="mb-kpi-label">Ready to Invoice</div>
                  <div className="mb-kpi-value">{loaded ? counts.ready : 0}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-card">
            <div className="mb-card-head mb-recon-head">
              <h2>2. Dispatch Reconciliation</h2>
              <div className="mb-recon-tools">
                <div className="mb-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search by DC No..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <label className="mb-check">
                  <input
                    type="checkbox"
                    checked={
                      filteredRows.some((r) => r.billingStatus === 'Billable') &&
                      filteredRows
                        .filter((r) => r.billingStatus === 'Billable')
                        .every((r) => selectedIds.includes(r.id))
                    }
                    onChange={toggleAll}
                    disabled={!loaded}
                  />
                  Select All
                </label>
              </div>
            </div>

            <div className="mb-tabs">
              {[
                ['all', `All (${counts.total})`],
                ['ready', `Ready (${counts.ready})`],
                ['missing', `Missing (${counts.missing})`],
                ['not', `Not Billable (${counts.notBillable})`]
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`mb-tab ${filterTab === key ? 'active' : ''}`}
                  onClick={() => setFilterTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-table-wrap">
              <table className="mb-table">
                <thead>
                  <tr>
                    <th />
                    <th>DC No.</th>
                    <th>Dispatch Date</th>
                    <th>Product</th>
                    <th>Qty (Kg)</th>
                    <th>Amount</th>
                    <th>Process Status</th>
                    <th>Billing Status</th>
                    <th>Invoice Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {!loaded ? (
                    <tr>
                      <td colSpan={10} className="mb-empty">
                        Select party &amp; month, then click Load Data.
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="mb-empty">
                        No delivery challans found for this party in {monthLabel(billingMonth)}.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            disabled={row.billingStatus !== 'Billable'}
                            onChange={() => toggleOne(row.id)}
                          />
                        </td>
                        <td className="mb-dc-cell">
                          <div className="mb-dc-main">{row.dcNo}</div>
                          {row.partyDocNo ? <div className="mb-dc-sub">{row.partyDocNo}</div> : null}
                        </td>
                        <td>{formatDate(row.date) || '—'}</td>
                        <td>{row.productName}</td>
                        <td>{Number(row.qty).toLocaleString('en-IN')}</td>
                        <td>{money(row.amount)}</td>
                        <td>
                          <StatusBadge kind={row.processStatus === 'Completed' ? 'green' : 'gray'}>
                            {row.processStatus}
                          </StatusBadge>
                        </td>
                        <td>
                          <span
                            className={
                              row.billingStatus === 'Billable'
                                ? 'mb-text-green'
                                : row.billingStatus === 'Missing'
                                  ? 'mb-text-orange'
                                  : 'mb-text-muted'
                            }
                          >
                            {row.billingStatus}
                          </span>
                        </td>
                        <td>
                          <StatusBadge kind={row.invoiceStatus === 'Invoiced' ? 'green' : 'blue'}>
                            {row.invoiceStatus === 'Invoiced' && row.invoiceNo
                              ? row.invoiceNo
                              : row.invoiceStatus}
                          </StatusBadge>
                        </td>
                        <td>
                          <button type="button" className="mb-view-btn" onClick={() => viewDc(row)}>
                            <Eye size={14} /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="mb-side">
          <section className="mb-card">
            <div className="mb-card-head mb-side-head">
              <h2>Selected Dispatches</h2>
              <button type="button" className="mb-link" onClick={() => setSelectedIds([])}>
                Clear Selection
              </button>
            </div>
            <div className="mb-side-table-wrap">
              <table className="mb-side-table">
                <thead>
                  <tr>
                    <th>DC No.</th>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedPreview.length ? (
                    <tr><td colSpan={5} className="mb-empty">No selection</td></tr>
                  ) : (
                    selectedPreview.map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.dcNo).replace(/^UMA\//, '')}</td>
                        <td>{formatDate(r.date)}</td>
                        <td>{r.productName}</td>
                        <td>{r.qty}</td>
                        <td>{money(r.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {moreSelected > 0 && (
              <div className="mb-more">+ {moreSelected} more selected dispatches</div>
            )}
          </section>

          <section className="mb-card mb-summary-card">
            <div className="mb-card-head"><h2>Summary (Tax Details)</h2></div>
            <div className="mb-summary-row">
              <span>Total Quantity</span>
              <strong>{totals.qty.toLocaleString('en-IN')} Kg</strong>
            </div>
            <div className="mb-summary-row">
              <span>Sub Total</span>
              <strong>{money(totals.subtotal)}</strong>
            </div>

            <button type="button" className="mb-tax-toggle" onClick={() => setShowTax((v) => !v)}>
              View Tax Summary {showTax ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showTax && (
              <div className="mb-tax-box">
                <GstTaxBlock
                  compact
                  taxable={totals.taxable}
                  taxRate={taxRate}
                  gstType={gstType}
                  discount={discount}
                  showDiscountInput
                  discountValue={discount}
                  onDiscountChange={setDiscount}
                  showSubtotal={false}
                  onTaxRateChange={setTaxRate}
                  onGstTypeChange={setGstType}
                />
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary mb-generate"
              onClick={generateInvoice}
              disabled={!selectedRows.length || Boolean(generatedInvoice)}
            >
              <FileText size={16} />
              {generatedInvoice ? 'Invoice Generated' : 'Generate Invoice'}
            </button>
            {generatedInvoice && (
              <button
                type="button"
                className="mb-link"
                style={{ marginTop: '0.65rem', width: '100%', textAlign: 'center' }}
                onClick={() => {
                  setGeneratedInvoice(null);
                  loadData();
                }}
              >
                Start another billing run
              </button>
            )}
          </section>
        </aside>
      </div>

      {(generatedInvoice || selectedRows.length > 0) && (
        <section className="mb-card mb-invoice-block mb-print-root">
          <div className="mb-invoice-layout">
            <nav className="mb-review-nav no-print">
              {REVIEW_STEPS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  className={`mb-review-step ${reviewStep === idx ? 'active' : ''}`}
                  onClick={() => setReviewStep(idx)}
                >
                  <span className="mb-review-dot">{idx + 1}</span>
                  {label}
                </button>
              ))}
            </nav>

            <div className="mb-invoice-body">
              <div className="mb-invoice-head">
                <div>
                  <h2>Invoice Summary</h2>
                  <StatusBadge kind="purple">
                    {invoiceLines.length} Dispatches Included
                  </StatusBadge>
                </div>
                <div className="mb-invoice-meta">
                  <div><span>Invoice No.</span><strong>{displayInvoiceNo}</strong></div>
                  <div><span>Date</span><strong>{displayInvoiceDate}</strong></div>
                  <div><span>Month</span><strong>{monthLabel(billingMonth)}</strong></div>
                </div>
              </div>

              {(reviewStep === 0 || reviewStep === 1 || reviewStep === 2) && (
                <>
                  <h3 className="mb-section-title">Party Wise Summary</h3>
                  <div className="mb-table-wrap">
                    <table className="mb-table">
                      <thead>
                        <tr>
                          <th>Party Name</th>
                          <th>DC Date Range</th>
                          <th>Total Qty</th>
                          <th>Amount</th>
                          {invoiceTotals.gstType === GST_TYPE_IGST ? (
                            <th>IGST</th>
                          ) : (
                            <>
                              <th>CGST</th>
                              <th>SGST</th>
                            </>
                          )}
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{partyName || generatedInvoice?.partyName || '—'}</td>
                          <td>{dateRange}</td>
                          <td>{Number(invoiceTotals.qty).toLocaleString('en-IN')} Kg</td>
                          <td>{money(invoiceTotals.taxable)}</td>
                          {invoiceTotals.gstType === GST_TYPE_IGST ? (
                            <td>{money(invoiceTotals.igst)}</td>
                          ) : (
                            <>
                              <td>{money(invoiceTotals.cgst)}</td>
                              <td>{money(invoiceTotals.sgst)}</td>
                            </>
                          )}
                          <td><strong>{money(invoiceTotals.grand)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="mb-section-title">Detailed Invoice Data</h3>
                  <div className="mb-table-wrap">
                    <table className="mb-table mb-detail-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>DC No / Ref</th>
                          <th>Date</th>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Amount</th>
                          {invoiceTotals.gstType === GST_TYPE_IGST ? (
                            <th>IGST %</th>
                          ) : (
                            <>
                              <th>CGST %</th>
                              <th>SGST %</th>
                            </>
                          )}
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceLines.map((r, i) => {
                          const rate = r.qty ? r.amount / r.qty : r.amount;
                          const lineTax = r.amount * (invoiceTotals.taxRate / 100);
                          return (
                            <tr key={r.id}>
                              <td>{i + 1}</td>
                              <td className="mb-dc-cell">
                                <div className="mb-dc-main">{r.dcNo}</div>
                                {r.partyDocNo ? <div className="mb-dc-sub">{r.partyDocNo}</div> : null}
                              </td>
                              <td>{formatDate(r.date)}</td>
                              <td>{r.productName}</td>
                              <td>{r.qty}</td>
                              <td>{money(rate)}</td>
                              <td>{money(r.amount)}</td>
                              {invoiceTotals.gstType === GST_TYPE_IGST ? (
                                <td>{invoiceTotals.taxRate}%</td>
                              ) : (
                                <>
                                  <td>{invoiceTotals.taxRate / 2}%</td>
                                  <td>{invoiceTotals.taxRate / 2}%</td>
                                </>
                              )}
                              <td>{money(r.amount + lineTax)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="mb-invoice-actions no-print">
                <button
                  type="button"
                  className="btn mb-back-btn"
                  onClick={() => {
                    setActiveStep(1);
                    setReviewStep(0);
                  }}
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <div className="mb-invoice-actions-right">
                  <button type="button" className="btn btn-primary" onClick={downloadExcel}>
                    <Download size={14} /> Download Excel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={printInvoice}>
                    <Printer size={14} /> Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default MonthlyBilling;
