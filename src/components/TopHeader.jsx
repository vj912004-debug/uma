import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Bell, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import DateField from './DateField';

const TopHeader = () => {
  const { data } = useAppContext();
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openPanel, setOpenPanel] = useState(null);
  const [pickedDate, setPickedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const alerts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tasks = (data?.tasks || [])
      .filter((task) => !task.isDeleted && task.status !== 'Completed')
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title || 'Task',
        detail: task.date ? `Due ${task.date}${task.time ? ` ${task.time}` : ''}` : 'Pending task',
        path: '/tasks'
      }));
    const pendingStaff = (data?.users || [])
      .filter((user) => !user.isDeleted && user.approvalStatus === 'Pending')
      .map((user) => ({
        id: `user-${user.id}`,
        title: user.name || user.employeeId || 'New employee',
        detail: 'Waiting for approval',
        path: '/employee-master'
      }));
    const pendingAttendance = (data?.attendance || [])
      .filter((row) => !row.isDeleted && row.date === today && row.approvalStatus === 'Pending')
      .slice(0, 8)
      .map((row) => ({
        id: `att-${row.id}`,
        title: row.username || row.employeeId || 'Attendance',
        detail: 'Attendance waiting for approval',
        path: `/attendance?date=${today}`
      }));
    return [...tasks, ...pendingStaff, ...pendingAttendance].slice(0, 12);
  }, [data]);

  useEffect(() => {
    const close = (event) => {
      if (!headerRef.current?.contains(event.target)) setOpenPanel(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/under-process?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const openDate = (value) => {
    setOpenPanel(null);
    navigate(`/attendance?date=${value}`);
  };

  return (
    <header className="top-header" ref={headerRef}>
      {/* Global Search Bar */}
      <div className="top-search-wrap">
        <Search size={17} className="top-search-icon" />
        <input
          type="text"
          className="top-search-input"
          placeholder="Search batches, parties, invoices, etc..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      {/* Right Header Actions */}
      <div className="top-header-actions">
        {/* Notification Bell */}
        <div className="top-header-pop">
          <button
            type="button"
            className="top-header-btn top-bell-btn"
            title="Notifications"
            aria-expanded={openPanel === 'alerts'}
            onClick={() => setOpenPanel((panel) => (panel === 'alerts' ? null : 'alerts'))}
          >
            <Bell size={18} />
            {alerts.length > 0 && <span className="bell-badge">{alerts.length > 9 ? '9+' : alerts.length}</span>}
          </button>
          {openPanel === 'alerts' && (
            <div className="top-pop-panel" role="menu">
              <div className="top-pop-title">Notifications</div>
              {alerts.length === 0 ? (
                <p className="top-pop-empty">No pending alerts.</p>
              ) : alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  className="top-pop-item"
                  onClick={() => { setOpenPanel(null); navigate(alert.path); }}
                >
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </button>
              ))}
              <button type="button" className="top-pop-all" onClick={() => { setOpenPanel(null); navigate('/tasks'); }}>
                Open Tasks & Alerts
              </button>
            </div>
          )}
        </div>

        <div className="top-header-pop">
          <button
            type="button"
            className="top-header-pill top-date-pill"
            title="Open attendance for a date"
            aria-expanded={openPanel === 'date'}
            onClick={() => setOpenPanel((panel) => (panel === 'date' ? null : 'date'))}
          >
            <Calendar size={15} />
            <span>{formattedDate}</span>
          </button>
          {openPanel === 'date' && (
            <div className="top-pop-panel top-date-panel">
              <div className="top-pop-title">Open attendance</div>
              <DateField
                className="input-field"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
              />
              <button type="button" className="btn btn-primary" style={{ marginTop: '0.65rem', width: '100%' }} onClick={() => openDate(pickedDate)}>
                Open this date
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
