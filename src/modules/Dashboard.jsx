import React from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  TrendingUp, 
  Package, 
  Users, 
  AlertCircle 
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

  return (
    <div>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Overview</h1>
        <p style={{ color: 'var(--text-muted)' }}>Welcome back, here's what's happening today.</p>
      </header>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
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
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.2s' }}
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
                <div key={idx} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--accent-primary)' }}>
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
