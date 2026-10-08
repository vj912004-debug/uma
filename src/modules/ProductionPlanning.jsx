import { formatDate, newestFirst } from '../utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import ExportButton from '../components/ExportButton';
import SearchableSelect from '../components/SearchableSelect';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import StatusTabBar from '../components/StatusTabBar';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';

const buildPlansFromReceipt = (receipt, parties) => {
  const party = parties.find(p => p.id === receipt.partyId);

  return (receipt.batches || [])
    .filter(b => !b.isEmptyDrums)
    .map((batch, idx) => {
      const batchProduct = batch.productName || receipt.productName || '';
      const prodConfig = (party?.products || []).find(p => p.name === batchProduct);
      return {
        id: `${receipt.id}_batch_${idx}`,
        receiptId: receipt.id,
        createdAt: receipt.createdAt || new Date().toISOString(),
        customer: receipt.partyName || party?.name || '',
        productName: batchProduct,
        productNickName: batch.nickName || prodConfig?.nickname || receipt.nickName || '',
        psdReq: batch.psdReq || prodConfig?.psdReq || '',
        psdNote: prodConfig?.psdNote || '',
        batchNo: batch.batchNo || '',
        qty: batch.qty ?? '',
        priorityLevel: '',
        specialInstructions: '',
        status: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        hours: '',
        notes: '',
        supervisor: '',
        delayReason: ''
      };
    });
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

const normProduct = (s) => String(s || '').trim().toLowerCase();

const parsePlanDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const t = timeStr || '00:00';
  const d = new Date(`${dateStr}T${t}`);
  return isNaN(d.getTime()) ? null : d;
};

const formatPlanDate = (d) => d.toISOString().slice(0, 10);
const formatPlanTime = (d) => d.toTimeString().slice(0, 5);

export const performCarryForward = (anchorPlan, allPlans) => {
  if (!anchorPlan?.endDate || !anchorPlan?.endTime) {
    return { nextPlans: allPlans, shiftedCount: 0 };
  }

  const anchorEnd = parsePlanDateTime(anchorPlan.endDate, anchorPlan.endTime);
  if (!anchorEnd) return { nextPlans: allPlans, shiftedCount: 0 };

  const otherPlans = (allPlans || []).filter(p =>
    !p.isDeleted &&
    p.id !== anchorPlan.id &&
    p.status !== 'Done' &&
    p.status !== 'Cancel'
  );

  if (otherPlans.length === 0) return { nextPlans: allPlans, shiftedCount: 0 };

  const sorted = [...otherPlans].sort((a, b) => {
    const dtA = parsePlanDateTime(a.startDate, a.startTime) || new Date(a.createdAt || 0);
    const dtB = parsePlanDateTime(b.startDate, b.startTime) || new Date(b.createdAt || 0);
    return dtA - dtB;
  });

  let currentChainEnd = new Date(anchorEnd.getTime());
  let shiftedCount = 0;
  const updatedMap = new Map();

  for (const plan of sorted) {
    const startDt = parsePlanDateTime(plan.startDate, plan.startTime);
    const endDt = parsePlanDateTime(plan.endDate, plan.endTime);

    let durationMs = 8 * 3600 * 1000;
    if (startDt && endDt && endDt > startDt) {
      durationMs = endDt.getTime() - startDt.getTime();
    } else if (parseFloat(plan.hours) > 0) {
      durationMs = Math.round(parseFloat(plan.hours) * 3600 * 1000);
    }

    if (!startDt || startDt < currentChainEnd) {
      const newStart = new Date(currentChainEnd.getTime());
      const newEnd = new Date(newStart.getTime() + durationMs);
      const hoursNum = (durationMs / (3600 * 1000)).toFixed(2);

      updatedMap.set(plan.id, {
        ...plan,
        startDate: formatPlanDate(newStart),
        startTime: formatPlanTime(newStart),
        endDate: formatPlanDate(newEnd),
        endTime: formatPlanTime(newEnd),
        hours: hoursNum
      });

      shiftedCount++;
      currentChainEnd = newEnd;
    } else {
      if (endDt && endDt > currentChainEnd) {
        currentChainEnd = new Date(endDt.getTime());
      }
    }
  }

  const nextPlans = (allPlans || []).map(p => updatedMap.get(p.id) || p);
  return { nextPlans, shiftedCount };
};

