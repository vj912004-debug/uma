import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  Package,
  Users,
  DollarSign,
  FileText,
  Truck,
  MessageSquarePlus,
  ClipboardList,
  ShoppingCart,
  Activity,
  PlusSquare,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildUnderProcessRows, getProductQty, receiptProductOptions } from '../utils/receiptProducts';
import { listProcessingSheetDueRows } from '../utils/paymentTotals';
import { getCurrentFYKey, getFYOfDate } from '../utils/financialYear';

const PURPLE = '#5b1c85';
const PURPLE_SOFT = '#9333ea';

const inCurrentMonth = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const weekOfMonth = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.min(4, Math.ceil(d.getDate() / 7));
};

const StatCard = ({ title, value, icon: Icon, iconBg, iconColor, subtext, subtextColor, path }) => {
  const navigate = useNavigate();
  return (
    <div className="dash-kpi" onClick={() => path && navigate(path)} style={{ cursor: path ? 'pointer' : 'default' }}>
      <div className="dash-kpi-icon" style={{ background: iconBg, color: iconColor }}>
        <Icon size={20} />
      </div>
      <div className="dash-kpi-body">
        <span className="dash-kpi-label">{title}</span>
        <span className="dash-kpi-value">{value}</span>
        <span className="dash-kpi-sub" style={{ color: subtextColor || 'var(--text-muted)' }}>{subtext}</span>
      </div>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const map = {
    'In Process': 'in-process',
    Completed: 'completed',
    Dispatched: 'dispatched',
    Pending: 'pending'
  };
  return <span className={`dash-status ${map[status] || 'pending'}`}>{status}</span>;
};

const DonutChart = ({ segments, total }) => {
  const size = 148;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="dash-donut">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={stroke} />
      {segments.map((seg) => {
        const len = total > 0 ? (seg.value / total) * c : 0;
        const el = (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      <text x="50%" y="48%" textAnchor="middle" className="dash-donut-total">{total}</text>
      <text x="50%" y="60%" textAnchor="middle" className="dash-donut-caption">Total</text>
    </svg>
  );
};

const LineChart = ({ points }) => {
  const w = 320;
  const h = 160;
  const pad = { t: 16, r: 12, b: 28, l: 28 };
  const maxY = Math.max(10, ...points.map((p) => p.y));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const coords = points.map((p, i) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad.t + innerH - (p.y / maxY) * innerH;
    return { x, y, ...p };
  });
  const line = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x},${pad.t + innerH} L${coords[0].x},${pad.t + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dash-line-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dashLineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PURPLE} stopOpacity="0.22" />
          <stop offset="100%" stopColor={PURPLE} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const y = pad.t + innerH * (1 - t);
        return <line key={t} x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="#eef0f4" strokeWidth="1" />;
      })}
      <path d={area} fill="url(#dashLineFill)" />
      <path d={line} fill="none" stroke={PURPLE} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r="4" fill="#fff" stroke={PURPLE} strokeWidth="2" />
      ))}
      {coords.map((p) => (
        <text key={`${p.label}-x`} x={p.x} y={h - 8} textAnchor="middle" className="dash-axis-label">{p.label}</text>
      ))}
    </svg>
  );
};

const BarChart = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="dash-bars">
      {rows.map((row) => (
        <div key={row.label} className="dash-bar-row">
          <span className="dash-bar-label" title={row.label}>{row.label}</span>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <span className="dash-bar-value">{row.value.toLocaleString('en-IN')} kg</span>
        </div>
      ))}
    </div>
  );
};

const resolveJobStatus = (row, data) => {
  const { mr, productName } = row;
  const dc = (data.deliveryChallans || []).find((d) => d.receiptId === mr.id && (!productName || d.productName === productName || String(d.productName || '').includes(productName)));
  const ti = (data.invoices || []).find((inv) => inv.receiptId === mr.id && inv.type === 'Tax Invoice' && !inv.isDeleted);
  const pl = (data.packingLists || []).find((p) => p.receiptId === mr.id);
  if (dc || ti) return 'Dispatched';
  if (pl) return 'Completed';
  return 'In Process';
};

