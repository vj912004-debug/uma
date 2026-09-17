import React from 'react';

/**
 * Shared All / Pending / Completed tabs for list modules.
 * Counts are optional; omit a count to hide the number badge.
 */
const StatusTabBar = ({
  value = 'all',
  onChange,
  allCount,
  pendingCount,
  completedCount,
  pendingLabel = 'Pending',
  completedLabel = 'Completed',
  allLabel = 'All',
  style
}) => {
  const tabs = [
    { id: 'all', label: allLabel, count: allCount },
    { id: 'pending', label: pendingLabel, count: pendingCount },
    { id: 'completed', label: completedLabel, count: completedCount }
  ];

  return (
    <div className="tab-bar status-tab-bar" style={style}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-btn${value === tab.id ? ' active' : ''}`}
          onClick={() => onChange?.(tab.id)}
        >
          {tab.label}
          {typeof tab.count === 'number' ? ` (${tab.count})` : ''}
        </button>
      ))}
    </div>
  );
};

export default StatusTabBar;
