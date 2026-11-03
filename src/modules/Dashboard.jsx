import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee,
  Factory,
  ClipboardList,
  FlaskConical,
  Truck,
  Eye,
  ArrowRight,
  TrendingUp,
  Users,
  Package,
  Activity,
  Sparkles
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import DateField from '../components/DateField';
import { formatDate, formatTime, newestFirst } from '../utils/dateUtils';
import { uniqueSortedOptions } from '../components/ListFilterBar';

const PURPLE = '#5b1c85';

const toDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Prefer YYYY-MM-DD local noon to avoid UTC day-shift
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Best available document date for dashboard filtering. */
const docDateValue = (doc) =>
  doc?.date
  || doc?.invoiceDate
  || doc?.dcDate
  || doc?.plDate
  || (typeof doc?.createdAt === 'string' ? doc.createdAt.slice(0, 10) : '')
  || '';

const invoiceAmount = (inv) =>
  parseFloat(inv?.total)
  || parseFloat(inv?.grandTotal)
  || parseFloat(inv?.netAmount)
  || parseFloat(inv?.amount)
  || parseFloat(inv?.subtotal)
  || 0;

const isTaxInvoiceDoc = (inv) => {
  if (!inv || inv.isDeleted) return false;
  const no = String(inv.invoiceNo || inv.docNo || '');
  if (no.includes('/PI/') || inv.docType === 'PI' || inv.type === 'proforma') return false;
  if (no.includes('/IN/') || /\/TI\//i.test(no)) return true;
  if (inv.docType === 'TI' || inv.type === 'tax' || inv.kind === 'taxInvoice') return true;
  // Legacy records sometimes omit /IN/ — count if total exists and not marked PI
  return Boolean(no) && invoiceAmount(inv) > 0;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const inRange = (dateStr, from, to) => {
  const d = toDate(dateStr);
  if (!d) return false;
  if (from && d < startOfDay(from)) return false;
  if (to && d > endOfDay(to)) return false;
  return true;
};

const daysBetween = (from, to) => {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
};

const shiftRange = (from, to, direction = -1) => {
  const len = daysBetween(from, to);
  const nextTo = new Date(startOfDay(from));
  nextTo.setDate(nextTo.getDate() + direction);
  const nextFrom = new Date(nextTo);
  nextFrom.setDate(nextFrom.getDate() - (len - 1) * (direction < 0 ? 1 : -1));
  if (direction < 0) {
    const end = new Date(startOfDay(from));
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - (len - 1));
    return { from: start, to: end };
  }
  return { from: nextFrom, to: nextTo };
};

const money = (n) =>
  `₹ ${Math.round(parseFloat(n) || 0).toLocaleString('en-IN')}`;

const pctChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
};

const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

const StatusDot = ({ tone }) => (
  <span className={`dash-att-dot dash-att-dot--${tone}`} />
);

const StatusPill = ({ status }) => {
  const key = String(status || 'Pending').toLowerCase().replace(/\s+/g, '-');
  const map = {
    'in-progress': 'in-process',
    planned: 'pending',
    completed: 'completed',
    done: 'completed',
    present: 'completed',
    late: 'in-process',
    absent: 'absent'
  };
  return <span className={`dash-status ${map[key] || 'pending'}`}>{status || 'Pending'}</span>;
};

const Panel = ({ title, actionLabel = 'View All', onAction, children, className = '' }) => (
  <div className={`premium-card dash-card ${className}`.trim()}>
    <div className="dash-card-head">
      <h3>{title}</h3>
      {onAction && (
        <button type="button" className="dash-link" onClick={onAction}>
          {actionLabel} <ArrowRight size={14} />
        </button>
      )}
    </div>
    {children}
    </div>
  );

