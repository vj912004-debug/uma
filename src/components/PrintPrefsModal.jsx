import { useState } from 'react';
import { Type } from 'lucide-react';
import {
  PRINT_FONTS,
  PRINT_FONT_SIZES,
  normalizePrintPrefs
} from '../utils/printPrefs';

const DOC_LABELS = {
  TI: 'Tax Invoice',
  PI: 'Proforma Invoice',
  PO: 'Purchase Order',
  DN: 'Debit Note',
  CN: 'Credit Note',
  DC: 'Delivery Challan',
  BPR: 'BPR',
  PL: 'Packing List',
  QUOTATION: 'Quotation',
  'Payment Follow-Up': 'Payment Follow-Up'
};

const PrintPrefsModal = ({ mode, docType, initial, onCancel, onConfirm }) => {
  const [fontFamily, setFontFamily] = useState(initial.fontFamily);
  const [fontSize, setFontSize] = useState(initial.fontSize);
  const [saveDefault, setSaveDefault] = useState(true);
  const docLabel = DOC_LABELS[docType] || docType || 'Document';
  const actionLabel = mode === 'view' ? 'Preview PDF' : 'Download PDF';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-overlay, rgba(15, 10, 30, 0.55))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
        padding: '1.5rem'
      }}
      onClick={onCancel}
    >
      <div
        className="premium-card"
        style={{
          width: 'min(440px, 100%)',
          padding: '1.5rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <Type size={22} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Print Format</h2>
        </div>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Choose font and size for <strong>{docLabel}</strong>, then {mode === 'view' ? 'preview' : 'download'}.
        </p>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Font</label>
          <select
            className="input-field"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            style={{ fontFamily }}
          >
            {PRINT_FONTS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Font Size</label>
          <select
            className="input-field"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          >
            {PRINT_FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} px{s === 12 ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '0.85rem 1rem',
            marginBottom: '1.1rem',
            background: 'var(--bg-secondary, #f8f7fc)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6 }}>Preview</div>
          <div style={{ fontFamily, fontSize, lineHeight: 1.4, color: 'var(--text-primary, #231f20)' }}>
            UMA MICRON — Sample invoice text at {fontSize}px
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={saveDefault}
            onChange={(e) => setSaveDefault(e.target.checked)}
          />
          Remember as default for all prints
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(normalizePrintPrefs({ fontFamily, fontSize }), saveDefault)}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintPrefsModal;
