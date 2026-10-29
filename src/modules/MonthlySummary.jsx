import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import DateField from '../components/DateField';
import {
  buildMonthlySummaryStatement,
  downloadMonthlySummaryPdf,
  summaryDateText
} from '../utils/monthlySummaryPdf';
import { formatGstPercent } from '../utils/taxInvoiceLayout';

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

const MonthlySummary = () => {
  const { data } = useAppContext();
  const [companyValue, setCompanyValue] = useState('');
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const [refNo, setRefNo] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [summaryDate, setSummaryDate] = useState(todayValue());

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
  }, [companyValue, dateFrom, dateTo]);

  useEffect(() => {
    if (!statement?.suggestedInvoiceNo) return;
    setInvoiceNo((current) => current || statement.suggestedInvoiceNo);
  }, [statement?.suggestedInvoiceNo, companyValue, dateFrom, dateTo]);

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
    downloadMonthlySummaryPdf(statement);
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
        <button type="button" className="btn btn-primary" onClick={downloadPdf} disabled={!ready} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Download size={16} /> Download PDF
        </button>
      </header>

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
              placeholder="e.g. 16"
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
                ) : statement.rows.map((row, index) => (
                  <tr key={`${row.dcNo}-${index}`}>
                    <td>{row.sr}</td>
                    <td>{row.dcNo}</td>
                    <td>{row.dcDate}</td>
                    <td>{row.poNo}</td>
                    <td>{row.poDate}</td>
                    <td style={{ whiteSpace: 'pre-line' }}>{row.description}</td>
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
            Summary date {summaryDateText(summaryDate, '/') || '—'}. The PDF uses this same statement.
          </p>
        </section>
      )}
    </div>
  );
};

export default MonthlySummary;
