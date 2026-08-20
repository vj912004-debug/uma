import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  Package,
  Users,
  Clock,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildUnderProcessRows, getProductQty, receiptProductOptions } from '../utils/receiptProducts';
import { getReceiptOutstanding } from '../utils/paymentTotals';
import { getCurrentFYKey, getFYOfDate } from '../utils/financialYear';

const StatCard = ({ title, value, icon: Icon, color, subtext, subtextColor, path }) => {
  const navigate = useNavigate();
  return (
    <div
      className="kpi-card"
      onClick={() => path && navigate(path)}
      style={{ cursor: path ? 'pointer' : 'default' }}
    >
      <div className="kpi-icon" style={{ background: color }}>
        <Icon color="#ffffff" size={18} />
      </div>
      <div className="kpi-body">
        <span className="kpi-label">{title}</span>
        <span className="kpi-value">{value}</span>
        <span className="kpi-sub" style={{ color: subtextColor || 'var(--text-muted)' }}>{subtext}</span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { data } = useAppContext();
  const navigate = useNavigate();
  const currentFY = useMemo(() => getCurrentFYKey(), []);

  // Compile active rows currently under process
  const activeRows = useMemo(() => {
    return buildUnderProcessRows(data.materialReceipts || [], data).filter(({ mr, productName }) => {
      const pi = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/PI/'));
      const bpr = (data.bprs || []).find(b => b.receiptId === mr.id && b.productName === productName);
      const psd = (data.psds || []).find(p => p.receiptId === mr.id && p.productName === productName);
      const pl = (data.packingLists || []).find(p => p.receiptId === mr.id && p.productName === productName);
      const dc = (data.deliveryChallans || []).find(d => d.receiptId === mr.id && d.productName === productName);
      const ti = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/') && inv.productName === productName);
      const isComplete = pi && bpr && psd && pl && dc && ti;
      return !isComplete;
    }).map(row => ({
      ...row,
      prodOpts: receiptProductOptions(row.mr, data)
    }));
  }, [data]);

  // Outstanding for the current financial year
  const totalOutstanding = useMemo(() => {
    let sum = 0;
    (data.parties || []).forEach(party => {
      const partyReceipts = (data.materialReceipts || []).filter(r => r.partyId === party.id);
      let partyDuesCurrent = 0;
      partyReceipts.forEach(mr => {
        const ti = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'));
        if (ti) {
          const fy = getFYOfDate(ti.date);
          if (fy === currentFY) {
            partyDuesCurrent += getReceiptOutstanding(mr, ti, data.payments);
          }
        }
      });
      const overrides = party.dueOverrides || {};
      if (overrides[currentFY] !== undefined && overrides[currentFY] !== '') {
        sum += parseFloat(overrides[currentFY]) || 0;
      } else {
        sum += partyDuesCurrent;
      }
    });
    return sum;
  }, [data, currentFY]);

  const pendingTasksCount = useMemo(() => {
    return (data.tasks || []).filter(t => !t.completed).length;
  }, [data.tasks]);

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to Uma Micron Management System</p>
        </div>
      </header>

      <div className="kpi-grid" style={{ marginBottom: '1.75rem' }}>
        <StatCard
          title="Total Parties"
          value={data.parties.length}
          icon={Users}
          color="#5b1c85"
          subtext="Registered parties"
          subtextColor="var(--text-muted)"
          path="/parties"
        />
        <StatCard
          title="Materials in Process"
          value={activeRows.length}
          icon={Package}
          color="#9333ea"
          subtext="Active batches"
          subtextColor="#9333ea"
          path="/under-process"
        />
        <StatCard
          title="Pending Tasks"
          value={pendingTasksCount}
          icon={Clock}
          color="#f97316"
          subtext="Need attention"
          subtextColor="#ea580c"
          path="/tasks"
        />
        <StatCard
          title="Total Outstanding"
          value={`₹${totalOutstanding.toLocaleString('en-IN')}`}
          icon={DollarSign}
          color="#5b1c85"
          subtext={`FY ${currentFY}`}
          subtextColor="var(--text-muted)"
          path="/payment-follow-up"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Package color="var(--brand-purple)" size={20} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Under Process</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: '0 0 1.25rem' }}>Materials currently being processed</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeRows.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.875rem' }}>No materials currently under process.</p>
            ) : (
              activeRows.slice(0, 5).map((row, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate('/under-process')}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(91, 28, 133, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', margin: 0 }}>{row.productName || '—'}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                      {row.mr.partyName} · {new Date(row.mr.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--brand-purple)', margin: 0 }}>
                      {row.productName ? getProductQty(row.mr, row.productName, row.prodOpts) : (row.mr.totalQty || 0)} Kg
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Tasks Card */}
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Clock color="#ea580c" size={20} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Recent Tasks</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: '0 0 1.25rem' }}>Tasks requiring your attention</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.tasks.filter(t => !t.completed).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.875rem' }}>All caught up!</p>
            ) : (
              data.tasks.filter(t => !t.completed).slice(0, 4).map((task, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate('/tasks')}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(91, 28, 133, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', margin: 0 }}>{task.title}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>Due: {task.dueDate}</p>
                  </div>
                  <span className="status-pill pending">Pending</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
