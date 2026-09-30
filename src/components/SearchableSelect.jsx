import React, { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { AppContext } from '../context/AppContext';

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const dropdownMemoryKey = ({ memoryKey, name, id, placeholder, builtin, reactId }) => {
  if (memoryKey) return String(memoryKey).slice(0, 160);
  const blank = (builtin || []).find((o) => o.value === '');
  const anchor = [name, id, placeholder, blank?.label].filter(Boolean).join('|').trim();
  if (anchor) return anchor.slice(0, 160);
  return String(reactId || '').slice(0, 160);
};

const mergeRemembered = (builtin, saved) => {
  const extras = (Array.isArray(saved) ? saved : [])
    .map((v) => String(v || '').trim())
    .filter((v) => v && !builtin.some((o) => sameText(o.value, v) || sameText(o.label, v)));
  if (!extras.length) return builtin;
  const blank = builtin.filter((o) => o.value === '');
  const rest = builtin.filter((o) => o.value !== '');
  return [
    ...blank,
    ...extras.map((v) => ({ value: v, label: v, disabled: false })),
    ...rest
  ];
};

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
  title,
  allowCustom = true,
  remember = true,
  memoryKey,
  onCommit
}) => {
  const app = useContext(AppContext);
  const data = app?.data;
  const setData = app?.setData;
  const isReady = Boolean(app?.isReady);
  const reactId = useId();
  const wrapRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const skipSave = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuPos, setMenuPos] = useState(null);

  const builtin = useMemo(() => readOptions(children, options), [children, options]);
  const memoryId = useMemo(
    () => dropdownMemoryKey({ memoryKey, name, id, placeholder, builtin, reactId }),
    [memoryKey, name, id, placeholder, builtin, reactId]
  );
  const saved = remember && allowCustom && memoryId
    ? data?.settings?.dropdownMemory?.[memoryId]
    : [];
  const opts = useMemo(() => mergeRemembered(builtin, saved), [builtin, saved]);
  const strValue = value == null ? '' : String(value);
  const selected = opts.find((o) => o.value === strValue) || null;
  const blank = opts.find((o) => o.value === '');
  const customActive = allowCustom && strValue && !selected;
  const displayLabel = selected?.label
    || (customActive ? strValue : '')
    || placeholder
    || blank?.label
    || 'Select…';
  const nativeOpts = useMemo(() => {
    if (!customActive) return opts;
    return [...opts, { value: strValue, label: strValue }];
  }, [opts, customActive, strValue]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const blankLabel = String(blank?.label || '').trim().toLowerCase();
    // Opening "All Parties" must not search for that label, or every party disappears.
    if (!typing || !q || (blankLabel && q === blankLabel)) return opts;
    return opts.filter((o) =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [opts, query, typing, blank]);

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
    setTyping(false);
    setActiveIdx(0);
  };

  const knownValue = (raw) => opts.some((o) =>
    o.value && (sameText(o.label, raw) || sameText(o.value, raw))
  );

  const persistCustom = (raw) => {
    const label = String(raw || '').trim();
    if (!remember || !allowCustom || !memoryId || !label || label.length > 80 || typeof setData !== 'function') return;
    if (builtin.some((o) => sameText(o.value, label) || sameText(o.label, label))) return;
    setData((prev) => {
      const memory = prev.settings?.dropdownMemory || {};
      const list = Array.isArray(memory[memoryId]) ? memory[memoryId] : [];
      if (list.some((v) => sameText(v, label))) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          dropdownMemory: {
            ...memory,
            [memoryId]: [...list, label].slice(-200)
          }
        }
      };
    });
  };

  const notifyCommit = (next) => {
    if (typeof onCommit !== 'function') return;
    onCommit(next);
  };

  const commitCustom = (raw) => {
    if (!allowCustom) return false;
    const next = String(raw || '').trim();
    if (!next) {
      emit('');
      close();
      return true;
    }
    const match = opts.find((o) =>
      o.value && (sameText(o.label, next) || sameText(o.value, next))
    );
    if (!match) persistCustom(next);
    const committed = match ? match.value : next;
    emit(committed);
    notifyCommit(committed);
    close();
    return true;
  };

  const pick = (opt) => {
    if (!opt || opt.disabled) return;
    emit(opt.value);
    if (opt.value) notifyCommit(opt.value);
    close();
  };

  const openMenu = () => {
    if (disabled) return;
    setQuery('');
    setTyping(false);
    setOpen(true);
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
    if (!isReady || !allowCustom || !remember || open) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const label = strValue.trim();
    if (!label || label.length > 80) return;
    if (builtin.some((o) => sameText(o.value, label) || sameText(o.label, label))) return;
    persistCustom(label);
    // Save a value already stored on the form once the menu is closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strValue, open, isReady, memoryId, allowCustom, remember]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      if (allowCustom && typing) commitCustom(query);
      else close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, allowCustom, query, typing]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => {
      if (!allowCustom) searchRef.current?.focus();
    });
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
      openMenu();
    }
  };

  const onSearchKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      skipSave.current = true;
      close();
      wrapRef.current?.querySelector('.searchable-select-trigger')?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
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
      const typed = query.trim();
      const exact = opts.find((o) => o.value && (sameText(o.label, typed) || sameText(o.value, typed)));
      if (typing && typed && !exact) {
        commitCustom(typed);
        return;
      }
      if (exact) {
        pick(exact);
        return;
      }
      const highlighted = filtered[activeIdx];
      if (highlighted && !highlighted.disabled) {
        pick(highlighted);
        return;
      }
      commitCustom(query);
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
        {!allowCustom && (
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
        )}
        <div className="searchable-select-list" style={{ maxHeight: menuPos.maxHeight }}>
          {allowCustom && !query.trim() && (
            <div className="searchable-select-empty">Type your own value</div>
          )}
          {filtered.length === 0 && !allowCustom && (
            <div className="searchable-select-empty">No matches</div>
          )}
          {allowCustom && query.trim() && !knownValue(query) && (
            <button
              type="button"
              className={`searchable-select-option${filtered.length === 0 ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitCustom(query)}
            >
              Use “{query.trim()}”
            </button>
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

  const boxed = style?.width && style.width !== '100%';
  const wrapStyle = boxed
    ? { width: style.width, maxWidth: style.maxWidth || '100%', flex: '0 0 auto' }
    : undefined;

  return (
    <div
      ref={wrapRef}
      className={`searchable-select${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}${allowCustom ? ' is-combo' : ''}`}
      title={title}
      style={wrapStyle}
    >
      <select
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        value={nativeOpts.some((o) => o.value === strValue) ? strValue : ''}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden="true"
        className="searchable-select-native"
      >
        {nativeOpts.map((o, i) => (
          <option key={`${o.value}-${i}`} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {allowCustom ? (
        <div className="searchable-select-combo-wrap">
          <input
            ref={searchRef}
            type="text"
            disabled={disabled}
            className={`searchable-select-trigger searchable-select-combo-input ${className || ''}`.trim()}
            style={{ ...(style || {}), width: '100%' }}
            placeholder={placeholder || blank?.label || 'Select or type…'}
            value={open && typing ? query : ((selected && selected.value !== '') ? selected.label : (customActive ? strValue : ''))}
            onChange={(e) => {
              const v = e.target.value;
              setTyping(true);
              setQuery(v);
              setActiveIdx(0);
              if (!open) setOpen(true);
              if (blank && sameText(v, blank.label)) {
                emit('');
                return;
              }
              const match = opts.find((o) =>
                o.value && (
                  o.label.toLowerCase() === v.trim().toLowerCase()
                  || o.value.toLowerCase() === v.trim().toLowerCase()
                )
              );
              emit(match ? match.value : v);
            }}
            onFocus={() => {
              if (disabled || open) return;
              setQuery('');
              setTyping(false);
              setOpen(true);
            }}
            onKeyDown={onSearchKey}
          />
          <button
            type="button"
            className="searchable-select-caret-hit"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (disabled) return;
              if (open) {
                if (allowCustom && typing && query.trim()) commitCustom(query);
                else close();
              } else openMenu();
            }}
          >
            <ChevronDown size={16} className="searchable-select-caret" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`searchable-select-trigger ${className || ''}`.trim()}
          disabled={disabled}
          style={{ ...(style || {}), width: '100%' }}
          onClick={() => !disabled && (open ? close() : openMenu())}
          onKeyDown={onTriggerKey}
        >
          <span className={`searchable-select-value${!selected && !customActive ? ' is-placeholder' : ''}`}>
            {displayLabel}
          </span>
          <ChevronDown size={16} className="searchable-select-caret" />
        </button>
      )}
      {menu}
    </div>
  );
};

export default SearchableSelect;
