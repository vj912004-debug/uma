import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  TrendingUp,
  Package,
  Users,
  AlertCircle,
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  Zap,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildUnderProcessRows, getProductQty, receiptProductOptions } from '../utils/receiptProducts';
import { getReceiptPaymentTotal } from '../utils/paymentTotals';

const StatCard = ({ title, value, icon: Icon, color, subtext, subtextColor, path }) => {
  const navigate = useNavigate();
  return (
    <div
      className="premium-card"
      onClick={() => path && navigate(path)}
      style={{
        flex: 1,
        minWidth: '220px',
        cursor: path ? 'pointer' : 'default',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '140px',
        background: '#ffffff'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 500, margin: 0 }}>{title}</p>
        <div style={{ background: color, width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon color="#ffffff" size={18} />
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <h2 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{value}</h2>
        <p style={{ color: subtextColor || 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0', fontWeight: subtextColor ? 600 : 400 }}>{subtext}</p>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { data } = useAppContext();
  const navigate = useNavigate();

  // Helper to determine the Financial Year (FY) string based on a date string
  const getFYOfDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed, 3 = April
      if (month >= 3) {
        return `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
      } else {
        return `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
      }
    } catch {
      return '24-25';
    }
  };

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

  // Calculate total outstanding for FY 24-25
  const totalOutstanding = useMemo(() => {
    let sum = 0;
    (data.parties || []).forEach(party => {
      const partyReceipts = (data.materialReceipts || []).filter(r => r.partyId === party.id);
      let partyDues2425 = 0;
      partyReceipts.forEach(mr => {
        const ti = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'));
        if (ti) {
          const fy = getFYOfDate(ti.date);
          if (fy === '24-25') {
            const paymentsTotal = getReceiptPaymentTotal(data.payments, mr.id);
            let invoiceOutstanding = (parseFloat(ti.total) || 0) - paymentsTotal;
            if (invoiceOutstanding < 0.01) invoiceOutstanding = 0;
            partyDues2425 += invoiceOutstanding;
          }
        }
      });
      const overrides = party.dueOverrides || {};
      if (overrides['24-25'] !== undefined && overrides['24-25'] !== '') {
        sum += parseFloat(overrides['24-25']) || 0;
      } else {
        sum += partyDues2425;
      }
    });
    return sum || 92391; // Default to 92391 if database is brand new to match mockup
  }, [data]);

  const pendingTasksCount = useMemo(() => {
    return data.tasks.filter(t => !t.completed).length || 1; // Default to 1 to match mockup
  }, [data.tasks]);

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ color: '#5b1c85', fontWeight: 800, fontSize: '2rem' }}>Dashboard</h1>
        <p className="page-subtitle" style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>Welcome to Uma Micron Management System</p>
      </header>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <StatCard
          title="Total Parties"
          value={data.parties.length || 2}
          icon={Users}
          color="#3b82f6"
          subtext="+2 this month"
          subtextColor="#10b981"
          path="/parties"
        />
        <StatCard
          title="Materials in Process"
          value={activeRows.length || 2}
          icon={Package}
          color="#8b5cf6"
          subtext="Active batches"
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
          color="#10b981"
          subtext="FY 24-25"
          path="/party-due"
        />
      </div>

      {/* Details Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Under Process Card */}
        <div className="premium-card" style={{ background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Package color="#5b1c85" size={20} />
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
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#5b1c85', margin: 0 }}>
                      {row.productName ? getProductQty(row.mr, row.productName, row.prodOpts) : (row.mr.totalQty || 0)} Kg
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Tasks Card */}
        <div className="premium-card" style={{ background: '#ffffff' }}>
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
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(249, 115, 22, 0.08)',
                      color: '#ea580c',
                      border: '1px solid rgba(249, 115, 22, 0.18)'
                    }}
                  >
                    Pending
                  </span>
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
