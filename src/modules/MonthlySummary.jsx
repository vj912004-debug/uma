import React, { useEffect, useMemo, useState } from 'react';
import { Download, List, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import DateField from '../components/DateField';
import DocCreationLogModal from '../components/DocCreationLogModal';
import {
  buildMonthlySummaryStatement,
  downloadMonthlySummaryPdf,
  summaryDateText
} from '../utils/monthlySummaryPdf';
import { formatGstPercent } from '../utils/taxInvoiceLayout';
import { formatDate, newestFirst } from '../utils/dateUtils';
import { actorDisplayName, formatCreatedAt } from '../utils/docCreator';

const defaultDoneBy = (user) => String(user?.name || user?.username || '').trim();

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const monthStart = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

const monthEnd = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const showQty = (value) => (value === '' || value == null ? '' : Number(value).toFixed(2));
const showRate = (value) => (value === '' || value == null ? '' : Number(value).toFixed(2));
const showPercent = (value) => (value === '' || value == null ? '' : formatGstPercent(value));

const nextSummaryRefNo = (data) => {
  const serial = Math.max(1, parseInt(data?.settings?.serials?.MS, 10) || 1);
  const used = new Set(
    (data?.monthlySummaries || [])
      .filter((row) => !row.isDeleted)
      .map((row) => String(row.refNo || '').trim())
      .filter(Boolean)
  );
  let n = serial;
  while (used.has(String(n))) n += 1;
  return String(n);
};

const MonthlySummary = () => {
  const { data, updateData, deleteItemSoftly, ensureSerialAtLeast } = useAppContext();
  const { currentUser } = useAuth();
  const [companyValue, setCompanyValue] = useState('');
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const [refNo, setRefNo] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [summaryDate, setSummaryDate] = useState(todayValue());
  const [doneBy, setDoneBy] = useState(() => defaultDoneBy(currentUser) || actorDisplayName(data));
  const [showCreationLog, setShowCreationLog] = useState(false);

  const parties = useMemo(
    () => (data.parties || [])
      .filter((party) => party && !party.isDeleted && String(party.name || '').trim())
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })),
    [data.parties]
  );

  const selectedParty = parties.find((party) => String(party.id) === String(companyValue)) || null;
  const companyName = selectedParty?.name || String(companyValue || '').trim();
  const companyId = selectedParty?.id || '';
  const rangeReady = Boolean(dateFrom && dateTo && dateFrom <= dateTo);
  const ready = Boolean(companyName && rangeReady);

  const summaryLogs = useMemo(
    () => newestFirst((data.monthlySummaries || []).filter((row) => !row.isDeleted)),
    [data.monthlySummaries]
  );

  const statement = useMemo(() => {
    if (!ready) return null;
    return buildMonthlySummaryStatement({
      data,
      companyId,
      companyName,
      dateFrom,
      dateTo,
      refNo,
      invoiceNo,
      summaryDate
    });
  }, [ready, data, companyId, companyName, dateFrom, dateTo, refNo, invoiceNo, summaryDate]);

  useEffect(() => {
    setInvoiceNo('');
    setRefNo('');
    setDoneBy(defaultDoneBy(currentUser) || actorDisplayName(data));
  }, [companyValue, dateFrom, dateTo, currentUser, data.currentUser]);

  useEffect(() => {
    if (!statement?.suggestedInvoiceNo) return;
    setInvoiceNo((current) => current || statement.suggestedInvoiceNo);
  }, [statement?.suggestedInvoiceNo, companyValue, dateFrom, dateTo]);

  // When invoice number is filled/suggested, also generate Ref No. with it.
  useEffect(() => {
    if (!ready) return;
    setRefNo((current) => current || nextSummaryRefNo(data));
  }, [ready, companyValue, dateFrom, dateTo, invoiceNo, data.settings?.serials?.MS, data.monthlySummaries]);

  const downloadPdf = () => {
    if (!dateFrom || !dateTo) {
      alert('Select a From date and a To date.');
      return;
    }
    if (dateFrom > dateTo) {
      alert('From date must be on or before the To date.');
      return;
    }
    if (!statement) {
      alert('Select a company and a date range first.');
      return;
    }

    const who = String(doneBy || defaultDoneBy(currentUser) || actorDisplayName(data)).trim();
    const finalRef = String(refNo || nextSummaryRefNo(data)).trim();
    const finalInvoice = String(invoiceNo || statement.suggestedInvoiceNo || '').trim();
    const finalStatement = buildMonthlySummaryStatement({
      data,
      companyId,
      companyName,
      dateFrom,
      dateTo,
      refNo: finalRef,
      invoiceNo: finalInvoice,
      summaryDate
    });

    downloadMonthlySummaryPdf(finalStatement);

    updateData('monthlySummaries', {
      id: Date.now().toString(),
      refNo: finalRef,
      invoiceNo: finalInvoice,
      date: summaryDate,
      dateFrom,
      dateTo,
      partyId: companyId,
      partyName: companyName,
      title: finalStatement.title,
      fileName: finalStatement.fileName,
      amount: finalStatement.totals?.amount || 0,
      total: finalStatement.totals?.total || 0,
      doneBy: who,
      createdBy: who
    });

    const usedSerial = parseInt(finalRef, 10);
    if (Number.isFinite(usedSerial) && usedSerial > 0) {
      ensureSerialAtLeast('MS', usedSerial + 1);
    }

    setRefNo(finalRef);
    setInvoiceNo(finalInvoice);
    setDoneBy(who);
    // Show the new entry in history right after generate/download.
    setShowCreationLog(true);
  };

  const reloadHistoryRow = (row) => {
    setCompanyValue(row.partyId || row.partyName || '');
    setDateFrom(row.dateFrom || monthStart());
    setDateTo(row.dateTo || monthEnd());
    setRefNo(String(row.refNo || ''));
    setInvoiceNo(String(row.invoiceNo || ''));
    setSummaryDate(row.date || todayValue());
    setDoneBy(String(row.doneBy || row.createdBy || ''));
    setShowCreationLog(false);
  };

  const deleteHistoryRow = (row) => {
    if (window.confirm('Delete this monthly summary from history?')) {
      deleteItemSoftly('monthlySummaries', row.id);
    }
  };

  const taxLeft = statement?.igst ? 'IGST' : 'SGST';
  const taxRight = statement?.igst ? '' : 'CGST';
  const periodLabel = `${summaryDateText(dateFrom, '/')} to ${summaryDateText(dateTo, '/')}`;

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Monthly Summary</h1>
          <p className="page-subtitle">Select a company and a date range, then download that company’s summary as a PDF.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreationLog(true)}>
            <List size={16} /> Monthly Summary Log ({summaryLogs.length})
          </button>
          <button type="button" className="btn btn-primary" onClick={downloadPdf} disabled={!ready} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={16} /> Download PDF
          </button>
        </div>
      </header>

      <DocCreationLogModal
        open={showCreationLog}
        onClose={() => setShowCreationLog(false)}
        title="Monthly Summary Log"
        rows={summaryLogs}
        auditLogs={data.auditLogs}
        module="monthlySummaries"
        searchPlaceholder="Search by ref no, invoice no, company, or done by..."
        getSearchText={(row) => `${row.refNo || ''} ${row.invoiceNo || ''} ${row.partyName || ''} ${row.title || ''}`}
        onEdit={reloadHistoryRow}
        onDelete={deleteHistoryRow}
        columns={[
          { key: 'refNo', label: 'Ref No.' },
          { key: 'invoiceNo', label: 'Invoice No.' },
          { key: 'date', label: 'Summary Date', render: (r) => formatDate(r.date) },
          { key: 'partyName', label: 'Company' },
          {
            key: 'period',
            label: 'Period',
            render: (r) => `${formatDate(r.dateFrom)} – ${formatDate(r.dateTo)}`
          },
          {
            key: 'total',
            label: 'Total (₹)',
            render: (r) => Number(r.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
          }
        ]}
      />

      <section className="premium-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Company</label>
            <SearchableSelect
              value={companyValue}
              onChange={(e) => setCompanyValue(e.target.value)}
              allowCustom
              remember={false}
              placeholder="Select company"
            >
              <option value="">Select company</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>{party.name}</option>
              ))}
            </SearchableSelect>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="monthly-summary-from">From</label>
            <DateField
              id="monthly-summary-from"
              className="input-field"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="monthly-summary-to">To</label>
            <DateField
              id="monthly-summary-to"
              className="input-field"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="monthly-summary-ref">Ref No.</label>
            <input
              id="monthly-summary-ref"
              className="input-field"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder="Auto when ready"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="monthly-summary-invoice">Invoice No.</label>
            <input
              id="monthly-summary-invoice"
              className="input-field"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. 267"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="monthly-summary-date">Summary Date</label>
            <input
              id="monthly-summary-date"
              type="date"
              className="input-field"
              value={summaryDate}
              onChange={(e) => setSummaryDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="monthly-summary-doneby">Done By</label>
            <input
              id="monthly-summary-doneby"
              className="input-field"
              value={doneBy}
              onChange={(e) => setDoneBy(e.target.value)}
              placeholder="Who generated this summary"
            />
          </div>
        </div>
      </section>

      {!companyName ? (
        <section className="premium-card" style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          Select a company to see and download the summary for the chosen dates.
        </section>
      ) : !rangeReady ? (
        <section className="premium-card" style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          From date must be on or before the To date.
        </section>
      ) : (
        <section className="premium-card" style={{ marginTop: '1rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1rem', fontWeight: 750 }}>
            {statement.title}
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ minWidth: 1100, fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th rowSpan={2}>Sr.N</th>
                  <th rowSpan={2}>Delivery Challan No.</th>
                  <th rowSpan={2}>D.C. Date</th>
                  <th rowSpan={2}>PO. No/Challan No.</th>
                  <th rowSpan={2}>PO Date</th>
                  <th rowSpan={2}>Description</th>
                  <th rowSpan={2}>Qty</th>
                  <th rowSpan={2}>Rate</th>
                  <th rowSpan={2}>Amount</th>
                  <th colSpan={2}>{taxLeft}</th>
                  <th colSpan={2}>{taxRight || ' '}</th>
                  <th rowSpan={2}>Total</th>
                </tr>
                <tr>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)' }}>
                      No delivery challans for {companyName} from {periodLabel}.
                    </td>
                  </tr>
                ) : statement.rows.map((row, idx) => (
                  <tr key={`${row.dcNo || 'row'}-${idx}`}>
                    <td>{row.sr || ''}</td>
                    <td>{row.dcNo || ''}</td>
                    <td>{row.dcDate || ''}</td>
                    <td>{row.poNo || ''}</td>
                    <td>{row.poDate || ''}</td>
                    <td style={{ whiteSpace: 'pre-line' }}>{row.description || ''}</td>
                    <td style={{ textAlign: 'right' }}>{showQty(row.qty)}</td>
                    <td style={{ textAlign: 'right' }}>{showRate(row.rate)}</td>
                    <td style={{ textAlign: 'right' }}>{showRate(row.amount)}</td>
                    <td style={{ textAlign: 'center' }}>{showPercent(row.leftRate)}</td>
                    <td style={{ textAlign: 'right' }}>{showRate(row.leftAmt)}</td>
                    <td style={{ textAlign: 'center' }}>{showPercent(row.rightRate)}</td>
                    <td style={{ textAlign: 'right' }}>{showRate(row.rightAmt)}</td>
                    <td style={{ textAlign: 'right' }}>{showRate(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              {statement.rows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={8} />
                    <td style={{ textAlign: 'right', fontWeight: 750 }}>{showRate(statement.totals.amount)}</td>
                    <td />
                    <td style={{ textAlign: 'right', fontWeight: 750 }}>{showRate(statement.totals.leftAmt)}</td>
                    <td />
                    <td style={{ textAlign: 'right', fontWeight: 750 }}>{showRate(statement.totals.rightAmt)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 750 }}>{showRate(statement.totals.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p style={{ margin: 0, padding: '0.65rem 1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Summary date {summaryDateText(summaryDate, '/') || '—'}. Ref No. and Invoice No. generate together; each download is saved in Summary History below.
          </p>
        </section>
      )}

      <section className="premium-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Summary History</h3>
          <button type="button" className="btn" onClick={() => setShowCreationLog(true)}>
            <List size={14} /> Open full log ({summaryLogs.length})
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Sr.</th>
                <th style={{ padding: '0.75rem' }}>Ref No.</th>
                <th style={{ padding: '0.75rem' }}>Invoice No.</th>
                <th style={{ padding: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.75rem' }}>Company</th>
                <th style={{ padding: '0.75rem' }}>Period</th>
                <th style={{ padding: '0.75rem' }}>Total (₹)</th>
                <th style={{ padding: '0.75rem' }}>Done By</th>
                <th style={{ padding: '0.75rem' }}>Created At</th>
                <th style={{ padding: '0.75rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {summaryLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No monthly summaries generated yet. Download a PDF to add it here.
                  </td>
                </tr>
              ) : summaryLogs.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}>{idx + 1}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{row.refNo || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{row.invoiceNo || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{formatDate(row.date)}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{row.partyName || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{formatDate(row.dateFrom)} – {formatDate(row.dateTo)}</td>
                  <td style={{ padding: '0.75rem' }}>{Number(row.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: '0.75rem' }}>{row.doneBy || row.createdBy || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{formatCreatedAt(row.createdAt || row.date)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => reloadHistoryRow(row)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => deleteHistoryRow(row)}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.7)', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MonthlySummary;
