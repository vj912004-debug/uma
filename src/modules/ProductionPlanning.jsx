import { formatDateAndTime } from '../utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  Plus, Edit2, Trash2, Clock, Search, RotateCcw, Eye, Layers,
  PlayCircle, CheckCircle2, PauseCircle, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import ExportButton from '../components/ExportButton';
import SearchableSelect from '../components/SearchableSelect';
import { uniqueSortedOptions } from '../components/ListFilterBar';
import StatusTabBar from '../components/StatusTabBar';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';

const PAGE_SIZE = 10;

const normalizeStatus = (status) => {
  const s = String(status || '').trim();
  if (!s) return 'Pending';
  if (s === 'Done') return 'Completed';
  return s;
};

const statusPillStyle = (status) => {
  const s = normalizeStatus(status);
  if (s === 'Completed' || s === 'Done') {
    return { background: 'rgba(16, 185, 129, 0.12)', color: '#059669' };
  }
  if (s === 'In Progress') {
    return { background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' };
  }
  if (s === 'On Hold' || s === 'Cancel') {
    return { background: 'rgba(249, 115, 22, 0.14)', color: '#ea580c' };
  }
  return { background: 'rgba(234, 179, 8, 0.16)', color: '#a16207' };
};

const priorityPillStyle = (priority) => {
  const p = String(priority || '').trim();
  if (p === 'Super Urgent' || p === 'Urgent') {
    return { background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' };
  }
  if (p === 'High') {
    return { background: 'rgba(236, 72, 153, 0.12)', color: '#db2777' };
  }
  if (p === 'Normal') {
    return { background: 'rgba(16, 185, 129, 0.12)', color: '#059669' };
  }
  return { background: 'rgba(148, 163, 184, 0.16)', color: '#64748b' };
};

const StatCard = ({ label, value, icon: Icon, color, bg }) => (
  <div style={{
    flex: '1 1 140px',
    minWidth: 140,
    background: '#fff',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: '1rem 1.1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    boxShadow: '0 1px 2px rgba(91, 28, 133, 0.04)'
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: 10, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>{value}</div>
    </div>
  </div>
);

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

const pad2 = (n) => String(n).padStart(2, '0');

/** Normalize stored time to 24h "HH:MM" (never invent a new clock value). */
const normalizePlanTime = (timeStr) => {
  if (timeStr == null || String(timeStr).trim() === '') return '';
  const str = String(timeStr).trim();
  // Prefer local parse without Date()/UTC so "09:00" stays 09:00
  const m = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = (m[3] || '').toUpperCase();
    if (!Number.isFinite(h) || !Number.isFinite(min)) return '';
    if (ap === 'AM') h = h % 12;
    else if (ap === 'PM') h = (h % 12) + 12;
    if (h < 0 || h > 23 || min < 0 || min > 59) return '';
    return `${pad2(h)}:${pad2(min)}`;
  }
  return '';
};

/** Normalize date to local "YYYY-MM-DD" without UTC day-shift. */
const normalizePlanDate = (dateStr) => {
  if (dateStr == null || String(dateStr).trim() === '') return '';
  const str = String(dateStr).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${pad2(dmy[2])}-${pad2(dmy[1])}`;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Build a local Date from plan date + time (no UTC conversion). */
const parsePlanDateTime = (dateStr, timeStr) => {
  const datePart = normalizePlanDate(dateStr);
  if (!datePart) return null;
  const [y, mo, da] = datePart.split('-').map((x) => parseInt(x, 10));
  const timePart = normalizePlanTime(timeStr || '00:00') || '00:00';
  const [hh, mm] = timePart.split(':').map((x) => parseInt(x, 10));
  const d = new Date(y, mo - 1, da, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Local calendar date — never use toISOString() (UTC shifts the day in IST). */
const formatPlanDate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatPlanTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const performCarryForward = (anchorPlan, allPlans, deliveryChallans = []) => {
  if (!anchorPlan?.endDate || !anchorPlan?.endTime) {
    return { nextPlans: allPlans, shiftedCount: 0 };
  }

  const anchorEnd = parsePlanDateTime(anchorPlan.endDate, anchorPlan.endTime);
  if (!anchorEnd) return { nextPlans: allPlans, shiftedCount: 0 };

  const otherPlans = (allPlans || []).filter(p =>
    !p.isDeleted &&
    p.id !== anchorPlan.id &&
    p.status !== 'Done' &&
    p.status !== 'Cancel' &&
    !isPlanDispatched(p, deliveryChallans)
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
  const [viewPlan, setViewPlan] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState({
    customer: '',
    product: '',
    batchNo: '',
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: ''
  });
  const [filters, setFilters] = useState(draftFilters);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [autoCarryForward, setAutoCarryForward] = useState(true);
  const [statusTab, setStatusTab] = useState('pending');

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
    const startDate = normalizePlanDate(formData.startDate);
    const endDate = normalizePlanDate(formData.endDate);
    const startTime = normalizePlanTime(formData.startTime);
    const endTime = normalizePlanTime(formData.endTime);
    if (!startDate || !startTime || !endDate || !endTime) {
      if (formData.hours) setFormData(prev => (prev.hours ? { ...prev, hours: '' } : prev));
      return;
    }
    const startDateTime = parsePlanDateTime(startDate, startTime);
    const endDateTime = parsePlanDateTime(endDate, endTime);
    if (!startDateTime || !endDateTime) return;
    const diffMs = endDateTime - startDateTime;
    const nextHours = diffMs > 0 ? (diffMs / (1000 * 60 * 60)).toFixed(2) : '0.00';
    setFormData(prev => (prev.hours === nextHours ? prev : { ...prev, hours: nextHours }));
  }, [formData.startDate, formData.startTime, formData.endDate, formData.endTime]);

  const handleEdit = (plan) => {
    const resolved = resolvePlan(plan, data.materialReceipts, data.parties);
    setFormData({
      ...resolved,
      startDate: normalizePlanDate(resolved.startDate),
      endDate: normalizePlanDate(resolved.endDate),
      startTime: normalizePlanTime(resolved.startTime),
      endTime: normalizePlanTime(resolved.endTime)
    });
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
      const normalizedTimes = {
        startDate: normalizePlanDate(formData.startDate),
        endDate: normalizePlanDate(formData.endDate),
        startTime: normalizePlanTime(formData.startTime),
        endTime: normalizePlanTime(formData.endTime)
      };
      if (isEditing) {
        const existing = allPlans.find((p) => p.id === isEditing);
        // Keep original createdAt so edits do not jump to the top of the list
        savedPlan = {
          ...formData,
          ...normalizedTimes,
          id: isEditing,
          createdAt: existing?.createdAt || formData.createdAt || new Date().toISOString()
        };
        allPlans = allPlans.map(p => p.id === isEditing ? savedPlan : p);
      } else {
        savedPlan = {
          ...formData,
          ...normalizedTimes,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        };
        allPlans = [...allPlans, savedPlan];
      }

      const hasDelay = Boolean(formData.delayReason && formData.delayReason.trim());

      if ((autoCarryForward || hasDelay) && savedPlan.endDate && savedPlan.endTime) {
        const { nextPlans, shiftedCount } = performCarryForward(savedPlan, allPlans, data.deliveryChallans || []);
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
    const { nextPlans, shiftedCount } = performCarryForward(resolved, data.productionPlans || [], data.deliveryChallans || []);
    if (shiftedCount > 0) {
      setData(prev => ({ ...prev, productionPlans: nextPlans }));
      alert(`Carried forward ${shiftedCount} subsequent pending plan(s) starting after ${resolved.batchNo || resolved.productName || 'selected plan'} (${formatDateAndTime(resolved.endDate, resolved.endTime)}).`);
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

    const { nextPlans, shiftedCount } = performCarryForward(anchor, plans, data.deliveryChallans || []);
    if (shiftedCount > 0) {
      setData(prev => ({ ...prev, productionPlans: nextPlans }));
      alert(`Queue updated! Shifted ${shiftedCount} pending plan(s) based on ${anchor.batchNo || anchor.productName || 'latest plan'} (${formatDateAndTime(anchor.endDate, anchor.endTime)}).`);
    } else {
      alert("All pending plans are already scheduled after the latest completion date.");
    }
  };

  const productNicknames = Array.from(new Set((data.parties || []).flatMap(p => p.products || []).map(prod => prod?.nickname).filter(Boolean)));

  // Newest *created* first — edits must not reshuffle the list
  const plansList = useMemo(() => {
    const list = (data.productionPlans || []).filter((p) => !p.isDeleted);
    const createdMillis = (item, index) => {
      const fromCreated = Date.parse(item?.createdAt);
      if (!Number.isNaN(fromCreated) && fromCreated > 0) return fromCreated;
      const idNum = Number(String(item?.id || '').match(/\d{12,}/)?.[0]);
      if (Number.isFinite(idNum) && idNum > 1e11) return idNum;
      return index;
    };
    return list
      .map((item, index) => ({ item, index, time: createdMillis(item, index) }))
      .sort((a, b) => (b.time - a.time) || (b.index - a.index))
      .map(({ item }) => item);
  }, [data.productionPlans]);
  const resolvedPlans = useMemo(
    () => plansList.map(p => resolvePlan(p, data.materialReceipts, data.parties)),
    [plansList, data.materialReceipts, data.parties]
  );
  const deliveryChallans = data.deliveryChallans || [];
  const partyOptions = useMemo(() => uniqueSortedOptions([
    ...resolvedPlans.map((p) => p.customer),
    ...(data.parties || []).map((p) => p.name)
  ]), [resolvedPlans, data.parties]);
  const productOptions = useMemo(() => uniqueSortedOptions([
    ...resolvedPlans.map((p) => p.productName),
    ...(data.parties || []).flatMap((p) => (p.products || []).map((prod) => prod.name))
  ]), [resolvedPlans, data.parties]);

  const isPlanPending = (p) => {
    if (isPlanDispatched(p, deliveryChallans)) return false;
    const s = normalizeStatus(p.status);
    return s !== 'Completed' && s !== 'Done' && s !== 'Cancel';
  };
  const isPlanDelayed = (p) => Boolean(p.delayReason && String(p.delayReason).trim());
  const isInProgress = (p) => {
    if (isPlanDispatched(p, deliveryChallans)) return false;
    return normalizeStatus(p.status) === 'In Progress';
  };
  const isCompleted = (p) => {
    if (isPlanDispatched(p, deliveryChallans)) return true;
    const s = normalizeStatus(p.status);
    return s === 'Completed' || s === 'Done';
  };
  const isOnHold = (p) => {
    const s = normalizeStatus(p.status);
    return s === 'On Hold' || s === 'Cancel';
  };

  const pendingPlans = useMemo(
    () => resolvedPlans.filter((p) => !isCompleted(p)),
    [resolvedPlans, deliveryChallans]
  );
  const completedPlans = useMemo(
    () => resolvedPlans.filter((p) => isCompleted(p)),
    [resolvedPlans, deliveryChallans]
  );
  const tabPlans = statusTab === 'completed'
    ? completedPlans
    : statusTab === 'all'
      ? resolvedPlans
      : pendingPlans;

  const summary = useMemo(() => ({
    total: resolvedPlans.length,
    inProgress: resolvedPlans.filter(isInProgress).length,
    completed: completedPlans.length,
    onHold: resolvedPlans.filter(isOnHold).length,
    delayed: resolvedPlans.filter(isPlanDelayed).length
  }), [resolvedPlans, completedPlans]);

  const filteredPlans = useMemo(() => tabPlans.filter((p) => {
    if (filters.customer && (p.customer || '') !== filters.customer) return false;
    if (filters.product && (p.productName || '') !== filters.product) return false;
    if (filters.batchNo) {
      const q = filters.batchNo.trim().toLowerCase();
      if (!(p.batchNo || '').toLowerCase().includes(q)) return false;
    }
    if (filters.status) {
      if (filters.status === 'Delayed') {
        if (!isPlanDelayed(p)) return false;
      } else if (filters.status === 'Completed' || filters.status === 'Done') {
        if (!isCompleted(p)) return false;
      } else if (normalizeStatus(p.status) !== filters.status && p.status !== filters.status) {
        return false;
      }
    }
    if (filters.priority && (p.priorityLevel || '') !== filters.priority) return false;
    if (filters.dateFrom && p.startDate && p.startDate < filters.dateFrom) return false;
    if (filters.dateTo && p.startDate && p.startDate > filters.dateTo) return false;
    return true;
  }), [tabPlans, filters, deliveryChallans]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedPlans = filteredPlans.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filters, statusTab]);

  const applySearch = () => setFilters({ ...draftFilters });
  const resetFilters = () => {
    const blank = {
      customer: '', product: '', batchNo: '', status: '', priority: '', dateFrom: '', dateTo: ''
    };
    setDraftFilters(blank);
    setFilters(blank);
    setPage(1);
  };

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

  const showCol = (key) => effectiveVisibleColumns.includes(key);
  const colCount = 2
    + (showCol('customer') ? 1 : 0)
    + (showCol('productName') ? 1 : 0)
    + (showCol('productNickName') ? 1 : 0)
    + (showCol('batchNo') ? 1 : 0)
    + (showCol('qty') ? 1 : 0)
    + (showCol('psdReq') ? 1 : 0)
    + (showCol('psdNote') ? 1 : 0)
    + (showCol('specialInstructions') ? 1 : 0)
    + (showCol('startDate') ? 1 : 0)
    + (showCol('endDate') ? 1 : 0)
    + (showCol('status') ? 1 : 0)
    + (showCol('priorityLevel') ? 1 : 0)
    + 1;

  const trunc = (text, n = 42) => {
    const t = String(text || '').trim();
    if (!t) return '—';
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Production Planning</h1>
          <p className="page-subtitle">Schedule milling batches and track processing. Dispatched jobs leave this list automatically.</p>
        </div>
        <div className="page-toolbar" style={{ flex: '1 1 520px', justifyContent: 'flex-end', minWidth: 0 }}>
          <ExportButton
            data={filteredPlans.map((p) => ({
              ...p,
              startDate: formatDateAndTime(p.startDate, p.startTime) || p.startDate || '',
              endDate: formatDateAndTime(p.endDate, p.endTime) || p.endDate || ''
            }))}
            columns={visibleExportColumns}
            filename="Production_Plan"
            title="Production Plan Report"
          />
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

      <div className="premium-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Customer</label>
            <SearchableSelect className="input-field" value={draftFilters.customer} onChange={(e) => setDraftFilters((f) => ({ ...f, customer: e.target.value }))}>
              <option value="">All Customers</option>
              {partyOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </SearchableSelect>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Product</label>
            <SearchableSelect className="input-field" value={draftFilters.product} onChange={(e) => setDraftFilters((f) => ({ ...f, product: e.target.value }))}>
              <option value="">All Products</option>
              {productOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </SearchableSelect>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Batch Number</label>
            <input className="input-field" placeholder="Batch no." value={draftFilters.batchNo} onChange={(e) => setDraftFilters((f) => ({ ...f, batchNo: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status</label>
            <SearchableSelect className="input-field" value={draftFilters.status} onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Delayed">Delayed</option>
              <option value="Cancel">Cancel</option>
            </SearchableSelect>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Priority</label>
            <SearchableSelect className="input-field" value={draftFilters.priority} onChange={(e) => setDraftFilters((f) => ({ ...f, priority: e.target.value }))}>
              <option value="">All</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
              <option value="Super Urgent">Super Urgent</option>
            </SearchableSelect>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>From Date</label>
            <DateField className="input-field" value={draftFilters.dateFrom} onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>To Date</label>
            <DateField className="input-field" value={draftFilters.dateTo} onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={applySearch} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Search size={15} /> Search
            </button>
            <button type="button" className="btn" onClick={resetFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Total Batches" value={summary.total} icon={Layers} color="#7c3aed" bg="rgba(124, 58, 237, 0.12)" />
        <StatCard label="In Progress" value={summary.inProgress} icon={PlayCircle} color="#2563eb" bg="rgba(37, 99, 235, 0.12)" />
        <StatCard label="Completed" value={summary.completed} icon={CheckCircle2} color="#059669" bg="rgba(5, 150, 105, 0.12)" />
        <StatCard label="On Hold" value={summary.onHold} icon={PauseCircle} color="#ea580c" bg="rgba(234, 88, 12, 0.12)" />
        <StatCard label="Delayed" value={summary.delayed} icon={AlertTriangle} color="#dc2626" bg="rgba(220, 38, 38, 0.12)" />
      </div>

      <StatusTabBar
        value={statusTab}
        onChange={setStatusTab}
        allCount={resolvedPlans.length}
        pendingCount={pendingPlans.length}
        completedCount={completedPlans.length}
      />

      <div className="premium-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {statusTab === 'completed' ? 'Completed Plans' : statusTab === 'all' ? 'All Plans' : 'Pending Plans'}
          </h3>
        </div>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Sr.</th>
                {showCol('customer') && <th>Customer</th>}
                {showCol('productName') && <th>Product Name</th>}
                {showCol('productNickName') && <th>Product Nickname</th>}
                {showCol('batchNo') && <th>Batch Number</th>}
                {showCol('qty') && <th>Qty</th>}
                {showCol('psdReq') && <th>PSD Requirement</th>}
                {showCol('psdNote') && <th>PSD Note</th>}
                {showCol('specialInstructions') && <th>Special Notes</th>}
                {showCol('startDate') && <th>Processing Start</th>}
                {showCol('endDate') && <th>Completion Date</th>}
                {showCol('status') && <th>Status</th>}
                {showCol('priorityLevel') && <th>Priority</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedPlans.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {statusTab === 'completed'
                      ? 'No completed plans yet. Generate a DC or mark a plan as Done / Completed to move it here.'
                      : 'No production plans match these filters.'}
                  </td>
                </tr>
              ) : pagedPlans.map((plan, idx) => {
                const open = expandedId === plan.id;
                const displayStatus = isPlanDispatched(plan, deliveryChallans)
                  ? 'Completed'
                  : (isPlanDelayed(plan) && !isCompleted(plan)
                    ? (normalizeStatus(plan.status) === 'Pending' ? 'Pending' : normalizeStatus(plan.status))
                    : normalizeStatus(plan.status));
                return (
                  <React.Fragment key={plan.id}>
                    <tr style={{ background: open ? 'rgba(155, 98, 196, 0.04)' : undefined }}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : plan.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', padding: 2 }}
                          title={open ? 'Hide details' : 'Show details'}
                        >
                          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td>{pageStart + idx + 1}</td>
                      {showCol('customer') && <td style={{ fontWeight: 600 }}>{plan.customer || '—'}</td>}
                      {showCol('productName') && <td>{plan.productName || '—'}</td>}
                      {showCol('productNickName') && <td>{plan.productNickName || '—'}</td>}
                      {showCol('batchNo') && (
                        <td>
                          <button
                            type="button"
                            onClick={() => setViewPlan(plan)}
                            style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                          >
                            {plan.batchNo || '—'}
                          </button>
                        </td>
                      )}
                      {showCol('qty') && <td>{plan.qty || '—'}</td>}
                      {showCol('psdReq') && <td>{plan.psdReq || '—'}</td>}
                      {showCol('psdNote') && <td title={plan.psdNote || ''}>{trunc(plan.psdNote)}</td>}
                      {showCol('specialInstructions') && <td title={plan.specialInstructions || ''}>{trunc(plan.specialInstructions)}</td>}
                      {showCol('startDate') && (
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                          {plan.startDate ? formatDateAndTime(plan.startDate, plan.startTime) : '—'}
                        </td>
                      )}
                      {showCol('endDate') && (
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                          {plan.endDate ? formatDateAndTime(plan.endDate, plan.endTime) : '—'}
                        </td>
                      )}
                      {showCol('status') && (
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.65rem',
                            borderRadius: 999,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            ...statusPillStyle(displayStatus)
                          }}>
                            {displayStatus}
                          </span>
                          {isPlanDelayed(plan) && (
                            <span style={{
                              display: 'inline-block',
                              marginLeft: 6,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 999,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: 'rgba(220, 38, 38, 0.12)',
                              color: '#dc2626'
                            }}>
                              Delayed
                            </span>
                          )}
                        </td>
                      )}
                      {showCol('priorityLevel') && (
                        <td>
                          {plan.priorityLevel ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.65rem',
                              borderRadius: 999,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              ...priorityPillStyle(plan.priorityLevel)
                            }}>
                              {plan.priorityLevel}
                            </span>
                          ) : '—'}
                        </td>
                      )}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 72 }}>
                          <button type="button" className="btn" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setViewPlan(plan)}>
                            <Eye size={12} /> View
                          </button>
                          {userRole === 'Admin' && (
                            <button type="button" className="btn" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => handleEdit(plan)}>
                              <Edit2 size={12} /> Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={colCount} style={{ background: 'rgba(155, 98, 196, 0.06)', padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#5b1c85', marginBottom: '0.55rem', fontSize: '0.82rem' }}>Additional Details</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem 1.25rem', fontSize: '0.82rem' }}>
                            <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>PSD Requirement: </span>{plan.psdReq || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>PSD Note: </span>{plan.psdNote || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Special Notes: </span>{plan.specialInstructions || '—'}</div>
                            {plan.delayReason?.trim() && (
                              <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Delay Reason: </span>{plan.delayReason}</div>
                            )}
                            {plan.supervisor && (
                              <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Supervisor: </span>{plan.supervisor}</div>
                            )}
                            {plan.hours && (
                              <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Hours: </span>{plan.hours}</div>
                            )}
                          </div>
                          {userRole === 'Admin' && isPlanPending(plan) && plan.delayReason?.trim() && (
                            <button type="button" className="btn" style={{ marginTop: '0.75rem', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleCarryForwardForPlan(plan)}>
                              <Clock size={12} /> Carry Forward Queue
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.85rem 0.25rem 0.15rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filteredPlans.length === 0
              ? 'Showing 0 records'
              : `Showing ${pageStart + 1} to ${Math.min(pageStart + PAGE_SIZE, filteredPlans.length)} of ${filteredPlans.length} records`}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setPage(1)} style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}>First</button>
            <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}>Prev</button>
            <span style={{ padding: '0.3rem 0.7rem', borderRadius: 6, background: '#5b1c85', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>{safePage}</span>
            <button type="button" className="btn" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}>Next</button>
            <button type="button" className="btn" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}>Last</button>
          </div>
        </div>
      </div>

      {viewPlan && (
        <div className="page-form-overlay" onClick={() => setViewPlan(null)}>
          <div className="premium-card" style={{ width: 560, maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Plan Details — {viewPlan.batchNo || viewPlan.productName || 'Batch'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem', fontSize: '0.88rem' }}>
              <div><strong>Customer</strong><div>{viewPlan.customer || '—'}</div></div>
              <div><strong>Product</strong><div>{viewPlan.productName || '—'}</div></div>
              <div><strong>Nickname</strong><div>{viewPlan.productNickName || '—'}</div></div>
              <div><strong>Qty</strong><div>{viewPlan.qty || '—'}</div></div>
              <div><strong>Status</strong><div>{isPlanDispatched(viewPlan, deliveryChallans) ? 'Completed' : normalizeStatus(viewPlan.status)}</div></div>
              <div><strong>Priority</strong><div>{viewPlan.priorityLevel || '—'}</div></div>
              <div style={{ gridColumn: 'span 2' }}><strong>PSD Requirement</strong><div>{viewPlan.psdReq || '—'}</div></div>
              <div style={{ gridColumn: 'span 2' }}><strong>PSD Note</strong><div>{viewPlan.psdNote || '—'}</div></div>
              <div style={{ gridColumn: 'span 2' }}><strong>Special Notes</strong><div>{viewPlan.specialInstructions || '—'}</div></div>
              <div><strong>Processing Start</strong><div>{viewPlan.startDate ? formatDateAndTime(viewPlan.startDate, viewPlan.startTime) : '—'}</div></div>
              <div><strong>Completion</strong><div>{viewPlan.endDate ? formatDateAndTime(viewPlan.endDate, viewPlan.endTime) : '—'}</div></div>
              {viewPlan.delayReason?.trim() && (
                <div style={{ gridColumn: 'span 2' }}><strong>Delay Reason</strong><div>{viewPlan.delayReason}</div></div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn" onClick={() => setViewPlan(null)}>Close</button>
              {userRole === 'Admin' && (
                <button type="button" className="btn btn-primary" onClick={() => { setViewPlan(null); handleEdit(viewPlan); }}>Edit</button>
              )}
            </div>
          </div>
        </div>
      )}

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
                    <option value="On Hold">On Hold</option>
                    <option value="Done">Done / Completed</option>
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
