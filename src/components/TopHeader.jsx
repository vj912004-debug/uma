import React, { useState } from 'react';
import { Search, Bell, Calendar, MapPin, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const TopHeader = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('Kotambi Plant');

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const displayName = currentUser?.name || currentUser?.username || 'Amit Patel';
  const roleName = currentUser?.role || 'Admin';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'AP';

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      // Navigate to under-process or search targets
      navigate(`/under-process?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="top-header">
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
        <button className="top-header-btn top-bell-btn" title="Notifications">
          <Bell size={18} />
          <span className="bell-badge">3</span>
        </button>

        {/* Date Badge */}
        <div className="top-header-pill top-date-pill">
          <Calendar size={15} />
          <span>{formattedDate}</span>
        </div>

        {/* Location / Plant Selector */}
        <div className="top-header-pill top-plant-pill">
          <MapPin size={15} />
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="top-plant-select"
          >
            <option value="Kotambi Plant">Kotambi Plant</option>
            <option value="Unit 2 Plant">Unit 2 Plant</option>
            <option value="Head Office">Head Office</option>
          </select>
          <ChevronDown size={14} className="top-plant-caret" />
        </div>

        {/* User Profile Pill */}
        <div className="top-user-pill">
          <div className="top-user-avatar">{initials}</div>
          <div className="top-user-info">
            <span className="top-user-name">{displayName}</span>
            <span className="top-user-role">{roleName}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
