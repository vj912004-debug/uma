import React from 'react';
import SearchableSelect from './SearchableSelect';
import {
  GST_TYPE_CGST_SGST,
  GST_TYPE_IGST,
  normalizeGstType,
  splitTaxableGstAmount
} from '../utils/taxInvoiceLayout';

/**
 * Shared GST controls for finance docs (TI / PI / PO / CN / DN).
 * Select CGST+SGST (Gujarat) or IGST (out of Gujarat / interstate).
 */
const GstTaxBlock = ({
  taxable = 0,
  taxRate = 18,
  gstType = GST_TYPE_CGST_SGST,
  discount,
  onTaxRateChange,
  onGstTypeChange,
  showDiscountInput = false,
  discountValue = 0,
  onDiscountChange,
  showSubtotal = true,
  subtotal,
  compact = false,
  showGrandTotal = true,
  extraRows = null
}) => {
  const type = normalizeGstType(gstType);
  const rate = parseInt(taxRate, 10) || 0;
  const taxableAmt = Math.max(0, parseFloat(taxable) || 0);
  const { taxAmount, cgst, sgst, igst } = splitTaxableGstAmount(taxableAmt, rate, type);
  const grand = taxableAmt + taxAmount;
  const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: compact ? '0.8rem' : '0.85rem',
    gap: '0.5rem'
  };
  const selectStyle = compact
    ? { width: '120px', padding: '0.2rem', height: 'auto' }
    : { width: '140px', padding: '0.2rem', height: 'auto' };

  return (
    <>
      {showSubtotal && (
        <div style={rowStyle}>
          <span>Subtotal:</span>
          <span style={{ fontWeight: 600 }}>
            ₹{(subtotal != null ? subtotal : taxableAmt + (parseFloat(discount) || 0)).toFixed(2)}
          </span>
        </div>
      )}
      {showDiscountInput && (
        <div style={rowStyle}>
          <span>Discount (₹):</span>
          <input
            type="number"
            className="input-field"
            style={{ width: '100px', padding: '0.2rem', height: 'auto' }}
            value={discountValue}
            onChange={(e) => onDiscountChange?.(parseFloat(e.target.value) || 0)}
          />
        </div>
      )}
      {(parseFloat(discount) || 0) > 0 && (
        <div style={rowStyle}>
          <span>Taxable Amount:</span>
          <span>₹{taxableAmt.toFixed(2)}</span>
        </div>
      )}
      <div style={rowStyle}>
        <span>GST Type:</span>
        <SearchableSelect
          className="input-field"
          style={selectStyle}
          value={type}
          onChange={(e) => onGstTypeChange?.(normalizeGstType(e.target.value))}
        >
          <option value={GST_TYPE_CGST_SGST}>CGST + SGST (Gujarat)</option>
          <option value={GST_TYPE_IGST}>IGST (Out of Gujarat)</option>
        </SearchableSelect>
      </div>
      <div style={rowStyle}>
        <span>GST Rate (%):</span>
        <SearchableSelect
          className="input-field"
          style={{ width: '100px', padding: '0.2rem', height: 'auto' }}
          value={rate}
          onChange={(e) => onTaxRateChange?.(parseInt(e.target.value, 10) || 0)}
        >
          <option value="18">18%</option>
          <option value="12">12%</option>
          <option value="5">5%</option>
          <option value="0">0%</option>
        </SearchableSelect>
      </div>
      {type === GST_TYPE_IGST ? (
        <div style={rowStyle}>
          <span>IGST @{rate}%:</span>
          <span>₹{igst.toFixed(2)}</span>
        </div>
      ) : (
        <>
          <div style={rowStyle}>
            <span>CGST @{(rate / 2)}%:</span>
            <span>₹{cgst.toFixed(2)}</span>
          </div>
          <div style={rowStyle}>
            <span>SGST @{(rate / 2)}%:</span>
            <span>₹{sgst.toFixed(2)}</span>
          </div>
        </>
      )}
      {extraRows}
      {showGrandTotal && (
        <div
          style={{
            ...rowStyle,
            borderTop: '1px solid var(--border-color)',
            paddingTop: '0.5rem',
            fontSize: compact ? '0.95rem' : '1rem',
            fontWeight: 'bold',
            color: 'var(--text-main)'
          }}
        >
          <span>Grand Total:</span>
          <span>₹{grand.toFixed(2)}</span>
        </div>
      )}
    </>
  );
};

export default GstTaxBlock;
