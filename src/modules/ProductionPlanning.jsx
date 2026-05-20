import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, Calendar, Clock } from 'lucide-react';

const ProductionPlanning = () => {
  const { data, updateData, updateItem, setData } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    productNickName: '',
    qty: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endDate: new Date().toISOString().split('T')[0],
    endTime: '17:00',
    hours: '8.00',
    status: 'Pending',
    notes: ''
  });

  // Automatically calculate processing hours based on dates & times
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
    if (window.confirm("Are you sure you want to delete this production plan?")) {
      setData(prev => ({
        ...prev,
        productionPlans: prev.productionPlans.filter(p => p.id !== id)
      }));
    }
  };

  const handleOpenModal = () => {
    setFormData({
      productNickName: '',
      qty: '',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endDate: new Date().toISOString().split('T')[0],
      endTime: '17:00',
      hours: '8.00',
      status: 'Pending',
      notes: ''
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      if (!formData.productNickName) {
        alert("Please select a product.");
        return;
      }

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
      console.error("Failed to save production plan:", error);
      alert("Error saving production plan.");
    }
  };

  // Collect unique product nicknames configured in parties master
  const productNicknames = Array.from(
    new Set(
      (data.parties || [])
        .flatMap(p => p.products || [])
        .map(prod => prod?.nickname)
        .filter(Boolean)
    )
  );

  const filteredPlans = (data.productionPlans || []).filter(p => 
    (p.productNickName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Production Planning</h1>
          <p style={{ color: 'var(--text-muted)' }}>Schedule milling batches, track running runtimes, and log machine hours.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Schedule Batch
        </button>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by product nickname or notes..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sr. No</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Product Nickname</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Quantity</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Processing Start</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Complete Date</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Processing Hours</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No production plans recorded.</td>
                </tr>
              ) : (
                filteredPlans.map((plan, idx) => (
                  <tr key={plan.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{plan.productNickName}</td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{plan.qty} Kg</td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                      <p style={{ margin: 0 }}><Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> {plan.startDate}</p>
                      <p style={{ margin: 0, color: 'var(--text-muted)' }}><Clock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> {plan.startTime}</p>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                      <p style={{ margin: 0 }}><Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> {plan.endDate}</p>
                      <p style={{ margin: 0, color: 'var(--text-muted)' }}><Clock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> {plan.endTime}</p>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{plan.hours} Hrs</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem',
                        background: plan.status === 'Done' ? 'rgba(16, 185, 129, 0.1)' : plan.status === 'Cancel' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: plan.status === 'Done' ? '#10b981' : plan.status === 'Cancel' ? '#ef4444' : '#f59e0b',
                        fontWeight: 600
                      }}>
                        {plan.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleEdit(plan)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                        <button onClick={() => deletePlan(plan.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="premium-card" style={{ width: '600px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Modify Plan Entry' : 'Schedule New Milling Batch'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Product Nickname *</label>
                  <select 
                    className="input-field" 
                    required 
                    value={formData.productNickName}
                    onChange={e => setFormData({...formData, productNickName: e.target.value})}
                  >
                    <option value="">Select Nickname</option>
                    {productNicknames.map((nick, idx) => (
                      <option key={idx} value={nick}>{nick}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Quantity (Kg) *</label>
                  <input type="number" className="input-field" required value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} />
                </div>
                
                <div>
                  <label>Processing Start Date *</label>
                  <input type="date" className="input-field" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <label>Processing Start Time *</label>
                  <input type="time" className="input-field" required value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                </div>

                <div>
                  <label>Processing Complete Date *</label>
                  <input type="date" className="input-field" required value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
                <div>
                  <label>Processing Complete Time *</label>
                  <input type="time" className="input-field" required value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
                </div>

                <div>
                  <label>Total Processing Hours</label>
                  <input type="text" className="input-field" value={formData.hours} onChange={e => setFormData({...formData, hours: e.target.value})} style={{ fontWeight: 600, color: 'var(--accent-primary)' }} />
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
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Notes / Work Instructions</label>
                  <textarea className="input-field" rows="2" placeholder="Enter batch logs, mesh sizes, sieving specs, etc." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
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
