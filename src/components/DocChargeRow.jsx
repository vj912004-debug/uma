import React from 'react';
import { GripVertical } from 'lucide-react';
import { qtyInputValue, rateInputValue } from '../utils/documentCharges';

const DocChargeRow = ({
  item, label, charges, rates, qtys, materialQty, onToggle, onQtyChange, onRateChange,
  draggable: canDrag, dragging, dropActive, onDragStart, onDragEnd, onDragOver, onDrop
}) => (
  <div
    className={`charge-row${dragging ? ' charge-row-dragging' : ''}${dropActive ? ' charge-row-drop' : ''}`}
    onDragOver={canDrag ? onDragOver : undefined}
    onDrop={canDrag ? onDrop : undefined}
  >
    {canDrag && (
      <span
        className="charge-row-grip"
        draggable
        role="button"
        aria-label={`Reorder ${label || item.label}`}
        title="Drag to reorder"
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <GripVertical size={14} />
      </span>
    )}
    <label>
      <input type="checkbox" checked={!!charges?.[item.key]} onChange={() => onToggle(item.key)} />
      <span className="charge-row-name">{label || item.label}</span>
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