const Dashboard = () => {
  const { data } = useAppContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const monthEnd = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 1, 0), [today]);
  const toLocalYmd = (d) => {
    const x = d instanceof Date ? d : new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const [rangeFrom, setRangeFrom] = useState(() => toLocalYmd(monthStart));
  const [rangeTo, setRangeTo] = useState(() => toLocalYmd(monthEnd));
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const displayName = currentUser?.name || currentUser?.username || 'Admin';

  const partyOptions = useMemo(
    () => uniqueSortedOptions((data.parties || []).filter((p) => !p.isDeleted).map((p) => p.name)),
    [data.parties]
  );

  const productOptions = useMemo(() => {
    const names = [];
    (data.parties || []).forEach((p) => {
      (p.products || []).forEach((prod) => {
        if (prod?.name) names.push(prod.name);
      });
    });
    (data.materialReceipts || []).forEach((mr) => {
      if (mr.productName) names.push(mr.productName);
      (mr.productSummaries || []).forEach((s) => {
        if (s.prodName || s.productName) names.push(s.prodName || s.productName);
      });
    });
    return uniqueSortedOptions(names);
  }, [data.parties, data.materialReceipts]);

  const matchParty = (name) => !partyFilter || String(name || '').trim() === partyFilter;
  const matchProduct = (name) =>
    !productFilter
    || String(name || '').toLowerCase().includes(String(productFilter).toLowerCase());

  const filterFrom = useMemo(() => toDate(rangeFrom) || monthStart, [rangeFrom, monthStart]);
  const filterTo = useMemo(() => toDate(rangeTo) || monthEnd, [rangeTo, monthEnd]);
  const prevFilter = useMemo(() => shiftRange(filterFrom, filterTo, -1), [filterFrom, filterTo]);

  const matchesDoc = (doc, from, to) => {
    if (!doc || doc.isDeleted) return false;
    if (!inRange(docDateValue(doc), from, to)) return false;
    const partyName = doc.partyName || doc.customer || doc.customerName || '';
    const productName = doc.productName || doc.product || '';
    return matchParty(partyName) && matchProduct(productName);
  };

  const taxInvoices = useMemo(
    () => (data.invoices || []).filter(isTaxInvoiceDoc),
    [data.invoices]
  );

  const mrsById = useMemo(() => {
    const map = new Map();
    (data.materialReceipts || []).forEach((mr) => {
      if (mr?.id) map.set(String(mr.id), mr);
    });
    return map;
  }, [data.materialReceipts]);

  const bprProcessValue = (bprList) => {
    let invoiceSum = 0;
    let netKg = 0;
    let mrValue = 0;
    const receiptIds = new Set();
    (bprList || []).forEach((b) => {
      netKg += parseFloat(b.totalDispatchedNet) || parseFloat(b.totalInputQty) || 0;
      if (b.receiptId) receiptIds.add(String(b.receiptId));
    });
    taxInvoices.forEach((inv) => {
      if (inv.receiptId && receiptIds.has(String(inv.receiptId))) {
        invoiceSum += invoiceAmount(inv);
      }
    });
    if (invoiceSum > 0) return invoiceSum;
    receiptIds.forEach((id) => {
      const mr = mrsById.get(id);
      if (!mr) return;
      const v = parseFloat(mr.value);
      if (Number.isFinite(v) && v > 0) mrValue += v;
      else {
        Object.values(mr.productSettings || {}).forEach((s) => {
          const pv = parseFloat(s?.value);
          if (Number.isFinite(pv) && pv > 0) mrValue += pv;
        });
      }
    });
    if (mrValue > 0) return mrValue;
    // Fallback: show processed kg as numeric value (not fake ₹ rate)
    return netKg;
  };

  const salesNow = useMemo(
    () => taxInvoices.filter((inv) => matchesDoc(inv, filterFrom, filterTo)).reduce((s, inv) => s + invoiceAmount(inv), 0),
    [taxInvoices, filterFrom, filterTo, partyFilter, productFilter]
  );
  const salesPrev = useMemo(
    () => taxInvoices.filter((inv) => matchesDoc(inv, prevFilter.from, prevFilter.to)).reduce((s, inv) => s + invoiceAmount(inv), 0),
    [taxInvoices, prevFilter, partyFilter, productFilter]
  );

  const bprsNow = useMemo(
    () => (data.bprs || []).filter((b) => matchesDoc(b, filterFrom, filterTo)),
    [data.bprs, filterFrom, filterTo, partyFilter, productFilter]
  );
  const bprsPrev = useMemo(
    () => (data.bprs || []).filter((b) => matchesDoc(b, prevFilter.from, prevFilter.to)),
    [data.bprs, prevFilter, partyFilter, productFilter]
  );
  const bprValueNow = useMemo(() => bprProcessValue(bprsNow), [bprsNow, taxInvoices, mrsById]);
  const bprValuePrev = useMemo(() => bprProcessValue(bprsPrev), [bprsPrev, taxInvoices, mrsById]);
  const bprIsMoney = useMemo(() => {
    // Money when invoices or MR declared value contributed; otherwise value is kg
    let hasMoney = false;
    const receiptIds = new Set(bprsNow.map((b) => b.receiptId).filter(Boolean).map(String));
    if (taxInvoices.some((inv) => inv.receiptId && receiptIds.has(String(inv.receiptId)) && invoiceAmount(inv) > 0)) {
      hasMoney = true;
    } else {
      receiptIds.forEach((id) => {
        const mr = mrsById.get(id);
        if (!mr) return;
        if (parseFloat(mr.value) > 0) hasMoney = true;
        Object.values(mr.productSettings || {}).forEach((s) => {
          if (parseFloat(s?.value) > 0) hasMoney = true;
        });
      });
    }
    return hasMoney;
  }, [bprsNow, taxInvoices, mrsById]);

  const packingNow = useMemo(
    () => (data.packingLists || []).filter((p) => matchesDoc(p, filterFrom, filterTo)),
    [data.packingLists, filterFrom, filterTo, partyFilter, productFilter]
  );
  const packingPrev = useMemo(
    () => (data.packingLists || []).filter((p) => matchesDoc(p, prevFilter.from, prevFilter.to)),
    [data.packingLists, prevFilter, partyFilter, productFilter]
  );

  const psdNow = useMemo(
    () => (data.psds || []).filter((p) => matchesDoc(p, filterFrom, filterTo)),
    [data.psds, filterFrom, filterTo, partyFilter, productFilter]
  );
  const psdPrev = useMemo(
    () => (data.psds || []).filter((p) => matchesDoc(p, prevFilter.from, prevFilter.to)),
    [data.psds, prevFilter, partyFilter, productFilter]
  );

  const dcNow = useMemo(
    () => (data.deliveryChallans || []).filter((d) => matchesDoc(d, filterFrom, filterTo)),
    [data.deliveryChallans, filterFrom, filterTo, partyFilter, productFilter]
  );

  const kpis = [
    {
      title: 'Total Sales',
      value: money(salesNow),
      delta: pctChange(salesNow, salesPrev),
      deltaLabel: 'vs prior period',
      icon: IndianRupee,
      path: '/tax-invoice',
      tone: 'purple'
    },
    {
      title: 'BPR Processing',
      value: bprIsMoney ? money(bprValueNow) : `${Math.round(bprValueNow).toLocaleString('en-IN')} Kg`,
      delta: pctChange(bprValueNow, bprValuePrev),
      deltaLabel: `${bprsNow.length} BPR · vs prior`,
      icon: Factory,
      path: '/bpr',
      tone: 'violet'
    },
    {
      title: 'Packing List',
      value: String(packingNow.length),
      delta: pctChange(packingNow.length, packingPrev.length),
      deltaLabel: 'vs prior period',
      icon: ClipboardList,
      path: '/packing-list',
      tone: 'blue'
    },
    {
      title: 'PSD Record',
      value: String(psdNow.length),
      delta: pctChange(psdNow.length, psdPrev.length),
      deltaLabel: 'vs prior period',
      icon: FlaskConical,
      path: '/psd',
      tone: 'teal'
    },
    {
      title: 'Dispatches',
      value: String(packingNow.length + dcNow.length),
      deltaLabel: `${packingNow.length} PL, ${dcNow.length} DC`,
      icon: Truck,
      path: '/dc',
      tone: 'orange',
      hideTrend: true
    }
  ];

  const productionRows = useMemo(() => {
    const plans = newestFirst((data.productionPlans || []).filter((p) => !p.isDeleted));
    return plans
      .filter((p) => matchParty(p.customer || p.partyName) && matchProduct(p.productName || p.product))
      .slice(0, 6)
      .map((p, idx) => {
        const statusRaw = String(p.status || '').trim();
        let status = 'Planned';
        if (/done|complete/i.test(statusRaw)) status = 'Completed';
        else if (statusRaw && !/cancel/i.test(statusRaw)) status = 'In Progress';
        return {
          id: p.id || `plan-${idx}`,
          bprNo: p.batchNo || p.planNo || p.bprNo || '—',
          product: p.productName || p.product || '—',
          qty: p.qty ? `${p.qty} Drums` : '—',
          status
        };
      });
  }, [data.productionPlans, partyFilter, productFilter]);

  const attendanceRows = useMemo(() => {
    const todayIso = today.toISOString().slice(0, 10);
    const rows = (data.attendance || []).filter((a) => !a.isDeleted && a.date === todayIso);
    const source = rows.length
      ? rows
      : (data.users || [])
        .filter((u) => u.active !== false && u.role !== 'Admin')
        .slice(0, 6)
        .map((u) => ({
          id: u.id,
          employeeName: u.name || u.username,
          shiftType: u.shiftType || '9hr',
          status: '—'
        }));
    return source.slice(0, 6).map((row) => {
      const status = String(row.status || row.attendance || 'Present');
      let tone = 'present';
      if (/late/i.test(status)) tone = 'late';
      else if (/absent/i.test(status)) tone = 'absent';
      else if (status === '—') tone = 'pending';
      const shift = row.shiftType === '12hr' || /night|12/i.test(row.shift || '')
        ? 'Night 12 hrs'
        : (row.shift || 'Day 9 hrs');
      return {
        id: row.id || row.userId || row.employeeName,
        name: row.employeeName || row.name || row.username || '—',
        shift,
        status: status === '—' ? 'Pending' : status,
        tone
      };
    });
  }, [data.attendance, data.users, today]);

  const dispatchRows = useMemo(() => {
    const rows = [
      ...dcNow.map((d) => ({
        id: `dc-${d.id}`,
        party: d.partyName || '—',
        product: d.productName || '—',
        qty: d.qty != null ? `${Number(d.qty).toLocaleString('en-IN')} kg` : '—',
        date: formatDate(docDateValue(d)) || '—'
      })),
      ...packingNow.map((p) => ({
        id: `pl-${p.id}`,
        party: p.partyName || '—',
        product: p.productName || '—',
        qty: p.totalWeight != null
          ? `${Number(p.totalWeight).toLocaleString('en-IN')} kg`
          : (p.qty != null ? `${Number(p.qty).toLocaleString('en-IN')} kg` : '—'),
        date: formatDate(docDateValue(p)) || '—'
      }))
    ];
    return rows.slice(0, 6);
  }, [dcNow, packingNow]);

  const recentActivity = useMemo(() => {
    const logs = newestFirst(data.auditLogs || []).slice(0, 8);
    return logs.map((log) => {
      const ts = toDate(log.timestamp || log.createdAt);
      const time = ts ? formatTime(ts) : '—';
      const action = log.action || 'UPDATE';
      const module = log.module || 'Record';
      const label = action === 'CREATE'
        ? `Created ${module}`
        : action === 'UPDATE'
          ? `Updated ${module}`
          : action === 'DELETE'
            ? `Deleted ${module}`
            : `${action} ${module}`;
      const docId = log.refNo || log.newValue?.quotationNo || log.newValue?.invoiceNo
        || log.newValue?.dcNo || log.newValue?.bprNo || log.newValue?.receiptNo
        || log.details || '—';
      return {
        id: log.id || `${time}-${label}`,
        time,
        user: log.user || log.username || 'System',
        activity: label,
        docId: String(docId).slice(0, 28)
      };
    });
  }, [data.auditLogs]);

  const customers = (data.parties || []).filter((p) => !p.isDeleted).length;
  const products = productOptions.length;
  const filteredRangeLabel = `${formatDate(rangeFrom) || rangeFrom} - ${formatDate(rangeTo) || rangeTo}`;
  const kpiCards = kpis;

  return (
    <div className="dash-page dash-page--admin">
      <header className="dash-welcome">
        <div>
          <h1 className="dash-welcome-title">Welcome, {displayName}</h1>
          <p className="dash-welcome-sub">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <div className="dash-filters">
          <div className="dash-filter">
            <span className="dash-filter-label">Date Range</span>
            <div className="dash-filter-dates">
              <DateField className="input-field" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              <span>–</span>
              <DateField className="input-field" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            </div>
          </div>
          <div className="dash-filter">
            <span className="dash-filter-label">Party</span>
            <SearchableSelect
              className="input-field"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              placeholder="All Parties"
              remember={false}
            >
              <option value="">All Parties</option>
              {partyOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </SearchableSelect>
          </div>
          <div className="dash-filter">
            <span className="dash-filter-label">Products</span>
            <SearchableSelect
              className="input-field"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              placeholder="All Products"
              remember={false}
            >
              <option value="">All Products</option>
              {productOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </SearchableSelect>
          </div>
        </div>
      </header>

      <p className="dash-range-hint">Showing {filteredRangeLabel}</p>

      <div className="dash-kpi-grid">
        {kpiCards.map((kpi) => (
          <button
            key={kpi.title}
            type="button"
            className={`dash-kpi dash-kpi--${kpi.tone}`}
            onClick={() => kpi.path && navigate(kpi.path)}
          >
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">{kpi.title}</span>
              <span className="dash-kpi-icon">
                <kpi.icon size={18} />
              </span>
            </div>
            <span className="dash-kpi-value">{kpi.value}</span>
            <span className={`dash-kpi-sub ${kpi.hideTrend ? '' : (kpi.delta >= 0 ? 'up' : 'down')}`}>
              {!kpi.hideTrend && (
                <>
                  <TrendingUp size={12} style={{ transform: kpi.delta < 0 ? 'rotate(180deg)' : undefined }} />
                  {Math.abs(kpi.delta)}% {kpi.deltaLabel}
                </>
              )}
              {kpi.hideTrend && kpi.deltaLabel}
            </span>
          </button>
        ))}
      </div>

      <div className="dash-mid-grid dash-mid-grid--3">
        <Panel title="Production Planning" onAction={() => navigate('/production-planning')}>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Sr. No</th>
                  <th>BPR No.</th>
                  <th>Product</th>
                  <th>Planned Qty</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {productionRows.length === 0 ? (
                  <tr><td colSpan={6} className="dash-empty">No production plans yet.</td></tr>
                ) : productionRows.map((row, idx) => (
                  <tr key={row.id} onClick={() => navigate('/production-planning')}>
                    <td>{idx + 1}</td>
                    <td className="dash-strong">{row.bprNo}</td>
                    <td>{row.product}</td>
                    <td>{row.qty}</td>
                    <td><StatusPill status={row.status} /></td>
                    <td>
                      <button type="button" className="dash-icon-btn" title="View" onClick={(e) => { e.stopPropagation(); navigate('/production-planning'); }}>
                        <Eye size={15} />
            </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Employee Attendance" onAction={() => navigate('/attendance')} actionLabel="View Details">
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Sr. No</th>
                  <th>Name</th>
                  <th>Shift</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.length === 0 ? (
                  <tr><td colSpan={4} className="dash-empty">No attendance for today.</td></tr>
                ) : attendanceRows.map((row, idx) => (
                  <tr key={row.id} onClick={() => navigate('/attendance')}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className="dash-person">
                        <span className="dash-avatar">{initials(row.name)}</span>
                        <span>{row.name}</span>
                      </div>
                    </td>
                    <td>{row.shift}</td>
                    <td>
                      <span className="dash-att-status">
                        <StatusDot tone={row.tone} />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Dispatches for the Week" onAction={() => navigate('/dc')}>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Sr. No</th>
                  <th>Party</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Dispatch Date</th>
                </tr>
              </thead>
              <tbody>
                {dispatchRows.length === 0 ? (
                  <tr><td colSpan={5} className="dash-empty">No dispatches this week.</td></tr>
                ) : dispatchRows.map((row, idx) => (
                  <tr key={row.id} onClick={() => navigate('/dc')}>
                    <td>{idx + 1}</td>
                    <td className="dash-strong">{row.party}</td>
                    <td>{row.product}</td>
                    <td>{row.qty}</td>
                    <td>{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        </div>

      <div className="dash-bottom-grid dash-bottom-grid--2">
        <Panel title="Recent Activity" onAction={() => navigate('/system-logs')} actionLabel="View All">
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Sr. No</th>
                  <th>Time</th>
                  <th>User</th>
                  <th>Activity</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.length === 0 ? (
                  <tr><td colSpan={5} className="dash-empty">No recent activity.</td></tr>
                ) : recentActivity.map((row, idx) => (
                  <tr key={row.id}>
                    <td>{idx + 1}</td>
                    <td>{row.time}</td>
                    <td>{row.user}</td>
                    <td>{row.activity}</td>
                    <td className="dash-strong">{row.docId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Company Highlights" className="dash-highlights-card">
          <div className="dash-highlights">
            <div className="dash-highlight">
              <Users size={18} />
              <div>
                <span className="dash-highlight-label">Total Customers</span>
                <strong>{customers}</strong>
                  </div>
            </div>
            <div className="dash-highlight">
              <Package size={18} />
              <div>
                <span className="dash-highlight-label">Total Products</span>
                <strong>{products}</strong>
          </div>
        </div>
            <div className="dash-highlight">
              <Factory size={18} />
              <div>
                <span className="dash-highlight-label">Processing Capacity</span>
                <strong>300 MT / Month</strong>
      </div>
          </div>
            <div className="dash-highlight">
              <Activity size={18} />
              <div>
                <span className="dash-highlight-label">Factory Uptime</span>
                <strong>98%</strong>
          </div>
        </div>
          </div>
          <div className="dash-banner">
            <Sparkles size={16} />
            Let&apos;s achieve more together.
          </div>
        </Panel>
      </div>

      <footer className="dash-footer">
        <span>© {new Date().getFullYear()} UMA MICRON — Micronization of API&apos;s</span>
        <span>Version 1.0</span>
      </footer>
    </div>
  );
};

export default Dashboard;
