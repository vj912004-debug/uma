import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { parseTimeParts, toTimeValue24 } from '../utils/dateUtils';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/**
 * 12-hour time picker (AM/PM). Stores value as 24h "HH:MM" for compatibility.
 * Does not invent a time until hour, minute, and AM/PM are all chosen.
 */
const TimeField = ({
  className = 'input-field',
  style,
  value = '',
  onChange,
  disabled,
  readOnly,
  required,
  ...rest
}) => {
  const parts = useMemo(() => parseTimeParts(value), [value]);
  const fromValue = useMemo(() => {
    if (!parts) return { hour12: '', minutes: '', ampm: '' };
    return {
      hour12: String((parts.hours24 % 12) || 12).padStart(2, '0'),
      minutes: String(parts.minutes).padStart(2, '0'),
      ampm: parts.hours24 >= 12 ? 'PM' : 'AM'
    };
  }, [parts]);

  const [draft, setDraft] = useState(fromValue);

  useEffect(() => {
    setDraft(fromValue);
  }, [fromValue.hour12, fromValue.minutes, fromValue.ampm, value]);

  const commit = (next) => {
    if (!onChange) return;
    if (!next.hour12 || !next.minutes || !next.ampm) {
      if (value) onChange({ target: { value: '' } });
      return;
    }
    let h = parseInt(next.hour12, 10);
    if (next.ampm === 'AM') h = h % 12;
    else h = (h % 12) + 12;
    onChange({ target: { value: toTimeValue24(h, next.minutes) } });
  };

  const updatePart = (key, partValue) => {
    const next = { ...draft, [key]: partValue };
    setDraft(next);
    if (!partValue) {
      if (value) onChange?.({ target: { value: '' } });
      return;
    }
    if (next.hour12 && next.minutes && next.ampm) commit(next);
  };

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
    ...innerStyle
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
    marginLeft
  };

  const selectStyle = {
    ...innerStyle,
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
    padding: '0.15rem 0.2rem',
    minWidth: 0,
    width: 'auto',
    font: 'inherit',
    color: 'inherit',
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: disabled || readOnly ? 'default' : 'pointer'
  };

  return (
    <div
      className={`dt-field-wrap time-field-12h${disabled || readOnly ? ' is-disabled' : ''}`}
      style={wrapStyle}
      title="12-hour time"
    >
      <div className={`time-field-12h-inner ${className}`.trim()} style={innerStyle}>
        <Clock size={15} strokeWidth={2} className="time-field-12h-icon" aria-hidden />
        <select
          aria-label="Hour"
          className="time-field-12h-select"
          style={selectStyle}
          value={draft.hour12}
          disabled={disabled || readOnly}
          required={required && !value}
          onChange={(e) => updatePart('hour12', e.target.value)}
          {...rest}
        >
          <option value="">HH</option>
          {HOURS_12.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="time-field-12h-sep">:</span>
        <select
          aria-label="Minute"
          className="time-field-12h-select"
          style={selectStyle}
          value={draft.minutes}
          disabled={disabled || readOnly}
          required={required && !value}
          onChange={(e) => updatePart('minutes', e.target.value)}
        >
          <option value="">MM</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          aria-label="AM or PM"
          className="time-field-12h-select time-field-12h-ampm"
          style={selectStyle}
          value={draft.ampm}
          disabled={disabled || readOnly}
          required={required && !value}
          onChange={(e) => updatePart('ampm', e.target.value)}
        >
          <option value="">--</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};

export default TimeField;
