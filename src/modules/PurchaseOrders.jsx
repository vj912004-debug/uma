import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Eye, Search, Edit2, Trash2, FileDown, ClipboardList, Plus } from 'lucide-react';
import { exportToPDF, viewPDF } from '../utils/pdfExport';
import ExportButton from '../components/ExportButton';
import { calcPoTotals } from '../utils/purchaseOrderHtml';

const DEFAULT_TERMS = [
  '1. Material should be supplied strictly as per above size, grade and specification.',
  '2. Test Certificate / MTC report wherever applicable.',
  '3. Material should be free from heavy rust, lamination, oil, paint and major surface defects.',
  '4. Final weight, rate and payment will be as per mutually agreed terms.',
  '5. Delivery schedule and transport details must be confirmed before dispatch.'
].join('\n');

const emptyItem = () => ({
  grade: '',
  thickness: '',
  width: '',
  length: '',
  nos: '',
  kg: '',
  rate: '',
  amount: ''
});

const defaultForm = () => ({
  poNo: '',
  date: new Date().toISOString().split('T')[0],
  partyName: '',
  address: '',
  gstin: '',
  mobile: '',
  email: '',
  paymentTerms: '',
  make: '',
  mtc: '',
  utLevel: '',
  inspection: '',
  deliveryLocation: '',
  vehicleNo: '',
  driverMobile: '',
  transportName: '',
  transportCharges: '',
  loadingCharges: '',
  note: '',
  remark: '',
  preparedBy: '',
  checkedBy: '',
  taxRate: 18,
  terms: DEFAULT_TERMS,
  items: [emptyItem(), emptyItem(), emptyItem(), emptyItem()]
});

