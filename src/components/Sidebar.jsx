import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  ClipboardList, 
  Layers, 
  FileText, 
  Activity, 
  UploadCloud, 
  Package, 
  Truck, 
  FileSpreadsheet, 
  FileCheck, 
  Grid, 
  DollarSign, 
  CreditCard, 
  Bell,
  Archive,
  DatabaseBackup,
  PlusSquare,
  FileMinus,
  FilePlus,
  ShoppingCart,
  UserCheck,
  Sun,
  Moon,
  LogOut,
  Shield
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { data, setData } = useAppContext();
  const { currentUser, logout } = useAuth();
  const userRole = currentUser?.role || data.settings?.userRole || 'Staff';
  const theme = data.settings?.theme || 'dark';

  const groups = [
    {
      title: "Master Data",
      items: [
        { name: 'Add Party', icon: Users, path: '/parties', roles: ['Admin', 'Staff'] },
        { name: 'Quotations', icon: PlusSquare, path: '/quotations', roles: ['Admin', 'Staff'] },
        { name: 'Attendance', icon: UserCheck, path: '/attendance', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: "Received Material",
      items: [
        { name: 'Add Material Received Data', icon: ClipboardList, path: '/material-receipt', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: "Production Planning",
      items: [
        { name: 'Production Planning', icon: Calendar, path: '/production-planning', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: "Under Process",
      items: [
        { name: 'Under Process', icon: Layers, path: '/under-process', roles: ['Admin', 'Staff'], specialStyle: { color: '#ef4444', fontWeight: 'bold' } }
      ]
    },
    {
      title: "Purchase Order",
      items: [
        { name: 'Purchase Order (PO)', icon: ShoppingCart, path: '/purchase-orders', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: "Proforma Invoice",
      items: [
        { name: 'Performa Invoice (PI)', icon: FileText, path: '/invoices-pi', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: "Documents & Flows",
      items: [
        { name: 'Batch Processing Record (BPR)', icon: Activity, path: '/bpr', roles: ['Admin', 'Staff'] },
        { name: 'PSD Upload', icon: UploadCloud, path: '/psd', roles: ['Admin', 'Staff'] },
        { name: 'Packing List (PL)', icon: Package, path: '/packing-list', roles: ['Admin', 'Staff'] },
        { name: 'Delivery Challan (DC)', icon: Truck, path: '/dc', roles: ['Admin', 'Staff'] },
        { name: 'E Way Bill from DC', icon: FileSpreadsheet, path: '/eway-dc', roles: ['Admin', 'Staff'] },
        { name: 'Tax Invoice', icon: FileCheck, path: '/tax-invoice', roles: ['Admin', 'Staff'] },
        { name: 'E Way Bill from Tax Invoice', icon: FileSpreadsheet, path: '/eway-ti', roles: ['Admin', 'Staff'] },
        { name: 'Debit Note', icon: FileMinus, path: '/debit-notes', roles: ['Admin', 'Staff'] },
        { name: 'Credit Note', icon: FilePlus, path: '/credit-notes', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: "Sheets & Reports",
      items: [
        { name: 'Processing Sheet', icon: Grid, path: '/processing-sheet', roles: ['Admin', 'Staff'] },
        { name: 'Party Wise Due', icon: DollarSign, path: '/party-due', roles: ['Admin'] }
      ]
    },
    {
      title: "Financials",
      items: [
        { name: 'Payment', icon: CreditCard, path: '/payments', roles: ['Admin'] }
      ]
    },
    {
      title: "Productivity",
      items: [
        { name: 'Task Reminder', icon: Bell, path: '/tasks', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: "System",
      items: [
        { name: 'Employees', icon: Shield, path: '/employees', roles: ['Admin'] },
        { name: 'Recycle Bin', icon: Archive, path: '/recycle-bin', roles: ['Admin'] },
        { name: 'Backups & Logs', icon: DatabaseBackup, path: '/system-logs', roles: ['Admin'] }
      ]
    }
  ];

  const toggleTheme = () => {
    setData(prev => ({
      ...prev,
      settings: { ...prev.settings, theme: theme === 'dark' ? 'light' : 'dark' }
    }));
  };

  const displayName = currentUser?.name || currentUser?.username || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="glass-panel" style={{ width: '290px', height: '100vh', padding: '1.5rem 1rem', position: 'sticky', top: 0, borderRight: '1px solid var(--border-color)', borderRadius: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '1px', background: 'linear-gradient(to right, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          UMA MICRON
        </h1>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>ERP & Process Tracking</p>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflowY: 'auto', paddingRight: '0.25rem', paddingBottom: '1rem' }}>
        {groups.map((group, idx) => {
          const visibleItems = group.items.filter(item => item.roles?.includes(userRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.75px', paddingLeft: '0.5rem', marginBottom: '0.25rem' }}>
                {group.title}
              </p>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => {
                    const isUnderProcess = item.name === 'Under Process';
                    return {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: isActive 
                        ? (isUnderProcess ? '#ef4444' : 'var(--text-main)') 
                        : (isUnderProcess ? '#fca5a5' : 'var(--text-muted)'),
                      background: isActive 
                        ? (isUnderProcess ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)') 
                        : 'transparent',
                      transition: 'all 0.15s ease',
                      border: isActive 
                        ? (isUnderProcess ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)') 
                        : '1px solid transparent',
                      fontWeight: isUnderProcess ? 600 : 500
                    };
                  }}
                >
                  <item.icon size={16} />
                  <span style={{ fontSize: '0.825rem' }}>{item.name}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={toggleTheme}
            className="btn" 
            style={{ 
              flex: 1,
              fontSize: '0.7rem', 
              padding: '0.5rem',
            }}
          >
            {theme === 'dark' ? <Sun size={12} style={{ opacity: 0.6 }} /> : <Moon size={12} style={{ opacity: 0.6 }} />} {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button 
            onClick={logout}
            className="btn" 
            style={{ 
              flex: 1,
              fontSize: '0.7rem', 
              padding: '0.5rem',
              color: '#f87171'
            }}
          >
            <LogOut size={12} style={{ opacity: 0.6 }} /> Logout
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '0.7rem' }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{displayName}</p>
            <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', margin: 0 }}>{userRole} · {currentUser?.employeeId || ''}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
