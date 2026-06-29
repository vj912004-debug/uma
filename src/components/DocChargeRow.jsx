import React from 'react';

const DocChargeRow = ({ item, label, charges, rates, qtys, materialQty, onToggle, onQtyChange, onRateChange }) => (
  <div className="charge-row">
    <label>
      <input type="checkbox" checked={!!charges[item.key]} onChange={() => onToggle(item.key)} />
      {label || item.label}
    </label>
    {charges[item.key] && (
      <div className="charge-row-fields">
        <span>Qty:</span>
        <input
          type="number"
          step={item.isQtyRate ? '0.01' : '1'}
          className="input-field input-compact"
          value={qtys?.[item.key] ?? 1}
          onChange={e => onQtyChange(item.key, e.target.value)}
          min="0"
        />
        <span>Rate: ₹</span>
        <input
          type="number"
          className="input-field input-compact"
          style={{ width: '72px' }}
          value={rates?.[item.key] ?? 0}
          onChange={e => onRateChange(item.key, e.target.value)}
          min="0"
        />
      </div>
    )}
  </div>
);

export default DocChargeRow;
