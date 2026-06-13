import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import ExportButton from '../components/ExportButton';

const buildPlansFromReceipt = (receipt, parties) => {
  const party = parties.find(p => p.id === receipt.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === receipt.productName);

  return (receipt.batches || [])
    .filter(b => !b.isEmptyDrums)
    .map((batch, idx) => ({
      id: `${receipt.id}_batch_${idx}`,
      receiptId: receipt.id,
      createdAt: receipt.createdAt || new Date().toISOString(),
      customer: receipt.partyName || party?.name || '',
      productName: receipt.productName || '',
      productNickName: receipt.nickName || prodConfig?.nickname || '',
      psdReq: batch.psdReq || prodConfig?.psdReq || '',
      psdNote: prodConfig?.psdNote || '',
      batchNo: batch.batchNo || '',
      qty: batch.qty ?? '',
      priorityLevel: 'Normal',
      specialInstructions: '',
      status: 'Pending',
      startDate: receipt.date || new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endDate: receipt.date || new Date().toISOString().split('T')[0],
      endTime: '17:00',
      hours: '8.00',
      notes: '',
      supervisor: '',
      delayReason: ''
    }));
};

const resolvePlan = (plan, materialReceipts = [], parties = []) => {
  const resolved = {
    ...plan,
    customer: plan.customer || plan.partyName || '',
    productName: plan.productName || plan.product || '',
    productNickName: plan.productNickName || plan.nickName || '',
    batchNo: plan.batchNo || plan.batchNumber || '',
    psdReq: plan.psdReq || plan.psdRequirement || '',
    psdNote: plan.psdNote || ''
  };

  if (plan.receiptId) {
    const mr = materialReceipts.find(r => r.id === plan.receiptId);
    if (mr) {
      resolved.customer = resolved.customer || mr.partyName || '';
      resolved.productName = resolved.productName || mr.productName || '';
      resolved.productNickName = resolved.productNickName || mr.nickName || '';

      const batchIdx = plan.id?.includes('_batch_') ? parseInt(plan.id.split('_batch_')[1], 10) : -1;
      const batch = !isNaN(batchIdx) && mr.batches?.[batchIdx]
        ? mr.batches[batchIdx]
        : (mr.batches || []).find(b => b.batchNo && b.batchNo === plan.batchNo) || mr.batches?.[0];

      if (batch) {
        resolved.batchNo = resolved.batchNo || batch.batchNo || '';
        resolved.psdReq = resolved.psdReq || batch.psdReq || '';
        if (!resolved.qty && batch.qty) resolved.qty = batch.qty;
      }
    }
  }

  if ((!resolved.customer || !resolved.productName) && resolved.productNickName) {
    for (const party of parties) {
      const prod = (party.products || []).find(
        p => p.nickname === resolved.productNickName || p.name === resolved.productNickName
      );
      if (prod) {
        resolved.customer = resolved.customer || party.name;
        resolved.productName = resolved.productName || prod.name;
        resolved.psdReq = resolved.psdReq || prod.psdReq || '';
        resolved.psdNote = resolved.psdNote || prod.psdNote || '';
        break;
      }
    }
  }

  return resolved;
};

