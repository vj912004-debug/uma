import React from 'react';
import { qtyInputValue, rateInputValue } from '../utils/documentCharges';

const DocChargeRow = ({ item, label, charges, rates, qtys, materialQty, onToggle, onQtyChange, onRateChange }) => (
  <div className="charge-row">
    <label>
      <input type="checkbox" checked={!!charges?.[item.key]} onChange={() => onToggle(item.key)} />
      {label || item.label}
    </label>
    {charges?.[item.key] && (
      <div className="charge-row-fields">
        <span>Qty:</span>
        <input
          type="number"
          step={item.isQtyRate ? '0.01' : '1'}
          className="input-field input-compact"
          value={qtyInputValue(qtys?.[item.key])}
          placeholder="NIL"
          onChange={e => onQtyChange(item.key, e.target.value)}
          min="0"
        />
        <span>Rate: ₹</span>
        <input
          type="number"
          className="input-field input-compact"
          style={{ width: '110px' }}
          value={rateInputValue(rates?.[item.key])}
          placeholder="0"
          onChange={e => onRateChange(item.key, e.target.value)}
          min="0"
        />
      </div>
    )}
  </div>
);

export default DocChargeRow;