const PurchaseOrders = () => {
  const { data, updateData, updateItem, deleteItemSoftly, incrementSerial } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedMR, setSelectedMR] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const activeMR = editingDoc ? data.materialReceipts.find(mr => mr.id === editingDoc.receiptId) : selectedMR;
  const party = data.parties.find(p => p.id === activeMR?.partyId);

  useEffect(() => {
    if (editingDoc) return;
    if (!selectedMR || !activeMR) return;

    const poSerial = data.settings?.serials?.PO || 1;
    const docNo = generateDocNumber('PO', poSerial, new Date(form.date));
    setForm(prev => ({
      ...prev,
      poNo: docNo,
      partyName: activeMR.partyName || '',
      address: activeMR.billAddress || party?.billAddress || '',
      gstin: activeMR.gstinBill || party?.gstinBill || '',
      mobile: party?.phone1 || '',
      email: party?.email1 || '',
      items: [{
        ...emptyItem(),
        grade: activeMR.productName || '',
        kg: activeMR.totalQty || '',
        amount: ''
      }, emptyItem(), emptyItem(), emptyItem()]
    }));
  }, [form.date, editingDoc, selectedMR, activeMR, party, data.settings?.serials?.PO]);

  const updateItemRow = (index, field, value) => {
    setForm(prev => {
      const items = [...(prev.items || [])];
      const row = { ...items[index], [field]: value };
      if (field === 'kg' || field === 'rate') {
        const kg = parseFloat(field === 'kg' ? value : row.kg) || 0;
        const rate = parseFloat(field === 'rate' ? value : row.rate) || 0;
        row.amount = kg && rate ? (kg * rate).toFixed(2) : '';
      }
      items[index] = row;
      return { ...prev, items };
    });
  };

  const addItemRow = () => {
    setForm(prev => ({ ...prev, items: [...(prev.items || []), emptyItem()] }));
  };

  const removeItemRow = (index) => {
    setForm(prev => {
      const items = (prev.items || []).filter((_, i) => i !== index);
      return { ...prev, items: items.length ? items : [emptyItem()] };
    });
  };

  const totals = calcPoTotals(form);

  const handleCreate = (mr) => {
    setSelectedMR(mr);
    setEditingDoc(null);
    setForm(defaultForm());
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedMR(null);
    setEditingDoc(null);
    const poSerial = data.settings?.serials?.PO || 1;
    const docNo = generateDocNumber('PO', poSerial, new Date());
    setForm({ ...defaultForm(), poNo: docNo });
    setIsModalOpen(true);
  };

  const handleEdit = (po) => {
    setEditingDoc(po);
    setSelectedMR(null);
    const items = Array.isArray(po.items) && po.items.length
      ? po.items.map((it) => ({ ...emptyItem(), ...it }))
      : [{
          ...emptyItem(),
          grade: po.productName || '',
          kg: po.qty || '',
          rate: po.rate || '',
          amount: po.subtotal || ''
        }, emptyItem(), emptyItem(), emptyItem()];
    setForm({ ...defaultForm(), ...po, items });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { totalNos, totalKg, basicAmount, gstAmount, grandTotal } = calcPoTotals(form);

    const finalDoc = {
      ...form,
      receiptId: activeMR?.id || editingDoc?.receiptId || '',
      qty: totalKg,
      subtotal: basicAmount,
      taxAmount: gstAmount,
      total: grandTotal,
      totalNos,
      type: 'Purchase Order'
    };

    if (editingDoc) {
      updateItem('purchaseOrders', editingDoc.id, finalDoc);
    } else {
      updateData('purchaseOrders', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PO');
    }
    setIsModalOpen(false);
  };

  const pendingMRs = data.materialReceipts.filter(mr =>
    !(data.purchaseOrders || []).some(po => po.receiptId === mr.id)
  );

  const poList = (data.purchaseOrders || []).filter(po => !po.isDeleted);
  const filtered = poList.filter(po =>
    (po.poNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (po.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportColumns = [
    { label: 'Date', key: 'date' },
    { label: 'PO Number', key: 'poNo' },
    { label: 'Party Name', key: 'partyName' },
    { label: 'Qty (Kg)', key: 'qty' },
    { label: 'Total (₹)', key: 'total' }
  ];

  const field = (key, label, opts = {}) => (
    <div style={opts.span ? { gridColumn: `span ${opts.span}` } : undefined}>
      <label>{label}</label>
      {opts.textarea ? (
        <textarea
          className="input-field"
          rows={opts.rows || 2}
          value={form[key] || ''}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          type={opts.type || 'text'}
          className="input-field"
          value={form[key] ?? ''}
          onChange={e => setForm({
            ...form,
            [key]: opts.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value) || 0) : e.target.value
          })}
          step={opts.step}
        />
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Purchase Orders (PO)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Jagdamba Profile purchase order format</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <ExportButton data={filtered} columns={exportColumns} filename="Purchase_Orders" title="Purchase Orders Log" />
          <button className="btn btn-primary" onClick={handleCreateNew} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> New PO
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        <div className="premium-card">
          <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} /> Pending Material Receipts
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a Material Receipt to generate a Purchase Order.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
            {pendingMRs.map(mr => (
              <button
                key={mr.id}
                type="button"
                onClick={() => handleCreate(mr)}
                style={{
                  textAlign: 'left',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--input-bg)',
                  cursor: 'pointer',
                  color: 'var(--text-main)'
                }}
              >
                <div style={{ fontWeight: 600 }}>{mr.partyName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {mr.productName || 'Material'} · {mr.totalQty || 0} Kg · {formatDate(mr.date)}
                </div>
              </button>
            ))}
            {pendingMRs.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No pending material receipts.</div>
            )}
          </div>
        </div>

        <div className="premium-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>Purchase Order Log</h3>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: '2rem' }}
                placeholder="Search PO / party..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>PO No</th>
                  <th>Party</th>
                  <th>Kg</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(po => (
                  <tr key={po.id}>
                    <td>{formatDate(po.date)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{po.poNo}</td>
                    <td>{po.partyName}</td>
                    <td>{po.qty || 0}</td>
                    <td>₹{(parseFloat(po.total) || 0).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button onClick={() => viewPDF('PO', po)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }} title="Preview">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => exportToPDF('PO', po)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }} title="Download">
                          <FileDown size={16} />
                        </button>
                        <button onClick={() => handleEdit(po)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }} title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteItemSoftly('purchaseOrders', po.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No Purchase Orders found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '980px', maxWidth: '96%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.25rem' }}>{editingDoc ? 'Modify Purchase Order' : 'Create Purchase Order'}</h2>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
                {field('poNo', 'PO Number')}
                <div>
                  <label>PO Date *</label>
                  <input type="date" className="input-field" required value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                {field('partyName', 'Party Name', { span: 2 })}
                {field('address', 'Address', { span: 2, textarea: true })}
                {field('gstin', 'GST Number')}
                {field('mobile', 'Mobile Number')}
                {field('email', 'Email ID', { span: 2 })}
                {field('paymentTerms', 'Payment Terms')}
                {field('make', 'Make')}
                {field('mtc', 'MTC')}
                {field('utLevel', 'UT Level')}
                {field('inspection', 'Inspection')}
                {field('deliveryLocation', 'Delivery Location', { span: 3 })}
                {field('vehicleNo', 'Vehicle Number')}
                {field('driverMobile', 'Driver Mobile No')}
                {field('transportName', 'Transport Name', { span: 2 })}
                {field('transportCharges', 'Transport Charges', { type: 'number', step: 'any' })}
                {field('loadingCharges', 'Loading Charges', { type: 'number', step: 'any' })}
                {field('note', 'Note', { span: 2 })}
                {field('remark', 'Remark', { span: 2 })}
                {field('preparedBy', 'Prepared By')}
                {field('checkedBy', 'Checked By')}
                <div>
                  <label>GST Rate (%)</label>
                  <select className="input-field" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: parseInt(e.target.value, 10) || 0 })}>
                    <option value="18">18%</option>
                    <option value="12">12%</option>
                    <option value="5">5%</option>
                    <option value="0">0%</option>
                  </select>
                </div>
                {field('terms', 'Terms & Conditions', { span: 4, textarea: true, rows: 4 })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Material Items</h3>
                <button type="button" className="btn" onClick={addItemRow} style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}>
                  + Add Row
                </button>
              </div>

              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table className="data-table" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th>Grade</th>
                      <th>Thickness</th>
                      <th>Width</th>
                      <th>Length</th>
                      <th>Nos</th>
                      <th>Kg</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.items || []).map((row, idx) => (
                      <tr key={idx}>
                        {['grade', 'thickness', 'width', 'length', 'nos', 'kg', 'rate', 'amount'].map((key) => (
                          <td key={key}>
                            <input
                              className="input-field"
                              style={{ padding: '0.35rem', minWidth: key === 'grade' ? '110px' : '70px' }}
                              type={['nos', 'kg', 'rate', 'amount'].includes(key) ? 'number' : 'text'}
                              step="any"
                              value={row[key] ?? ''}
                              onChange={e => updateItemRow(idx, key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          <button type="button" onClick={() => removeItemRow(idx)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.7)', cursor: 'pointer' }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Nos</span><div style={{ fontWeight: 700 }}>{totals.totalNos || 0}</div></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Kg</span><div style={{ fontWeight: 700 }}>{totals.totalKg || 0}</div></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Basic Amount</span><div style={{ fontWeight: 700 }}>₹{totals.basicAmount.toFixed(2)}</div></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Grand Total</span><div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>₹{totals.grandTotal.toFixed(2)}</div></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