/** True when a Delivery Challan exists for this plan's receipt (and product when set). */
const isPlanDispatched = (plan, deliveryChallans = []) => {
  if (!plan?.receiptId) return false;
  const dcs = (deliveryChallans || []).filter(
    (d) => !d.isDeleted && String(d.receiptId) === String(plan.receiptId)
  );
  if (!dcs.length) return false;
  const planProduct = normProduct(plan.productName);
  if (!planProduct) return true;
  return dcs.some((dc) => {
    const dcProd = normProduct(dc.productName);
    if (!dcProd) return true;
    return (
      dcProd === planProduct ||
      dcProd.includes(planProduct) ||
      planProduct.includes(dcProd) ||
      dcProd.split(',').some((p) => normProduct(p) === planProduct)
    );
  });
};

const ProductionPlanning = () => {
  const { data, updateData, updateItem, deleteItemSoftly, setData } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [autoCarryForward, setAutoCarryForward] = useState(true);

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
    priorityLevel: '',
    specialInstructions: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    hours: '',
    status: '',
    notes: '',
    supervisor: '',
    delayReason: ''
  });

  useEffect(() => {
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      if (formData.hours) setFormData(prev => ({ ...prev, hours: '' }));
      return;
    }
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
      priorityLevel: '',
      specialInstructions: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      hours: '',
      status: '',
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
      let savedPlan;
      let allPlans = data.productionPlans || [];
      if (isEditing) {
        savedPlan = { ...formData, id: isEditing };
        allPlans = allPlans.map(p => p.id === isEditing ? savedPlan : p);
      } else {
        savedPlan = {
          ...formData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        };
        allPlans = [...allPlans, savedPlan];
      }

      const hasDelay = Boolean(formData.delayReason && formData.delayReason.trim());

      if ((autoCarryForward || hasDelay) && savedPlan.endDate && savedPlan.endTime) {
        const { nextPlans, shiftedCount } = performCarryForward(savedPlan, allPlans);
        setData(prev => ({ ...prev, productionPlans: nextPlans }));
        if (shiftedCount > 0) {
          alert(`Plan saved. ${hasDelay ? 'Delay reason updated and ' : ''}${shiftedCount} subsequent pending plan(s) were carried forward automatically.`);
        }
      } else {
        setData(prev => ({ ...prev, productionPlans: allPlans }));
      }
      setIsModalOpen(false);
      setIsEditing(null);
    } catch (error) {
      console.error(error);
      alert("Error saving production plan.");
    }
  };

  const handleCarryForwardForPlan = (plan) => {
    const resolved = resolvePlan(plan, data.materialReceipts, data.parties);
    const { nextPlans, shiftedCount } = performCarryForward(resolved, data.productionPlans || []);
    if (shiftedCount > 0) {
      setData(prev => ({ ...prev, productionPlans: nextPlans }));
      alert(`Carried forward ${shiftedCount} subsequent pending plan(s) starting after ${resolved.batchNo || resolved.productName || 'selected plan'} (${resolved.endDate} ${resolved.endTime}).`);
    } else {
      alert('All pending plans are already scheduled after this plan. No shifting needed.');
    }
  };

  const handleCarryForwardAll = () => {
    const plans = data.productionPlans || [];
    if (!plans.length) {
      alert("No production plans available.");
      return;
    }

    const candidates = [...plans]
      .filter(p => !p.isDeleted && p.endDate && p.endTime)
      .sort((a, b) => {
        const dtA = parsePlanDateTime(a.endDate, a.endTime) || new Date(0);
        const dtB = parsePlanDateTime(b.endDate, b.endTime) || new Date(0);
        return dtB - dtA;
      });

    const anchor = candidates[0];
    if (!anchor) {
      alert("No completed or scheduled plan with end date/time found to use as anchor.");
      return;
    }

    const { nextPlans, shiftedCount } = performCarryForward(anchor, plans);
    if (shiftedCount > 0) {
      setData(prev => ({ ...prev, productionPlans: nextPlans }));
      alert(`Queue updated! Shifted ${shiftedCount} pending plan(s) based on ${anchor.batchNo || anchor.productName || 'latest plan'} (${anchor.endDate} ${anchor.endTime}).`);
    } else {
      alert("All pending plans are already scheduled after the latest completion date.");
    }
  };

  const productNicknames = Array.from(new Set((data.parties || []).flatMap(p => p.products || []).map(prod => prod?.nickname).filter(Boolean)));

  const plansList = newestFirst((data.productionPlans || []).filter(p => !p.isDeleted));
  const resolvedPlans = useMemo(
    () => plansList
      .map(p => resolvePlan(p, data.materialReceipts, data.parties))
      .filter((p) => !isPlanDispatched(p, data.deliveryChallans)),
    [plansList, data.materialReceipts, data.parties, data.deliveryChallans]
  );
  const partyOptions = useMemo(() => uniqueSortedOptions([
    ...resolvedPlans.map((p) => p.customer),
    ...(data.parties || []).map((p) => p.name)
  ]), [resolvedPlans, data.parties]);
  const productOptions = useMemo(() => uniqueSortedOptions([
    ...resolvedPlans.map((p) => p.productName),
    ...(data.parties || []).flatMap((p) => (p.products || []).map((prod) => prod.name))
  ]), [resolvedPlans, data.parties]);

  const isPlanPending = (p) => p.status !== 'Done' && p.status !== 'Cancel';
  const isPlanDelayed = (p) => Boolean(p.delayReason && String(p.delayReason).trim());

  const pendingCount = resolvedPlans.filter(isPlanPending).length;
  const delayedCount = resolvedPlans.filter(isPlanDelayed).length;
  const completedCount = resolvedPlans.filter((p) => p.status === 'Done').length;

  const filteredPlans = resolvedPlans.filter((p) => {
    if (statusTab === 'pending' && !isPlanPending(p)) return false;
    if (statusTab === 'delayed' && !isPlanDelayed(p)) return false;
    if (statusTab === 'completed' && p.status !== 'Done') return false;
    if (partyFilter && (p.customer || '') !== partyFilter) return false;
    if (productFilter && (p.productName || '') !== productFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (p.productNickName || '').toLowerCase().includes(q) ||
      (p.customer || '').toLowerCase().includes(q) ||
      (p.productName || '').toLowerCase().includes(q) ||
      (p.batchNo || '').toLowerCase().includes(q) ||
      (p.delayReason || '').toLowerCase().includes(q)
    );
  });

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
      <header className="page-header">
        <div>
          <h1 className="page-title">Production Planning</h1>
          <p className="page-subtitle">Schedule milling batches and track processing. Dispatched jobs leave this list automatically.</p>
        </div>
        <div className="page-toolbar" style={{ flex: '1 1 520px', justifyContent: 'flex-end', minWidth: 0 }}>
          <ExportButton data={filteredPlans} columns={visibleExportColumns} filename="Production_Plan" title="Production Plan Report" />
          {userRole === 'Admin' && (
            <button className="btn" onClick={handleCarryForwardAll} title="Shift all pending plans forward chronologically">
              <Clock size={16} /> Carry Forward Queue
            </button>
          )}
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

      <div className="tab-bar status-tab-bar" style={{ marginBottom: '1.5rem' }}>
        <button type="button" className={`tab-btn${statusTab === 'pending' ? ' active' : ''}`} onClick={() => setStatusTab('pending')}>
          Pending ({pendingCount})
        </button>
        <button type="button" className={`tab-btn${statusTab === 'delayed' ? ' active' : ''}`} onClick={() => setStatusTab('delayed')}>
          ⚠️ Delayed ({delayedCount})
        </button>
        <button type="button" className={`tab-btn${statusTab === 'completed' ? ' active' : ''}`} onClick={() => setStatusTab('completed')}>
          Completed ({completedCount})
        </button>
        <button type="button" className={`tab-btn${statusTab === 'all' ? ' active' : ''}`} onClick={() => setStatusTab('all')}>
          All ({resolvedPlans.length})
        </button>
      </div>

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by customer, batch no, or nickname..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        productFilter={productFilter}
        onProductChange={setProductFilter}
        productOptions={productOptions}
      />

      <div className="premium-card">
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
                    {effectiveVisibleColumns.includes('startDate') && <td style={{ fontSize: '0.85rem' }}>{plan.startDate ? `${formatDate(plan.startDate)} ${plan.startTime || ''}`.trim() : '-'}</td>}
                    {effectiveVisibleColumns.includes('endDate') && <td style={{ fontSize: '0.85rem' }}>{plan.endDate ? `${formatDate(plan.endDate)} ${plan.endTime || ''}`.trim() : '-'}</td>}
                    {effectiveVisibleColumns.includes('hours') && <td>{plan.hours || '-'}</td>}
                    {effectiveVisibleColumns.includes('delayReason') && (
                      <td>
                        {plan.delayReason && plan.delayReason.trim() ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '130px' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              width: 'fit-content'
                            }}>
                              ⚠️ Delay Updated
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }} title={plan.delayReason}>
                              {plan.delayReason}
                            </span>
                            {userRole === 'Admin' && isPlanPending(plan) && (
                              <button
                                type="button"
                                className="btn"
                                style={{
                                  padding: '0.2rem 0.45rem',
                                  fontSize: '0.7rem',
                                  marginTop: '0.2rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  background: 'var(--glass-bg)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--accent-primary)',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleCarryForwardForPlan(plan)}
                                title="Carry forward start & complete dates for all subsequent pending plans"
                              >
                                <Clock size={12} /> Carry Forward Queue
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                            No Delay
                          </span>
                        )}
                      </td>
                    )}
                    {effectiveVisibleColumns.includes('supervisor') && <td>{plan.supervisor || '-'}</td>}
                    {effectiveVisibleColumns.includes('priorityLevel') && (
                      <td>
                      {plan.priorityLevel ? (
                        <span style={{
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: plan.priorityLevel === 'Super Urgent' ? 'rgba(153, 27, 27, 0.2)' : plan.priorityLevel === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: plan.priorityLevel === 'Super Urgent' ? '#f87171' : plan.priorityLevel === 'High' ? '#ef4444' : '#10b981'
                        }}>
                          {plan.priorityLevel}
                        </span>
                      ) : '-'}
                      </td>
                    )}
                    {effectiveVisibleColumns.includes('specialInstructions') && <td><div style={{ fontSize: '0.75rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.specialInstructions || '-'}</div></td>}
                    {effectiveVisibleColumns.includes('status') && (
                      <td>
                      {plan.status ? (
                        <span style={{ 
                          padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                          background: plan.status === 'Done' ? 'rgba(16, 185, 129, 0.1)' : plan.status === 'Cancel' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: plan.status === 'Done' ? '#10b981' : plan.status === 'Cancel' ? '#ef4444' : '#f59e0b'
                        }}>
                          {plan.status}
                        </span>
                      ) : '-'}
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
        <div className="page-form-overlay">
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
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: '800px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Modify Plan Entry' : 'Schedule New Batch'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Select Party</label>
                  <SearchableSelect className="input-field" value={formData.partyId || ''} onChange={handlePartySelect}>
                    <option value="">-- Select Party --</option>
                    {(data.parties || []).filter(p => p.type === 'Customer').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </SearchableSelect>
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
                      <SearchableSelect className="input-field" value={formData.productName} onChange={handleProductSelect}>
                        <option value="">-- Select Product --</option>
                        {products.map((p, idx) => (
                          <option key={idx} value={p.name}>{p.name}{p.nickname ? ` (${p.nickname})` : ''}</option>
                        ))}
                      </SearchableSelect>
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
                  <SearchableSelect className="input-field" value={formData.priorityLevel} onChange={e => setFormData({...formData, priorityLevel: e.target.value})}>
                    <option value="">-- Select --</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Super Urgent">Super Urgent</option>
                  </SearchableSelect>
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
                  <SearchableSelect className="input-field" value={formData.supervisor} onChange={e => setFormData({...formData, supervisor: e.target.value})}>
                    <option value="">-- Select --</option>
                    <option value="Supervisor 1">Supervisor 1</option>
                    <option value="Supervisor 2">Supervisor 2</option>
                  </SearchableSelect>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ margin: 0 }}>Delay Reason (If Any)</label>
                    {formData.delayReason?.trim() && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        ⚠️ Delay Reason Updated
                      </span>
                    )}
                  </div>
                  <input type="text" className="input-field" value={formData.delayReason} onChange={e => setFormData({...formData, delayReason: e.target.value})} placeholder="Machine breakdown, missing materials..." />
                </div>
                
                <div>
                  <label>Processing Start Date</label>
                  <DateField className="input-field" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <label>Processing Start Time</label>
                  <TimeField className="input-field" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                </div>
                <div>
                  <label>Planning Status</label>
                  <SearchableSelect className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="">-- Select --</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="Cancel">Cancel</option>
                  </SearchableSelect>
                </div>

                <div>
                  <label>Complete Date</label>
                  <DateField className="input-field" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
                <div>
                  <label>Complete Time</label>
                  <TimeField className="input-field" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
                </div>
                <div>
                  <label>Total Processing Hours</label>
                  <input type="text" className="input-field" value={formData.hours || ''} readOnly placeholder="Auto-calculated" style={{ fontWeight: 600, color: 'var(--accent-primary)', background: 'var(--glass-bg)' }} />
                </div>

                <div style={{ gridColumn: 'span 3', background: 'rgba(155, 98, 196, 0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={autoCarryForward}
                      onChange={e => setAutoCarryForward(e.target.checked)}
                    />
                    <span>Carry forward subsequent pending plans automatically (Reschedules queue dates & times)</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
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