const ProductionPlanning = () => {
  const { data, updateData, updateItem, deleteItemSoftly, setData } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  const userRole = data.settings?.userRole || 'Admin';
  const staffVisibleColumns = data.settings?.productionPlanningVisibleColumnsForStaff;

  const [formData, setFormData] = useState({
    partyId: '',
    customer: '',
    productName: '',
    productNickName: '',
    psdReq: '',
    psdNote: '',
    batchNo: '',
    qty: '',
    priorityLevel: 'Normal',
    specialInstructions: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endDate: new Date().toISOString().split('T')[0],
    endTime: '17:00',
    status: 'Pending',
    notes: '',
    supervisor: '',
    delayReason: ''
  });

  useEffect(() => {
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) return;
    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      const diffMs = endDateTime - startDateTime;
      if (diffMs > 0) {
        const diffHours = diffMs / (1000 * 60 * 60);
        setFormData(prev => ({ ...prev, hours: diffHours.toFixed(2) }));
      } else {
        setFormData(prev => ({ ...prev, hours: '0.00' }));
      }
    } catch (err) {
      console.error(err);
    }
  }, [formData.startDate, formData.startTime, formData.endDate, formData.endTime]);

  const handleEdit = (plan) => {
    setFormData(resolvePlan(plan, data.materialReceipts, data.parties));
    setIsEditing(plan.id);
    setIsModalOpen(true);
  };

  const deletePlan = (id) => {
    if (window.confirm("Delete this production plan?")) {
      deleteItemSoftly('productionPlans', id);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      partyId: '',
      customer: '',
      productName: '',
      productNickName: '',
      psdReq: '',
      psdNote: '',
      batchNo: '',
      qty: '',
      priorityLevel: 'Normal',
      specialInstructions: '',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endDate: new Date().toISOString().split('T')[0],
      endTime: '17:00',
      status: 'Pending',
      notes: '',
      supervisor: '',
      delayReason: ''
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handlePartySelect = (e) => {
    const partyId = e.target.value;
    const party = data.parties.find(p => p.id === partyId);
    if (party) {
      setFormData(prev => ({
        ...prev,
        partyId,
        customer: party.name,
        productName: '',
        productNickName: '',
        psdReq: '',
        psdNote: ''
      }));
    }
  };

  const handleProductSelect = (e) => {
    const productName = e.target.value;
    const party = data.parties.find(p => p.id === formData.partyId);
    const prodConfig = (party?.products || []).find(p => p.name === productName);
    if (prodConfig) {
      setFormData(prev => ({
        ...prev,
        productName,
        productNickName: prodConfig.nickname || prev.productNickName,
        psdReq: prodConfig.psdReq || prev.psdReq,
        psdNote: prodConfig.psdNote || prev.psdNote
      }));
    } else {
      setFormData(prev => ({ ...prev, productName }));
    }
  };

  const handleNicknameChange = (nick) => {
    setFormData(prev => {
      const next = { ...prev, productNickName: nick };
      for (const party of data.parties || []) {
        const prod = (party.products || []).find(p => p.nickname === nick);
        if (prod) {
          return {
            ...next,
            partyId: party.id,
            customer: party.name,
            productName: prod.name,
            psdReq: prod.psdReq || next.psdReq,
            psdNote: prod.psdNote || next.psdNote
          };
        }
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        updateItem('productionPlans', isEditing, { ...formData, id: isEditing });
      } else {
        const newPlan = {
          ...formData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        };
        updateData('productionPlans', newPlan);
      }
      setIsModalOpen(false);
      setIsEditing(null);
    } catch (error) {
      console.error(error);
      alert("Error saving production plan.");
    }
  };

  const productNicknames = Array.from(new Set((data.parties || []).flatMap(p => p.products || []).map(prod => prod?.nickname).filter(Boolean)));

  const plansList = (data.productionPlans || []).filter(p => !p.isDeleted);
  const resolvedPlans = useMemo(
    () => plansList.map(p => resolvePlan(p, data.materialReceipts, data.parties)),
    [plansList, data.materialReceipts, data.parties]
  );
  const filteredPlans = resolvedPlans.filter(p =>
    (p.productNickName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.customer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.batchNo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportColumns = [
    { label: 'Customer Name', key: 'customer' },
    { label: 'Product Name', key: 'productName' },
    { label: 'Product Nickname', key: 'productNickName' },
    { label: 'PSD Req.', key: 'psdReq' },
    { label: 'PSD Note', key: 'psdNote' },
    { label: 'Batch Number', key: 'batchNo' },
    { label: 'Qty', key: 'qty' },
    { label: 'Processing Start', key: 'startDate' },
    { label: 'Complete Date', key: 'endDate' },
    { label: 'Processing Hours', key: 'hours' },
    { label: 'Delay Reason', key: 'delayReason' },
    { label: 'Supervisor Name', key: 'supervisor' },
    { label: 'Priority Level', key: 'priorityLevel' },
    { label: 'Special Notes', key: 'specialInstructions' },
    { label: 'Status', key: 'status' }
  ];

  const allColumnKeys = exportColumns.map(c => c.key);
  const effectiveVisibleColumns = userRole === 'Admin'
    ? allColumnKeys
    : (Array.isArray(staffVisibleColumns) && staffVisibleColumns.length ? staffVisibleColumns : ['customer', 'productName', 'productNickName', 'batchNo', 'qty', 'status']);

  const visibleExportColumns = exportColumns.filter(c => effectiveVisibleColumns.includes(c.key));

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Production Planning</h1>
          <p style={{ color: 'var(--text-muted)' }}>Schedule milling batches and track processing.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filteredPlans} columns={visibleExportColumns} filename="Production_Plan" title="Production Plan Report" />
          {userRole === 'Admin' && (
            <button className="btn" onClick={() => setIsColumnModalOpen(true)}>
              Configure Staff View
            </button>
          )}
          {userRole === 'Admin' && (
            <button className="btn btn-primary" onClick={handleOpenModal}>
              <Plus size={18} /> Add Plan Manually
            </button>
          )}
        </div>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by customer, batch no, or nickname..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                {effectiveVisibleColumns.includes('customer') && <th>Customer Name</th>}
                {effectiveVisibleColumns.includes('productName') && <th>Product name</th>}
                {effectiveVisibleColumns.includes('productNickName') && <th>Product Nickname</th>}
                {effectiveVisibleColumns.includes('psdReq') && <th>PSD Req.</th>}
                {effectiveVisibleColumns.includes('psdNote') && <th>PSD Note</th>}
                {effectiveVisibleColumns.includes('batchNo') && <th>Batch Number</th>}
                {effectiveVisibleColumns.includes('qty') && <th>Qty</th>}
                {effectiveVisibleColumns.includes('startDate') && <th>Processing Start</th>}
                {effectiveVisibleColumns.includes('endDate') && <th>Complete Date</th>}
                {effectiveVisibleColumns.includes('hours') && <th>Processing Hours</th>}
                {effectiveVisibleColumns.includes('delayReason') && <th>Delay Reason</th>}
                {effectiveVisibleColumns.includes('supervisor') && <th>Supervisor Name</th>}
                {effectiveVisibleColumns.includes('priorityLevel') && <th>Priority Level</th>}
                {effectiveVisibleColumns.includes('specialInstructions') && <th>Special Notes</th>}
                {effectiveVisibleColumns.includes('status') && <th>Status</th>}
                {userRole === 'Admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={userRole === 'Admin' ? 9 : 8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No production plans recorded.</td>
                </tr>
              ) : (
                filteredPlans.map(plan => (
                  <tr key={plan.id}>
                    {effectiveVisibleColumns.includes('customer') && <td style={{ fontWeight: 600 }}>{plan.customer || 'N/A'}</td>}
                    {effectiveVisibleColumns.includes('productName') && <td>{plan.productName || 'N/A'}</td>}
                    {effectiveVisibleColumns.includes('productNickName') && <td>{plan.productNickName || '-'}</td>}
                    {effectiveVisibleColumns.includes('psdReq') && <td>{plan.psdReq || '-'}</td>}
                    {effectiveVisibleColumns.includes('psdNote') && <td><div style={{ fontSize: '0.75rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.psdNote || 'None'}</div></td>}
                    {effectiveVisibleColumns.includes('batchNo') && <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{plan.batchNo || 'N/A'}</td>}
                    {effectiveVisibleColumns.includes('qty') && <td>{plan.qty}</td>}
                    {effectiveVisibleColumns.includes('startDate') && <td style={{ fontSize: '0.85rem' }}>{formatDate(plan.startDate)} {plan.startTime}</td>}
                    {effectiveVisibleColumns.includes('endDate') && <td style={{ fontSize: '0.85rem' }}>{formatDate(plan.endDate)} {plan.endTime}</td>}
                    {effectiveVisibleColumns.includes('hours') && <td>{plan.hours || '0.00'}</td>}
                    {effectiveVisibleColumns.includes('delayReason') && <td><div style={{ fontSize: '0.75rem', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(239, 68, 68, 0.8)' }}>{plan.delayReason || '-'}</div></td>}
                    {effectiveVisibleColumns.includes('supervisor') && <td>{plan.supervisor || 'Unassigned'}</td>}
                    {effectiveVisibleColumns.includes('priorityLevel') && (
                      <td>
                      <span style={{
                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                        background: plan.priorityLevel === 'Super Urgent' ? 'rgba(153, 27, 27, 0.2)' : plan.priorityLevel === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: plan.priorityLevel === 'Super Urgent' ? '#f87171' : plan.priorityLevel === 'High' ? '#ef4444' : '#10b981'
                      }}>
                        {plan.priorityLevel || 'Normal'}
                      </span>
                      </td>
                    )}
                    {effectiveVisibleColumns.includes('specialInstructions') && <td><div style={{ fontSize: '0.75rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.specialInstructions || '-'}</div></td>}
                    {effectiveVisibleColumns.includes('status') && (
                      <td>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        background: plan.status === 'Done' ? 'rgba(16, 185, 129, 0.1)' : plan.status === 'Cancel' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: plan.status === 'Done' ? '#10b981' : plan.status === 'Cancel' ? '#ef4444' : '#f59e0b'
                      }}>
                        {plan.status}
                      </span>
                      </td>
                    )}
                    {userRole === 'Admin' && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleEdit(plan)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                          <button onClick={() => deletePlan(plan.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isColumnModalOpen && userRole === 'Admin' && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(4px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>Staff Visible Columns (Boss Control)</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>Staff members can view only selected columns. Admin always sees all columns.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              {exportColumns.map(col => {
                const checked = Array.isArray(staffVisibleColumns)
                  ? staffVisibleColumns.includes(col.key)
                  : false;
                return (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', background: 'var(--glass-bg)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(Array.isArray(staffVisibleColumns) ? staffVisibleColumns : []);
                        if (e.target.checked) next.add(col.key);
                        else next.delete(col.key);
                        setData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, productionPlanningVisibleColumnsForStaff: Array.from(next) }
                        }));
                      }}
                    />
                    {col.label}
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
              <button className="btn" onClick={() => setIsColumnModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '800px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Modify Plan Entry' : 'Schedule New Batch'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Select Party</label>
                  <select className="input-field" value={formData.partyId || ''} onChange={handlePartySelect}>
                    <option value="">-- Select Party --</option>
                    {(data.parties || []).filter(p => p.type === 'Customer').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Customer</label>
                  <input type="text" className="input-field" value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} />
                </div>
                <div>
                  <label>Product Name</label>
                  {(() => {
                    const party = data.parties.find(p => p.id === formData.partyId);
                    const products = party?.products || [];
                    return products.length > 0 ? (
                      <select className="input-field" value={formData.productName} onChange={handleProductSelect}>
                        <option value="">-- Select Product --</option>
                        {products.map((p, idx) => (
                          <option key={idx} value={p.name}>{p.name}{p.nickname ? ` (${p.nickname})` : ''}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" className="input-field" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} />
                    );
                  })()}
                </div>
                <div>
                  <label>Product Nickname</label>
                  <input type="text" className="input-field" value={formData.productNickName} onChange={e => handleNicknameChange(e.target.value)} list="nicknames" />
                  <datalist id="nicknames">
                    {productNicknames.map((nick, idx) => <option key={idx} value={nick} />)}
                  </datalist>
                </div>
                <div>
                  <label>Batch No</label>
                  <input type="text" className="input-field" value={formData.batchNo} onChange={e => setFormData({...formData, batchNo: e.target.value})} />
                </div>
                <div>
                  <label>Quantity (Kg)</label>
                  <input type="number" className="input-field" value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} />
                </div>
                <div>
                  <label>Priority Level</label>
                  <select className="input-field" value={formData.priorityLevel} onChange={e => setFormData({...formData, priorityLevel: e.target.value})}>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Super Urgent">Super Urgent</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>PSD Note / Material Requirement</label>
                  <input type="text" className="input-field" value={formData.psdNote} onChange={e => setFormData({...formData, psdNote: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>PSD Requirement</label>
                  <input type="text" className="input-field" value={formData.psdReq || ''} onChange={e => setFormData({ ...formData, psdReq: e.target.value })} />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>Special Instructions</label>
                  <input type="text" className="input-field" value={formData.specialInstructions} onChange={e => setFormData({...formData, specialInstructions: e.target.value})} />
                </div>
                <div>
                  <label>Supervisor</label>
                  <select className="input-field" value={formData.supervisor} onChange={e => setFormData({...formData, supervisor: e.target.value})}>
                    <option value="">Unassigned</option>
                    <option value="Supervisor 1">Supervisor 1</option>
                    <option value="Supervisor 2">Supervisor 2</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Delay Reason (If Any)</label>
                  <input type="text" className="input-field" value={formData.delayReason} onChange={e => setFormData({...formData, delayReason: e.target.value})} placeholder="Machine breakdown, missing materials..." />
                </div>
                
                <div>
                  <label>Processing Start Date</label>
                  <input type="date" className="input-field" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <label>Processing Start Time</label>
                  <input type="time" className="input-field" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                </div>
                <div>
                  <label>Planning Status</label>
                  <select className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="Cancel">Cancel</option>
                  </select>
                </div>

                <div>
                  <label>Complete Date</label>
                  <input type="date" className="input-field" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
                <div>
                  <label>Complete Time</label>
                  <input type="time" className="input-field" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
                </div>
                <div>
                  <label>Total Processing Hours</label>
                  <input type="text" className="input-field" value={formData.hours} readOnly style={{ fontWeight: 600, color: 'var(--accent-primary)', background: 'var(--glass-bg)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => { setIsModalOpen(false); setIsEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Save Changes' : 'Confirm Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionPlanning;
