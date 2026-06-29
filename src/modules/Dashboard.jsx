import React from 'react';
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
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, path }) => {
  const navigate = useNavigate();
  return (
    <div
      className="premium-card"
      onClick={() => path && navigate(path)}
      style={{
        flex: 1,
        minWidth: '200px',
        cursor: path ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ background: `${color}20`, padding: '0.75rem', borderRadius: '12px' }}>
          <Icon color={color} size={24} />
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{title}</p>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>{value}</h2>
    </div>
  );
};

const Dashboard = () => {
  const { data } = useAppContext();
  const navigate = useNavigate();

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">Welcome back — here's what's happening today.</p>
      </header>

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Today's Attendance Overview</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <StatCard title="Total Employees" value={(data.users || []).length} icon={Users} color="#3b82f6" path="/attendance" />
        <StatCard title="Present Today" value={(data.attendance || []).filter(a => a.date === new Date().toISOString().split('T')[0] && (a.statusCode === 'P' || a.statusCode === 'HD')).length} icon={UserCheck} color="#10b981" path="/attendance" />
        <StatCard title="Absent Today" value={(data.attendance || []).filter(a => a.date === new Date().toISOString().split('T')[0] && a.statusCode === 'A').length} icon={UserX} color="#ef4444" path="/attendance" />
        <StatCard title="Late Employees" value={(data.attendance || []).filter(a => a.date === new Date().toISOString().split('T')[0] && a.isLate).length} icon={Clock} color="#f59e0b" path="/attendance" />
        <StatCard title="On Leave" value={(data.attendance || []).filter(a => a.date === new Date().toISOString().split('T')[0] && ['CL', 'SL', 'PL', 'LWP'].includes(a.statusCode)).length} icon={Briefcase} color="#8b5cf6" path="/attendance" />
        <StatCard title="Overtime (OT)" value={(data.attendance || []).filter(a => a.date === new Date().toISOString().split('T')[0] && parseFloat(a.otHours) > 0).length} icon={Zap} color="#ec4899" path="/attendance" />
      </div>

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Business Metrics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <StatCard title="Active Parties" value={data.parties.length} icon={Users} color="#3b82f6" path="/parties" />
        <StatCard title="Material Receipts" value={data.materialReceipts.length} icon={Package} color="#10b981" path="/material-receipt" />
        <StatCard title="Pending BPRs" value={data.bprs.filter(b => b.status === 'Pending').length} icon={AlertCircle} color="#f59e0b" path="/bpr" />
        <StatCard title="Total Revenue" value={`₹ ${data.invoices.reduce((acc, inv) => acc + (inv.total || 0), 0).toLocaleString()}`} icon={TrendingUp} color="#8b5cf6" path="/reports" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Recent Transactions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.invoices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No recent transactions found.</p>
            ) : (
              data.invoices.slice(-5).map((inv, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate('/invoices')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: 'var(--glass-bg)', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <div>
                    <p style={{ fontWeight: 600 }}>{inv.invoiceNo}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.partyName}</p>
                  </div>
                  <p style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>₹{inv.total.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Reminders</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.tasks.filter(t => !t.completed).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>All caught up!</p>
            ) : (
              data.tasks.filter(t => !t.completed).slice(0, 4).map((task, idx) => (
                <div key={idx} style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--glass-bg)', borderLeft: '3px solid var(--accent-primary)' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{task.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{task.dueDate}</p>
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
