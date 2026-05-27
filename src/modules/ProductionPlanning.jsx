import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import ExportButton from '../components/ExportButton';

const ProductionPlanning = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = data.settings?.userRole || 'Admin';

  const [formData, setFormData] = useState({
    customer: '',
    productName: '',
    productNickName: '',
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
    setFormData(plan);
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
      customer: '',
      productName: '',
      productNickName: '',
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
  const filteredPlans = plansList.filter(p => 
    (p.productNickName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.customer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.batchNo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportColumns = [
    { label: 'Customer', key: 'customer' },
    { label: 'Product', key: 'productName' },
    { label: 'Nickname', key: 'productNickName' },
    { label: 'Batch No', key: 'batchNo' },
    { label: 'Qty', key: 'qty' },
    { label: 'Priority', key: 'priorityLevel' },
    { label: 'Start', key: 'startDate' },
    { label: 'Status', key: 'status' }
  ];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Production Planning</h1>
          <p style={{ color: 'var(--text-muted)' }}>Schedule milling batches and track processing.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filteredPlans} columns={exportColumns} filename="Production_Plan" title="Production Plan Report" />
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
                <th>Customer</th>
                <th>Product (Nick)</th>
                <th>Batch No</th>
                <th>Qty (Kg)</th>
                <th>PSD Note</th>
                <th>Priority</th>
                <th>Supervisor</th>
                <th>Delay Reason</th>
                <th>Start Date</th>
                <th>Status</th>
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
                    <td style={{ fontWeight: 600 }}>{plan.customer || 'N/A'}</td>
                    <td>{plan.productName} {plan.productNickName && <span style={{ color: 'var(--text-muted)' }}>({plan.productNickName})</span>}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{plan.batchNo || 'N/A'}</td>
                    <td>{plan.qty}</td>
                    <td><div style={{ fontSize: '0.75rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.psdNote || 'None'}</div></td>
                    <td>
                      <span style={{
                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                        background: plan.priorityLevel === 'Super Urgent' ? 'rgba(153, 27, 27, 0.2)' : plan.priorityLevel === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: plan.priorityLevel === 'Super Urgent' ? '#f87171' : plan.priorityLevel === 'High' ? '#ef4444' : '#10b981'
                      }}>
                        {plan.priorityLevel || 'Normal'}
                      </span>
                    </td>
                    <td>{plan.supervisor || 'Unassigned'}</td>
                    <td><div style={{ fontSize: '0.75rem', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(239, 68, 68, 0.8)' }}>{plan.delayReason || '-'}</div></td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(plan.startDate)} {plan.startTime}</td>
                    <td>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        background: plan.status === 'Done' ? 'rgba(16, 185, 129, 0.1)' : plan.status === 'Cancel' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: plan.status === 'Done' ? '#10b981' : plan.status === 'Cancel' ? '#ef4444' : '#f59e0b'
                      }}>
                        {plan.status}
                      </span>
                    </td>
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

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '800px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Modify Plan Entry' : 'Schedule New Batch'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Customer</label>
                  <input type="text" className="input-field" value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} />
                </div>
                <div>
                  <label>Product Name</label>
                  <input type="text" className="input-field" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} />
                </div>
                <div>
                  <label>Product Nickname</label>
                  <input type="text" className="input-field" value={formData.productNickName} onChange={e => setFormData({...formData, productNickName: e.target.value})} list="nicknames" />
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
                  <input type="text" className="input-field" value={formData.hours} readOnly style={{ fontWeight: 600, color: 'var(--accent-primary)', background: 'rgba(255,255,255,0.05)' }} />
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