const Dashboard = () => {
  const { data } = useAppContext();
  const navigate = useNavigate();
  const currentFY = useMemo(() => getCurrentFYKey(), []);

  const allRows = useMemo(
    () => buildUnderProcessRows(data.materialReceipts || [], data).map((row) => ({
      ...row,
      prodOpts: receiptProductOptions(row.mr, data),
      status: resolveJobStatus(row, data)
    })),
    [data]
  );

  const activeRows = useMemo(
    () => allRows.filter((row) => {
      const pi = (data.invoices || []).find((inv) => inv.receiptId === row.mr.id && inv.invoiceNo?.includes('/PI/'));
      const bpr = (data.bprs || []).find((b) => b.receiptId === row.mr.id && b.productName === row.productName);
      const psd = (data.psds || []).find((p) => p.receiptId === row.mr.id && p.productName === row.productName);
      const pl = (data.packingLists || []).find((p) => p.receiptId === row.mr.id && p.productName === row.productName);
      const dc = (data.deliveryChallans || []).find((d) => d.receiptId === row.mr.id && d.productName === row.productName);
      const ti = (data.invoices || []).find((inv) => inv.receiptId === row.mr.id && inv.invoiceNo?.includes('/IN/') && inv.productName === row.productName);
      return !(pi && bpr && psd && pl && dc && ti);
    }),
    [allRows, data]
  );

  const totalOutstanding = useMemo(() => listProcessingSheetDueRows(data).reduce((sum, row) => {
    if (getFYOfDate(row.fyDate) !== currentFY) return sum;
    return sum + (parseFloat(row.outstanding) || 0);
  }, 0), [data, currentFY]);

  const partiesCount = (data.parties || []).filter((p) => !p.isDeleted).length;
  const inquiriesThisMonth = (data.quotations || []).filter((q) => !q.isDeleted && inCurrentMonth(q.date)).length;
  const dispatchesThisMonth = (data.deliveryChallans || []).filter((d) => !d.isDeleted && inCurrentMonth(d.date)).length;
  const inProcessCount = activeRows.filter((r) => r.status === 'In Process').length;

  const statusCounts = useMemo(() => {
    const counts = { 'In Process': 0, Completed: 0, Dispatched: 0 };
    allRows.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [allRows]);

  const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 0;
  const statusSegments = [
    { label: 'In Process', value: statusCounts['In Process'], color: '#f97316' },
    { label: 'Completed', value: statusCounts.Completed, color: '#22c55e' },
    { label: 'Dispatched', value: statusCounts.Dispatched, color: PURPLE }
  ];

  const recentJobs = useMemo(() => [...allRows]
    .sort((a, b) => String(b.mr.date || '').localeCompare(String(a.mr.date || '')))
    .slice(0, 6), [allRows]);

  const inquiryWeeks = useMemo(() => {
    const weeks = [0, 0, 0, 0];
    (data.quotations || []).filter((q) => !q.isDeleted && inCurrentMonth(q.date)).forEach((q) => {
      const w = weekOfMonth(q.date);
      if (w >= 1 && w <= 4) weeks[w - 1] += 1;
    });
    return weeks.map((y, i) => ({ label: `Week ${i + 1}`, y }));
  }, [data.quotations]);

  const topProducts = useMemo(() => {
    const map = {};
    (data.materialReceipts || []).filter((mr) => !mr.isDeleted).forEach((mr) => {
      const opts = receiptProductOptions(mr, data);
      const names = (mr.productSummaries || []).map((p) => p.prodName).filter(Boolean);
      const list = names.length ? names : (mr.productName ? [mr.productName] : []);
      list.forEach((name) => {
        const qty = getProductQty(mr, name, opts) || parseFloat(mr.totalQty) || 0;
        map[name] = (map[name] || 0) + qty;
      });
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  const quickActions = [
    { label: 'New Quotation', icon: PlusSquare, path: '/quotations', bg: 'rgba(91,28,133,0.1)', color: PURPLE },
    { label: 'Material Receipt', icon: ClipboardList, path: '/material-receipt', bg: 'rgba(34,197,94,0.12)', color: '#15803d' },
    { label: 'Under Process', icon: Activity, path: '/under-process', bg: 'rgba(249,115,22,0.12)', color: '#c2410c' },
    { label: 'Purchase Order', icon: ShoppingCart, path: '/purchase-orders', bg: 'rgba(147,51,234,0.12)', color: PURPLE_SOFT },
    { label: 'Delivery Challan', icon: Truck, path: '/dc', bg: 'rgba(14,165,233,0.12)', color: '#0284c7' },
    { label: 'Tax Invoice', icon: FileText, path: '/tax-invoice', bg: 'rgba(91,28,133,0.1)', color: PURPLE }
  ];

  return (
    <div className="dash-page">
      <header className="page-header dash-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to Uma Micron Management System</p>
        </div>
      </header>

      <div className="dash-kpi-grid">
        <StatCard
          title="Total Parties"
          value={partiesCount}
          icon={Users}
          iconBg="rgba(91, 28, 133, 0.12)"
          iconColor={PURPLE}
          subtext="Active"
          subtextColor="#16a34a"
          path="/parties"
        />
        <StatCard
          title="Total Inquiries"
          value={inquiriesThisMonth}
          icon={MessageSquarePlus}
          iconBg="rgba(34, 197, 94, 0.12)"
          iconColor="#15803d"
          subtext="This Month"
          subtextColor={PURPLE}
          path="/quotations"
        />
        <StatCard
          title="Job Orders"
          value={activeRows.length}
          icon={Package}
          iconBg="rgba(147, 51, 234, 0.12)"
          iconColor={PURPLE_SOFT}
          subtext={`${inProcessCount} In Process`}
          subtextColor="#ea580c"
          path="/under-process"
        />
        <StatCard
          title="Dispatches"
          value={dispatchesThisMonth}
          icon={Truck}
          iconBg="rgba(249, 115, 22, 0.12)"
          iconColor="#ea580c"
          subtext="This Month"
          subtextColor={PURPLE}
          path="/dc"
        />
        <StatCard
          title="Outstanding"
          value={`₹ ${Math.round(totalOutstanding).toLocaleString('en-IN')}`}
          icon={DollarSign}
          iconBg="rgba(20, 184, 166, 0.14)"
          iconColor="#0f766e"
          subtext="Total"
          subtextColor="#dc2626"
          path="/payment-follow-up"
        />
      </div>

      <div className="dash-mid-grid">
        <div className="premium-card dash-card">
          <div className="dash-card-head">
            <h3>Recent Job Orders</h3>
            <button type="button" className="dash-link" onClick={() => navigate('/under-process')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>JO No.</th>
                  <th>Party Name</th>
                  <th>Product</th>
                  <th>Qty (kg)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="dash-empty">No job orders yet.</td>
                  </tr>
                ) : (
                  recentJobs.map((row, idx) => {
                    const qty = row.productName
                      ? getProductQty(row.mr, row.productName, row.prodOpts)
                      : (row.mr.totalQty || 0);
                    return (
                      <tr key={`${row.mr.id}-${row.productName || idx}`} onClick={() => navigate('/under-process')}>
                        <td>
                          <button type="button" className="dash-jo-link" onClick={() => navigate('/under-process')}>
                            {row.mr.receiptNo || '—'}
                          </button>
                        </td>
                        <td>{row.mr.partyName || '—'}</td>
                        <td>{row.productName || '—'}</td>
                        <td>{Number(qty || 0).toLocaleString('en-IN')}</td>
                        <td><StatusPill status={row.status} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="premium-card dash-card">
          <div className="dash-card-head">
            <h3>Job Order Status Overview</h3>
          </div>
          <div className="dash-status-wrap">
            <DonutChart segments={statusSegments} total={statusTotal || allRows.length} />
            <div className="dash-legend">
              {statusSegments.map((seg) => {
                const pct = statusTotal ? Math.round((seg.value / statusTotal) * 100) : 0;
                return (
                  <div key={seg.label} className="dash-legend-row">
                    <span className="dash-legend-dot" style={{ background: seg.color }} />
                    <span className="dash-legend-label">{seg.label}</span>
                    <span className="dash-legend-meta">{seg.value} · {pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-bottom-grid">
        <div className="premium-card dash-card">
          <div className="dash-card-head">
            <h3>Quick Actions</h3>
          </div>
          <div className="dash-actions">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="dash-action"
                onClick={() => navigate(action.path)}
              >
                <span className="dash-action-icon" style={{ background: action.bg, color: action.color }}>
                  <action.icon size={18} />
                </span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="premium-card dash-card">
          <div className="dash-card-head">
            <h3>Inquiries This Month</h3>
          </div>
          <LineChart points={inquiryWeeks} />
        </div>

        <div className="premium-card dash-card">
          <div className="dash-card-head">
            <h3>Top Products</h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="dash-empty">No product volume yet.</p>
          ) : (
            <BarChart rows={topProducts} />
          )}
        </div>
      </div>

      <footer className="dash-footer">
        © {new Date().getFullYear()} UMA MICRON - Micronize for API. All rights reserved.
      </footer>
    </div>
  );
};

export default Dashboard;
