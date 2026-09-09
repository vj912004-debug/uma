import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, CreditCard } from 'lucide-react';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { getReceiptOutstanding, getPartyOutstandingByFY, collectPartyDueEntities } from '../utils/paymentTotals';
import { getCurrentFYKey, getFYKeysThroughCurrent } from '../utils/financialYear';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import DateField from '../components/DateField';

const PartyDue = () => {
  const { data, updateData, updateItem } = useAppContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const fyKeys = useMemo(() => getFYKeysThroughCurrent('21-22'), []);
  const currentFY = useMemo(() => getCurrentFYKey(), []);

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    partyId: '',
    receiptId: '',
    amount: '',
    tds: '',
    date: new Date().toISOString().split('T')[0],
    chequeNo: '',
    bankName: '',
    notes: 'Cheque received against outstanding dues.'
  });

  const selectedPartyReceipts = data.materialReceipts.filter(mr => 
    mr.partyId === paymentForm.partyId && 
    (data.invoices || []).some(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'))
  );

  const recordPayment = (e) => {
    e.preventDefault();
    if (!paymentForm.partyId || !paymentForm.receiptId || !paymentForm.amount) {
      alert("Please enter all required fields.");
      return;
    }

    const party = data.parties.find(p => p.id === paymentForm.partyId);

    const newPayment = {
      ...paymentForm,
      id: Date.now().toString(),
      amount: parseFloat(paymentForm.amount) || 0,
      tds: parseFloat(paymentForm.tds) || 0
    };

    updateData('payments', newPayment);

    if (party?.dueOverrides && Object.keys(party.dueOverrides).length > 0) {
      updateItem('parties', party.id, { ...party, dueOverrides: {} });
    }

    setIsModalOpen(false);
    setPaymentForm({
      partyId: '',
      receiptId: '',
      amount: '',
      tds: '',
      date: new Date().toISOString().split('T')[0],
      chequeNo: '',
      bankName: '',
      notes: 'Cheque received against outstanding dues.'
    });
  };

  // Outstanding = unpaid tax invoice totals (bill − received − TDS) per party
  const partyRows = collectPartyDueEntities(data).map((party) => {
    const invoiceDuesByFY = getPartyOutstandingByFY(data, party, fyKeys, currentFY);
    const finals = {};
    let totalDue = 0;
    fyKeys.forEach((fy) => {
      const amount = invoiceDuesByFY[fy] || 0;
      finals[fy] = amount;
      totalDue += amount;
    });

    return {
      id: party.id,
      name: party.name,
      ...finals,
      totalDue
    };
  });

  const partyOptions = useMemo(() => uniqueSortedOptions(partyRows.map((p) => p.name)), [partyRows]);
  const filteredDues = partyRows.filter(p => {
    if (partyFilter && (p.name || '') !== partyFilter) return false;
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(s);

    let matchesColumnFilters = true;
    for (const [key, filterVal] of Object.entries(columnFilters)) {
      if (filterVal) {
        const rowVal = String(p[key] || '').toLowerCase();
        if (!rowVal.includes(filterVal.toLowerCase())) {
          matchesColumnFilters = false;
          break;
        }
      }
    }

    return matchesSearch && matchesColumnFilters;
  });

  const tableCols = [
    { key: 'name', label: 'Party Name' },
    ...fyKeys.map((fy) => ({ key: fy, label: `Dues FY ${fy}` })),
    { key: 'totalDue', label: 'Total Outstanding Dues' }
  ];

  const renderAmount = (value, isTotal = false) => {
    const n = parseFloat(value || 0) || 0;
    return (
      <span style={{ fontWeight: isTotal ? 700 : (n > 0 ? 600 : 400) }}>
        ₹{n.toFixed(2)}
      </span>
    );
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Party Wise Outstanding</h1>
          <p style={{ color: 'var(--text-muted)' }}>These totals match the Processing Sheet outstanding for each party. Enter Total Recd / TDS / Outstanding on the sheet — this page updates automatically.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filteredDues} columns={tableCols} filename="Party_Outstanding_Dues" title="Party Wise Outstanding" />
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Record Cheque Payment
          </button>
        </div>
      </header>

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search customer outstanding ledger..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        partyAllLabel="All Parties"
        showProduct={false}
      />

      <div className="premium-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                {tableCols.map(col => (
                  <th key={col.key} style={{ padding: '1rem', textAlign: col.key === 'name' ? 'left' : 'right' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
              {/* Filter Row */}
              <tr style={{ background: 'var(--glass-bg)' }}>
                {tableCols.map(col => (
                  <th key={`filter-${col.key}`} style={{ padding: '0.2rem' }}>
                    <input 
                      type="text" 
                      placeholder={`Filter...`} 
                      value={columnFilters[col.key] || ''} 
                      onChange={e => setColumnFilters({...columnFilters, [col.key]: e.target.value})} 
                      style={{ width: '100%', fontSize: '0.75rem', padding: '0.2rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px' }} 
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={tableCols.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No outstanding party balances.</td>
                </tr>
              ) : (
                filteredDues.map(party => (
                  <tr key={party.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      <button 
                        onClick={() => navigate('/processing-sheet', { state: { partyName: party.name } })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        title={`View ${party.name} in Processing Sheet`}
                      >
                        {party.name}
                      </button>
                    </td>
                    {fyKeys.map((fy) => (
                      <td
                        key={fy}
                        style={{
                          padding: '0.5rem',
                          color: party[fy] > 0 ? '#ef4444' : 'var(--text-muted)',
                          fontWeight: party[fy] > 0 ? 600 : 400
                        }}
                      >
                        {renderAmount(party[fy])}
                      </td>
                    ))}
                    <td style={{ padding: '1rem', textAlign: 'right', color: party.totalDue > 0 ? '#ef4444' : 'var(--status-done-text)', fontWeight: 700, fontSize: '0.95rem' }}>
                      {renderAmount(party.totalDue, true)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: '600px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard style={{ color: 'var(--accent-primary)' }} />
              Record Cheque Payment Receipt
            </h2>
            <form onSubmit={recordPayment}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Select Party Customer *</label>
                  <SearchableSelect 
                    className="input-field" 
                    required 
                    value={paymentForm.partyId}
                    onChange={e => setPaymentForm({...paymentForm, partyId: e.target.value, receiptId: ''})}
                  >
                    <option value="">Choose Party</option>
                    {data.parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </SearchableSelect>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label>Select Invoiced Material Receipt *</label>
                  <SearchableSelect 
                    className="input-field" 
                    required 
                    disabled={!paymentForm.partyId}
                    value={paymentForm.receiptId}
                    onChange={e => setPaymentForm({...paymentForm, receiptId: e.target.value})}
                  >
                    <option value="">Choose Invoiced Batch</option>
                    {selectedPartyReceipts.map(mr => {
                      const ti = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'));
                      const due = getReceiptOutstanding(mr, ti, data.payments);
                      return (
                        <option key={mr.id} value={mr.id}>
                          {mr.receiptNo} - {mr.productName} ({formatDate(mr.date)}) - Balance Due: ₹{due.toFixed(2)}
                        </option>
                      );
                    })}
                  </SearchableSelect>
                </div>

                <div>
                  <label>Payment Date *</label>
                  <DateField className="input-field" required value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} />
                </div>
                <div>
                  <label>Cheque Amount Received (₹) *</label>
                  <input type="number" step="0.01" className="input-field" required placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
                </div>
                <div>
                  <label>TDS (₹)</label>
                  <input type="number" step="0.01" className="input-field" placeholder="0.00" value={paymentForm.tds} onChange={e => setPaymentForm({...paymentForm, tds: e.target.value})} />
                </div>

                <div>
                  <label>Cheque / DD Number</label>
                  <input type="text" className="input-field" placeholder="e.g. 091823" value={paymentForm.chequeNo} onChange={e => setPaymentForm({...paymentForm, chequeNo: e.target.value})} />
                </div>
                <div>
                  <label>Drawer Bank Name</label>
                  <input type="text" className="input-field" placeholder="e.g. HDFC Bank" value={paymentForm.bankName} onChange={e => setPaymentForm({...paymentForm, bankName: e.target.value})} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label>Reconciliation Notes</label>
                  <input type="text" className="input-field" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Reconcile Dues</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartyDue;
