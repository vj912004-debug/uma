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
  Phone,
  CalendarDays,
  Wrench,
  Gauge,
  Thermometer,
  Fan,
  Megaphone,
  UserPlus,
  PhoneCall,
  Fingerprint,
  RefreshCw,
  CheckCircle2,
  Hexagon
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
        { name: 'Under Process', icon: Layers, path: '/under-process', roles: ['Admin', 'Staff'] }
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
        { name: 'Monthly Billing', icon: CalendarDays, path: '/monthly-billing', roles: ['Admin', 'Staff'] },
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
        { name: 'Payment Follow-Up', icon: Phone, path: '/payment-follow-up', roles: ['Admin', 'Staff'] },
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
        { name: 'Follow Up List', icon: PhoneCall, path: '/marketing-follow-up', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'procurement',
      title: 'Procurement & Utility',
      icon: Wrench,
      items: [
        { name: 'Purchase Dashboard', icon: ShoppingCart, path: '/purchase-management', roles: ['Admin', 'Staff'] },
        { name: 'Utility Record', icon: Gauge, path: '/utility-record', roles: ['Admin', 'Staff'] },
        { name: 'Utility Temp. Record', icon: Thermometer, path: '/utility-temp-record', roles: ['Admin', 'Staff'] },
        { name: 'PM Air Compressor', icon: Fan, path: '/pm-air-compressor', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'employee',
      title: 'EMPLOYEE',
      icon: Users,
      items: [
        { name: 'Employee Master', icon: Users, path: '/employee-master', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'attendance',
      title: 'ATTENDANCE',
      icon: Calendar,
      items: [
        { name: 'Biometric Sync', icon: RefreshCw, path: '/device-management', roles: ['Admin', 'Staff'] },
        { name: 'Biometric Mapping', icon: Fingerprint, path: '/device-management#map', roles: ['Admin', 'Staff'] },
        { name: 'Daily Attendance', icon: UserCheck, path: '/attendance', roles: ['Admin', 'Staff'] },
        { name: 'Daily Approval', icon: CheckCircle2, path: '/attendance#approval', roles: ['Admin', 'Staff'] },
        { name: 'Attendance Reports', icon: FileText, path: '/reports#attendance', roles: ['Admin', 'Staff'] }
      ]
    },
    {
      key: 'salary',
      title: 'SALARY',
      icon: DollarSign,
      items: [
        { name: 'Salary Calculation', icon: Calculator, path: '/salary-calculation', roles: ['Admin', 'Staff'] },
        { name: 'Salary Register', icon: CreditCard, path: '/employee-salary', roles: ['Admin', 'Staff'] },
        { name: 'Payslip', icon: FileText, path: '/payslip', roles: ['Admin', 'Staff'] }
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
    employee: false,
    attendance: false,
    salary: false,
    reports: false,
    system: false
  });

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
  const displayName = storedName || loginId || 'Amit Patel';

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-container">
        <div className="sidebar-logo-icon">
          <Hexagon size={24} className="logo-hex-icon" />
          <span className="logo-center-letter">U</span>
        </div>
        <div className="sidebar-brand-text">
          <h1 className="brand-title">UMA MICRONS</h1>
          <p className="brand-subtitle">API Micronization ERP</p>
        </div>
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
              ['sidebar-main-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </NavLink>
        )}

        {/* Master Data Direct Link */}
        {userRole && canSee('/parties') && (
          <NavLink
            to="/parties"
            className={({ isActive }) =>
              ['sidebar-main-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            <Users size={16} />
            <span>Master Data</span>
          </NavLink>
        )}

        {/* Production Planning Direct Link */}
        {userRole && canSee('/production-planning') && (
          <NavLink
            to="/production-planning"
            className={({ isActive }) =>
              ['sidebar-main-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            <Calendar size={16} />
            <span>Production Planning</span>
          </NavLink>
        )}

        {/* Section Divider Label */}
        <div className="sidebar-nav-section-label" style={{ marginTop: '0.85rem' }}>
          MODULES & WORKFLOW
        </div>

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
                className={`sidebar-group-header ${isChildActive ? 'has-active-child' : ''} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isExpanded}
              >
                <span className="sidebar-group-header-left">
                  <group.icon size={16} />
                  <span>{group.title}</span>
                </span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isExpanded && (
                <div className="sidebar-group-subitems">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.name + item.path}
                      to={item.path}
                      className={({ isActive }) => {
                        const pathOnly = item.path.split('#')[0];
                        const hashOnly = item.path.includes('#') ? `#${item.path.split('#')[1]}` : '';
                        const onHash = hashOnly
                          ? location.pathname === pathOnly && (location.hash || '') === hashOnly
                          : isActive;
                        const on = hashOnly ? onHash : isActive;
                        return ['sidebar-sublink', on ? 'active' : ''].filter(Boolean).join(' ');
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
        <button onClick={logout} className="sidebar-logout-btn">
          <LogOut size={14} />
          <span>Logout System</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
