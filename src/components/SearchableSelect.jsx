import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const readOptions = (children, optionsProp) => {
  if (Array.isArray(optionsProp) && optionsProp.length) {
    return optionsProp.map((o) => ({
      value: o.value == null ? '' : String(o.value),
      label: String(o.label ?? o.value ?? ''),
      disabled: Boolean(o.disabled)
    }));
  }
  const opts = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== 'option') return;
    opts.push({
      value: child.props.value == null ? '' : String(child.props.value),
      label: String(child.props.children ?? child.props.value ?? '').trim(),
      disabled: Boolean(child.props.disabled)
    });
  });
  return opts;
};

const SearchableSelect = ({
  value = '',
  onChange,
  children,
  options,
  className = 'input-field',
  style,
  required,
  disabled,
  name,
  id,
  placeholder,
  title
}) => {
  const wrapRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuPos, setMenuPos] = useState(null);

  const opts = useMemo(() => readOptions(children, options), [children, options]);
  const strValue = value == null ? '' : String(value);
  const selected = opts.find((o) => o.value === strValue) || null;
  const blank = opts.find((o) => o.value === '');
  const displayLabel = selected?.label
    || placeholder
    || blank?.label
    || 'Select…';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opts;
    return opts.filter((o) =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [opts, query]);

  const emit = (next) => {
    if (typeof onChange !== 'function') return;
    onChange({
      target: { value: next, name: name || '', id: id || '' },
      currentTarget: { value: next, name: name || '', id: id || '' }
    });
  };

  const close = () => {
    setOpen(false);
    setQuery('');
    setActiveIdx(0);
  };

  const pick = (opt) => {
    if (!opt || opt.disabled) return;
    emit(opt.value);
    close();
  };

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const place = () => {
      const r = wrapRef.current.getBoundingClientRect();
      const maxH = 240;
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const flip = spaceBelow < 140 && spaceAbove > spaceBelow;
      const height = Math.max(120, Math.min(maxH, flip ? spaceAbove : spaceBelow));
      setMenuPos({
        left: Math.max(8, r.left),
        width: Math.max(r.width, 140),
        maxHeight: height,
        top: flip ? undefined : r.bottom + 4,
        bottom: flip ? window.innerHeight - r.top + 4 : undefined
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => searchRef.current?.focus());
    const idx = Math.max(0, filtered.findIndex((o) => o.value === strValue));
    setActiveIdx(idx);
    return () => cancelAnimationFrame(t);
    // Only sync highlight when the menu opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-ss-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const onTriggerKey = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onSearchKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      wrapRef.current?.querySelector('.searchable-select-trigger')?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      pick(filtered[activeIdx]);
    }
  };

  const menu = open && menuPos && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={listRef}
        className="searchable-select-menu"
        style={{
          position: 'fixed',
          left: menuPos.left,
          width: menuPos.width,
          top: menuPos.top,
          bottom: menuPos.bottom,
          maxHeight: menuPos.maxHeight
        }}
      >
        <input
          ref={searchRef}
          className="searchable-select-search"
          value={query}
          placeholder="Type to search…"
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={onSearchKey}
        />
        <div className="searchable-select-list">
          {filtered.length === 0 && (
            <div className="searchable-select-empty">No matches</div>
          )}
          {filtered.map((opt, idx) => (
            <button
              key={`${opt.value}-${idx}`}
              type="button"
              data-ss-idx={idx}
              className={`searchable-select-option${idx === activeIdx ? ' is-active' : ''}${opt.value === strValue ? ' is-selected' : ''}`}
              disabled={opt.disabled}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(opt)}
            >
              {opt.label || '\u00a0'}
            </button>
          ))}
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <div
      ref={wrapRef}
      className={`searchable-select${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`}
      title={title}
    >
      <select
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        value={strValue}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden="true"
        className="searchable-select-native"
      >
        {opts.map((o, i) => (
          <option key={`${o.value}-${i}`} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      <button
        type="button"
        className={`searchable-select-trigger ${className || ''}`.trim()}
        disabled={disabled}
        style={{ ...(style || {}), width: '100%' }}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
      >
        <span className={`searchable-select-value${!selected || selected.value === '' ? ' is-placeholder' : ''}`}>
          {displayLabel}
        </span>
        <ChevronDown size={16} className="searchable-select-caret" />
      </button>
      {menu}
    </div>
  );
};

export default SearchableSelect;
