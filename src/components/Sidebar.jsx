import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
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
  Shield,
  Building2
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
      title: 'Home',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: 'Master',
      items: [
        { name: 'Parties', icon: Users, path: '/parties', roles: ['Admin', 'Staff'] },
        { name: 'Quotations', icon: PlusSquare, path: '/quotations', roles: ['Admin', 'Staff'] },
        { name: 'Attendance', icon: UserCheck, path: '/attendance', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: 'Material',
      items: [
        { name: 'Material Receipt', icon: ClipboardList, path: '/material-receipt', roles: ['Admin', 'Staff'] },
        { name: 'Production Planning', icon: Calendar, path: '/production-planning', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: 'Workflow',
      items: [
        { name: 'Under Process', icon: Layers, path: '/under-process', roles: ['Admin', 'Staff'], highlight: true }
      ]
    },
    {
      title: 'Invoices',
      items: [
        { name: 'Purchase Orders', icon: ShoppingCart, path: '/purchase-orders', roles: ['Admin', 'Staff'] },
        { name: 'Proforma Invoice', icon: FileText, path: '/invoices-pi', roles: ['Admin', 'Staff'] },
        { name: 'Tax Invoice', icon: FileCheck, path: '/tax-invoice', roles: ['Admin', 'Staff'] },
        { name: 'Debit Note', icon: FileMinus, path: '/debit-notes', roles: ['Admin', 'Staff'] },
        { name: 'Credit Note', icon: FilePlus, path: '/credit-notes', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: 'Dispatch',
      items: [
        { name: 'BPR', icon: Activity, path: '/bpr', roles: ['Admin', 'Staff'] },
        { name: 'PSD Upload', icon: UploadCloud, path: '/psd', roles: ['Admin', 'Staff'] },
        { name: 'Packing List', icon: Package, path: '/packing-list', roles: ['Admin', 'Staff'] },
        { name: 'Delivery Challan', icon: Truck, path: '/dc', roles: ['Admin', 'Staff'] },
        { name: 'E-Way (DC)', icon: FileSpreadsheet, path: '/eway-dc', roles: ['Admin', 'Staff'] },
        { name: 'E-Way (TI)', icon: FileSpreadsheet, path: '/eway-ti', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: 'Reports',
      items: [
        { name: 'Processing Sheet', icon: Grid, path: '/processing-sheet', roles: ['Admin', 'Staff'] },
        { name: 'Party Due', icon: DollarSign, path: '/party-due', roles: ['Admin'] },
        { name: 'Payments', icon: CreditCard, path: '/payments', roles: ['Admin'] },
        { name: 'Tasks', icon: Bell, path: '/tasks', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      title: 'System',
      items: [
        { name: 'Company Profile', icon: Building2, path: '/settings/company-profile', roles: ['Admin'] },
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
    <aside className="sidebar glass-panel">
      <div className="sidebar-brand" style={{ marginBottom: '1.25rem', padding: '0 0.35rem' }}>
        <h1>UMA MICRON</h1>
        <p>ERP & Process Tracking</p>
      </div>

      <nav className="sidebar-nav">
        {groups.map((group, idx) => {
          const visibleItems = group.items.filter(item => item.roles?.includes(userRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx}>
              <p className="nav-group-title">{group.title}</p>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    ['nav-link', item.highlight ? 'highlight' : '', isActive ? 'active' : '']
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  <item.icon size={15} />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-actions">
          <button onClick={toggleTheme} className="btn" style={{ flex: 1, fontSize: '0.72rem', padding: '0.45rem' }}>
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button
            onClick={logout}
            className="btn"
            style={{ flex: 1, fontSize: '0.72rem', padding: '0.45rem', color: '#f87171' }}
          >
            <LogOut size={12} /> Logout
          </button>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
              {displayName}
            </p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>
              {userRole}{currentUser?.employeeId ? ` · ${currentUser.employeeId}` : ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
