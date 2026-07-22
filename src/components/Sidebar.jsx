import React, { useState } from 'react';
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
  LogOut,
  Shield,
  Building2,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { data } = useAppContext();
  const { currentUser, logout } = useAuth();
  const userRole = currentUser?.role || data?.settings?.userRole || 'Staff';

  const [expandedGroups, setExpandedGroups] = useState({
    material: true, // "Material Received" default open
    invoices: false,
    dispatch: false,
    reports: false,
    system: false
  });

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const groups = [
    {
      key: 'material',
      title: 'Material Received',
      icon: Package,
      items: [
        { name: 'Material Receipt', icon: ClipboardList, path: '/material-receipt', roles: ['Admin', 'Staff'] },
        { name: 'Under Process', icon: Layers, path: '/under-process', roles: ['Admin', 'Staff'], highlight: true }
      ]
    },
    {
      key: 'invoices',
      title: 'Invoices & Billing',
      icon: FileText,
      items: [
        { name: 'Purchase Orders', icon: ShoppingCart, path: '/purchase-orders', roles: ['Admin', 'Staff'] },
        { name: 'Proforma Invoice', icon: FileText, path: '/invoices-pi', roles: ['Admin', 'Staff'] },
        { name: 'Tax Invoice', icon: FileCheck, path: '/tax-invoice', roles: ['Admin', 'Staff'] },
        { name: 'Debit Note', icon: FileMinus, path: '/debit-notes', roles: ['Admin', 'Staff'] },
        { name: 'Credit Note', icon: FilePlus, path: '/credit-notes', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'dispatch',
      title: 'Dispatch & Delivery',
      icon: Truck,
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
      key: 'reports',
      title: 'Reports & Logs',
      icon: Grid,
      items: [
        { name: 'Processing Sheet', icon: Grid, path: '/processing-sheet', roles: ['Admin', 'Staff'] },
        { name: 'Party Due', icon: DollarSign, path: '/party-due', roles: ['Admin'] },
        { name: 'Payments', icon: CreditCard, path: '/payments', roles: ['Admin'] },
        { name: 'Tasks', icon: Bell, path: '/tasks', roles: ['Admin', 'Staff'] },
        { name: 'Quotations', icon: PlusSquare, path: '/quotations', roles: ['Admin', 'Staff'] },
        { name: 'Attendance', icon: UserCheck, path: '/attendance', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'system',
      title: 'Settings & System',
      icon: Building2,
      items: [
        { name: 'Company Profile', icon: Building2, path: '/settings/company-profile', roles: ['Admin'] },
        { name: 'Employees', icon: Shield, path: '/employees', roles: ['Admin'] },
        { name: 'Recycle Bin', icon: Archive, path: '/recycle-bin', roles: ['Admin'] },
        { name: 'Backups & Logs', icon: DatabaseBackup, path: '/system-logs', roles: ['Admin'] }
      ]
    }
  ];

  const displayName = currentUser?.name || currentUser?.username || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand" style={{ marginBottom: '1.5rem', padding: '0 0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="sidebar-brand-logo">M</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>UMA MICRON</h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.68rem', margin: 0, whiteSpace: 'nowrap' }}>Micronization of API's</p>
          </div>
        </div>
        <button className="sidebar-close-btn" aria-label="Close Sidebar">
          <X size={16} />
        </button>
      </div>

      {/* Nav Section */}
      <nav className="sidebar-nav">
        {/* Dashboard Direct Link */}
        {userRole && (
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              ['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </NavLink>
        )}

        {/* Master Data Direct Link */}
        {userRole && (
          <NavLink
            to="/parties"
            className={({ isActive }) =>
              ['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            <Users size={15} />
            <span>Master Data</span>
          </NavLink>
        )}

        {/* Production Planning Direct Link */}
        {userRole && (
          <NavLink
            to="/production-planning"
            className={({ isActive }) =>
              ['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            <Calendar size={15} />
            <span>Production Planning</span>
          </NavLink>
        )}

        {/* Collapsible Accordion Groups */}
        {groups.map((group) => {
          const visibleItems = group.items.filter(item => item.roles?.includes(userRole));
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedGroups[group.key];

          return (
            <div key={group.key} className="sidebar-group">
              <button
                className="sidebar-group-header"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isExpanded}
              >
                <span className="sidebar-group-header-content">
                  <group.icon size={15} />
                  <span>{group.title}</span>
                </span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              {isExpanded && (
                <div className="sidebar-group-items">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        ['nav-link', item.highlight ? 'highlight' : '', isActive ? 'active' : '']
                          .filter(Boolean)
                          .join(' ')
                      }
                    >
                      <item.icon size={14} />
                      <span>{item.name}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
              {displayName}
            </p>
            <p style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.65)', margin: 0 }}>
              {userRole}{currentUser?.employeeId ? ` · ${currentUser.employeeId}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn"
          style={{
            width: '100%',
            fontSize: '0.78rem',
            padding: '0.5rem',
            color: '#ffffff',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            justifyContent: 'center',
            borderRadius: '8px'
          }}
        >
          <LogOut size={13} /> Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
