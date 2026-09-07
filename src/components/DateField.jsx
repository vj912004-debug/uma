import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

/** Date input with visible calendar control (stores YYYY-MM-DD). */
const DateField = ({
  className = 'input-field',
  style,
  value = '',
  onChange,
  onClick,
  onFocus,
  disabled,
  readOnly,
  ...rest
}) => {
  const ref = useRef(null);
  const {
    width,
    minWidth,
    maxWidth,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    alignSelf,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    ...inputStyle
  } = style || {};
  const wrapStyle = {
    width: width ?? '100%',
    minWidth,
    maxWidth,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    alignSelf,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  };

  const openPicker = () => {
    if (disabled || readOnly) return;
    const el = ref.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') el.showPicker();
      else el.focus();
    } catch {
      el.focus();
    }
  };

  return (
    <div
      className={`dt-field-wrap${disabled || readOnly ? ' is-disabled' : ''}`}
      style={wrapStyle}
      onClick={(e) => {
        if (e.target === ref.current) return;
        openPicker();
      }}
    >
      <input
        ref={ref}
        type="date"
        className={`${className} dt-field-input`.trim()}
        style={inputStyle}
        value={value || ''}
        onChange={onChange}
        onClick={(e) => {
          onClick?.(e);
          openPicker();
        }}
        onFocus={(e) => {
          onFocus?.(e);
        }}
        disabled={disabled}
        readOnly={readOnly}
        {...rest}
      />
      <button
        type="button"
        className="dt-field-btn"
        tabIndex={-1}
        disabled={disabled || readOnly}
        aria-label="Open calendar"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openPicker();
        }}
      >
        <Calendar size={16} strokeWidth={2} />
      </button>
    </div>
  );
};

export default DateField;
