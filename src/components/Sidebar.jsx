import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Calculator,
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
  X,
  Phone,
  GitCompare,
  CalendarDays,
  Wrench,
  Gauge,
  Thermometer,
  Fan,
  Megaphone,
  UserPlus,
  PhoneCall,
  BarChart3,
  Fingerprint
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessModule } from '../utils/moduleAccess';

const Sidebar = () => {
  const { currentUser, logout } = useAuth();
  const userRole = currentUser?.role || 'Staff';
  const location = useLocation();

  const canSee = (path) => {
    if (!currentUser) return false;
    return canAccessModule(currentUser, path);
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
      key: 'dispatch',
      title: 'Dispatch & Delivery',
      icon: Truck,
      items: [
        { name: 'Packing List', icon: Package, path: '/packing-list', roles: ['Admin', 'Staff'] },
        { name: 'Delivery Challan', icon: Truck, path: '/dc', roles: ['Admin', 'Staff'] },
        { name: 'E-Way Bill', icon: FileSpreadsheet, path: '/eway', roles: ['Admin', 'Staff'], permissionIds: ['/eway', '/eway-dc', '/eway-ti'] },
        { name: 'BPR Record', icon: Activity, path: '/bpr', roles: ['Admin', 'Staff'] },
        { name: 'PSD Upload', icon: UploadCloud, path: '/psd', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'invoices',
      title: 'Invoices & Billing',
      icon: FileText,
      items: [
        { name: 'Tax Invoice', icon: FileCheck, path: '/tax-invoice', roles: ['Admin', 'Staff'] },
        { name: 'Proforma Invoice', icon: FileText, path: '/invoices-pi', roles: ['Admin', 'Staff'] },
        { name: 'Monthly Billing', icon: CalendarDays, path: '/monthly-billing', roles: ['Admin', 'Staff'], highlight: true },
        { name: 'Purchase Orders', icon: ShoppingCart, path: '/purchase-orders', roles: ['Admin', 'Staff'] },
        { name: 'Debit Note', icon: FileMinus, path: '/debit-notes', roles: ['Admin', 'Staff'] },
        { name: 'Credit Note', icon: FilePlus, path: '/credit-notes', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'payments',
      title: 'Payments & Due',
      icon: CreditCard,
      items: [
        { name: 'Payment Follow-Up', icon: Phone, path: '/payment-follow-up', roles: ['Admin', 'Staff'], highlight: true },
        { name: 'Party Due Status', icon: DollarSign, path: '/party-due', roles: ['Admin', 'Staff'] },
        { name: 'Payments Register', icon: CreditCard, path: '/payments', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'marketing',
      title: 'Marketing & Leads',
      icon: Megaphone,
      items: [
        { name: 'Lead Entry', icon: UserPlus, path: '/marketing', roles: ['Admin', 'Staff'] },
        { name: 'Follow Up List', icon: PhoneCall, path: '/marketing-follow-up', roles: ['Admin', 'Staff'], highlight: true },
        { name: 'Enquiry Conversion', icon: FileText, path: '/marketing#mkt-convert-enquiry', roles: ['Admin', 'Staff'] },
        { name: 'Reports & Analytics', icon: BarChart3, path: '/marketing#mkt-reports', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'procurement',
      title: 'Procurement & Utility',
      icon: Wrench,
      items: [
        { name: 'Purchase Dashboard', icon: ShoppingCart, path: '/purchase-management', hash: '', roles: ['Admin', 'Staff'], permissionIds: ['/purchase-management'] },
        { name: 'New Inquiry', icon: FileText, path: '/purchase-management#pm-inquiry', hash: '#pm-inquiry', roles: ['Admin', 'Staff'], permissionIds: ['/purchase-management'] },
        { name: 'Inquiry List', icon: ClipboardList, path: '/purchase-management#pm-status', hash: '#pm-status', roles: ['Admin', 'Staff'], permissionIds: ['/purchase-management'] },
        { name: 'Quote Follow Up', icon: Phone, path: '/purchase-management#pm-follow', hash: '#pm-follow', roles: ['Admin', 'Staff'], permissionIds: ['/purchase-management'] },
        { name: 'Quote Comparison', icon: GitCompare, path: '/purchase-management#pm-compare', hash: '#pm-compare', roles: ['Admin', 'Staff'], permissionIds: ['/purchase-management'] },
        { name: 'Utility Record', icon: Gauge, path: '/utility-record', roles: ['Admin', 'Staff'] },
        { name: 'Utility Temp. Record', icon: Thermometer, path: '/utility-temp-record', roles: ['Admin', 'Staff'] },
        { name: 'PM Air Compressor', icon: Fan, path: '/pm-air-compressor', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'hr',
      title: 'HR & Attendance',
      icon: Users,
      items: [
        { name: 'Employee Master', icon: Users, path: '/employee-master', roles: ['Admin', 'Staff'] },
        { name: 'Employee Salary', icon: DollarSign, path: '/employee-salary', roles: ['Admin', 'Staff'], highlight: true },
        { name: 'Daily Attendance', icon: UserCheck, path: '/attendance', roles: ['Admin', 'Staff'] },
        { name: 'Salary Calculation', icon: Calculator, path: '/salary-calculation', roles: ['Admin', 'Staff'] },
        { name: 'Device Management', icon: Fingerprint, path: '/device-management', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'reports',
      title: 'Reports & Sheets',
      icon: Grid,
      items: [
        { name: 'Processing Sheet', icon: Grid, path: '/processing-sheet', roles: ['Admin', 'Staff'] },
        { name: 'Quotations', icon: PlusSquare, path: '/quotations', roles: ['Admin', 'Staff'] },
        { name: 'Tasks & Alerts', icon: Bell, path: '/tasks', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'system',
      title: 'Settings & System',
      icon: Building2,
      items: [
        { name: 'Company Profile', icon: Building2, path: '/settings/company-profile', roles: ['Admin'] },
        { name: 'User Management', icon: Shield, path: '/employees', roles: ['Admin'] },
        { name: 'Recycle Bin', icon: Archive, path: '/recycle-bin', roles: ['Admin'] },
        { name: 'Backups & Logs', icon: DatabaseBackup, path: '/system-logs', roles: ['Admin'] }
      ]
    }
  ];

  const [expandedGroups, setExpandedGroups] = useState({
    material: true,
    dispatch: false,
    invoices: false,
    payments: false,
    procurement: false,
    marketing: false,
    hr: false,
    reports: false,
    system: false
  });

  // Automatically expand group containing active route
  useEffect(() => {
    const currentPath = location.pathname;
    const currentHash = location.hash || '';

    groups.forEach((group) => {
      const isCurrentGroupActive = group.items.some((item) => {
        if (item.hash) {
          return currentPath === '/purchase-management' && currentHash === item.hash;
        }
        return currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
      });

      if (isCurrentGroupActive) {
        setExpandedGroups((prev) => ({ ...prev, [group.key]: true }));
      }
    });
  }, [location.pathname, location.hash]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const loginId = String(currentUser?.username || '').trim();
  const storedName = String(currentUser?.name || '').trim();
  const roleWord = /^(admin|administrator|staff|user)$/i.test(storedName);
  const fromLogin = loginId.includes('@')
    ? loginId.split('@')[0].replace(/[._-]+/g, ' ')
    : '';
  const displayName = (!storedName || roleWord) && fromLogin
    ? fromLogin
    : (storedName || fromLogin || loginId || 'User');
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand" style={{ marginBottom: '1.25rem', padding: '0 0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="sidebar-brand-logo">M</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 750, margin: 0, lineHeight: 1.2 }}>UMA MICRON</h1>
            <p style={{ fontSize: '0.68rem', margin: 0, whiteSpace: 'nowrap', fontWeight: 600 }}>Micronization of API's</p>
          </div>
        </div>
        <button className="sidebar-close-btn" aria-label="Close Sidebar">
          <X size={16} />
        </button>
      </div>

      {/* Nav Section */}
      <nav className="sidebar-nav">
        {/* Main Section Header */}
        <div className="sidebar-nav-section-label">MAIN MENU</div>

        {/* Dashboard Direct Link */}
        {userRole && canSee('/') && (
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
        {userRole && canSee('/parties') && (
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
        {userRole && canSee('/production-planning') && (
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

        {/* Section Divider Label */}
        <div className="sidebar-nav-section-label" style={{ marginTop: '0.75rem' }}>MODULES & WORKFLOW</div>

        {/* Collapsible Accordion Groups */}
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.roles?.includes(userRole)) return false;
            if (item.permissionIds?.length) {
              return item.permissionIds.some((id) => canSee(id));
            }
            return canSee(item.path);
          });
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedGroups[group.key];

          const isChildActive = visibleItems.some((item) => {
            if (item.hash) {
              return location.pathname === '/purchase-management' && location.hash === item.hash;
            }
            return location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          });

          return (
            <div key={group.key} className="sidebar-group">
              <button
                className={`sidebar-group-header ${isChildActive ? 'has-active-child' : ''}`}
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
                      className={({ isActive }) => {
                        const onHash = Object.prototype.hasOwnProperty.call(item, 'hash')
                          && location.pathname === '/purchase-management'
                          && (location.hash || '') === item.hash;
                        const on = Object.prototype.hasOwnProperty.call(item, 'hash') ? onHash : isActive;
                        return [
                          'nav-link',
                          item.highlight ? 'highlight' : '',
                          item.pill ? 'nav-pill' : '',
                          on ? 'active' : ''
                        ]
                          .filter(Boolean)
                          .join(' ');
                      }}
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
            <p className="sidebar-user-name">{displayName}</p>
            <p className="sidebar-user-meta">{loginId || userRole}</p>
          </div>
        </div>
        <button onClick={logout} className="btn sidebar-logout">
          <LogOut size={13} /> Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
