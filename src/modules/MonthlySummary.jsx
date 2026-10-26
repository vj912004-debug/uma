import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import {
  buildMonthlySummaryStatement,
  downloadMonthlySummaryPdf,
  summaryDateText
} from '../utils/monthlySummaryPdf';
import { formatGstPercent } from '../utils/taxInvoiceLayout';

const monthValue = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const todayValue = () => new Date().toISOString().slice(0, 10);

const showQty = (value) => (value === '' || value == null ? '' : Number(value).toFixed(2));
const showRate = (value) => (value === '' || value == null ? '' : Number(value).toFixed(2));
const showPercent = (value) => (value === '' || value == null ? '' : formatGstPercent(value));

const MonthlySummary = () => {
  const { data } = useAppContext();
  const [companyValue, setCompanyValue] = useState('');
  const [month, setMonth] = useState(monthValue());
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
  const ready = Boolean(companyName && month);

  const statement = useMemo(() => {
    if (!ready) return null;
    return buildMonthlySummaryStatement({
      data,
      companyId,
      companyName,
      month,
      refNo,
      invoiceNo,
      summaryDate
    });
  }, [ready, data, companyId, companyName, month, refNo, invoiceNo, summaryDate]);

  useEffect(() => {
    setInvoiceNo('');
  }, [companyValue, month]);

  useEffect(() => {
    if (!statement?.suggestedInvoiceNo) return;
    setInvoiceNo((current) => current || statement.suggestedInvoiceNo);
  }, [statement?.suggestedInvoiceNo, companyValue, month]);

  const downloadPdf = () => {
    if (!statement) {
      alert('Select a company and a month first.');
      return;
    }
    downloadMonthlySummaryPdf(statement);
  };

  const taxLeft = statement?.igst ? 'IGST' : 'SGST';
  const taxRight = statement?.igst ? '' : 'CGST';

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Monthly Summary</h1>
          <p className="page-subtitle">Select a company and a month, then download that company’s summary as a PDF.</p>
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
            <label htmlFor="monthly-summary-month">Month</label>
            <input
              id="monthly-summary-month"
              type="month"
              className="input-field"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
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

      {!statement ? (
        <section className="premium-card" style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          Select a company to see and download the summary for the chosen month.
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
                      No delivery challans for {companyName} in this month.
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
