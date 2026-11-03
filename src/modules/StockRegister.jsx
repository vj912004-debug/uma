import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Clock, Eye, Filter, Layers, Package, Pencil, RotateCcw, Save, Search, Settings, TrendingUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import { DEFAULT_STOCK_ITEMS } from '../utils/appState';
import { currentLocalDateTime, formatDate } from '../utils/dateUtils';

const today = () => currentLocalDateTime().date;

const monthBounds = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { from, to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(last)}` };
};

const showDate = (value) => {
  const formatted = formatDate(value);
  return formatted ? formatted.replace(/\//g, '-') : '—';
};

const inRange = (value, from, to) => {
  const day = String(value || '').slice(0, 10);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

const beforeDay = (value, from) => {
  const day = String(value || '').slice(0, 10);
  return !!from && !!day && day < from;
};

const monthsAgo = (count) => {
  const now = new Date();
  now.setMonth(now.getMonth() - count);
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const formatQty = (n) => {
  const value = Number(n) || 0;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const formatInr = (n) => `₹ ${Math.round(Number(n) || 0).toLocaleString('en-IN')}/-`;

const inferKind = (name) => {
  const text = String(name || '').toLowerCase();
  if (text.includes('liner')) return 'liner';
  if (text.includes('drum')) return 'drum';
  return 'other';
};

const isUmaNewDrumRow = (row) => {
  if (!row) return false;
  if (row.umaNewDrum) return true;
  const name = String(row.batchNo || '').trim().toLowerCase();
  return name === 'uma new drum' || name === 'new uma drum';
};

const emptyFilters = () => {
  const bounds = monthBounds();
  return {
    category: 'Drum & Liner',
    itemId: '',
    location: '',
    from: bounds.from,
    to: bounds.to
  };
};

const blankEntry = () => ({
  id: '',
  category: 'Drum & Liner',
  uom: 'Nos.',
  name: '',
  openingStock: '',
  specification: '',
  location: 'Main Store',
  purchaseDate: today(),
  supplier: '',
  rate: '',
  remarks: '',
  tracksUmaDrums: false,
  lowStockLevel: 0
});

const formatRate = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StockRegister = () => {
  const { data, setData, updateData, updateItem } = useAppContext();
  const historyRef = useRef(null);
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState('stk-hdpe-drum');
  const [historyRange, setHistoryRange] = useState('3');
  const [screen, setScreen] = useState('register');
  const [entry, setEntry] = useState(blankEntry);
  const [itemQuery, setItemQuery] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listCategory, setListCategory] = useState('');
  const [showListFilter, setShowListFilter] = useState(false);

  useEffect(() => {
    if (!Array.isArray(data.stockItems) || data.stockItems.length === 0) {
      setData((prev) => ({
        ...prev,
        stockItems: DEFAULT_STOCK_ITEMS.map((item) => ({ ...item }))
      }));
    }
  }, [data.stockItems, setData]);

  const items = useMemo(
    () => (data.stockItems || []).filter((item) => item && !item.isDeleted),
    [data.stockItems]
  );

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))],
    [items]
  );
  const locations = useMemo(
    () => [...new Set(items.map((item) => item.location).filter(Boolean))],
    [items]
  );

  const autoMovements = useMemo(() => {
    const tracked = items.find((item) => item.tracksUmaDrums);
    if (!tracked) return [];
    const rate = Number(tracked.rate) || 0;
    const rows = [];
    (data.umaDrumReceipts || []).forEach((receipt) => {
      if (!receipt || receipt.isDeleted) return;
      const qty = Number(receipt.qty) || 0;
      if (qty <= 0) return;
      rows.push({
        id: `uma-in-${receipt.id}`,
        itemId: tracked.id,
        date: receipt.date || String(receipt.createdAt || '').slice(0, 10),
        type: 'Purchase',
        refNo: 'INWARD',
        qty,
        rate: Number(receipt.rate) || rate,
        remarks: receipt.note || 'Uma drum inward'
      });
    });
    (data.packingLists || []).forEach((pl) => {
      if (!pl || pl.isDeleted) return;
      (pl.batches || []).forEach((batch, idx) => {
        if (!isUmaNewDrumRow(batch)) return;
        const detail = [pl.partyName, batch.productName || pl.productName, batch.batchNo && batch.batchNo !== 'New Uma Drum' ? batch.batchNo : '']
          .filter(Boolean)
          .join(' / ');
        rows.push({
          id: `uma-out-${pl.id}-${idx}`,
          itemId: tracked.id,
          date: pl.date || String(pl.createdAt || '').slice(0, 10),
          type: 'Issue',
          refNo: pl.plNo || 'PL',
          qty: 1,
          rate,
          remarks: detail ? `New Uma Drum – ${detail}` : 'New Uma Drum used on packing list'
        });
      });
    });
    return rows;
  }, [items, data.umaDrumReceipts, data.packingLists]);

  const movements = useMemo(() => {
    const manual = (data.stockMovements || []).filter((row) => row && !row.isDeleted);
    return [...manual, ...autoMovements];
  }, [data.stockMovements, autoMovements]);

  const rows = useMemo(() => {
    return items
      .filter((item) => {
        if (filters.category && item.category !== filters.category) return false;
        if (filters.itemId && String(item.id) !== String(filters.itemId)) return false;
        if (filters.location && item.location !== filters.location) return false;
        return true;
      })
      .map((item) => {
        const own = movements.filter((row) => String(row.itemId) === String(item.id));
        let opening = Number(item.openingStock) || 0;
        let received = 0;
        let issued = 0;
        own.forEach((row) => {
          const qty = Number(row.qty) || 0;
          if (beforeDay(row.date, filters.from)) {
            opening += row.type === 'Issue' ? -qty : qty;
            return;
          }
          if (!inRange(row.date, filters.from, filters.to)) return;
          if (row.type === 'Issue') issued += qty;
          else received += qty;
        });
        const closing = opening + received - issued;
        const rate = Number(item.rate) || 0;
        const lowLevel = Number(item.lowStockLevel) || 0;
        const low = lowLevel > 0 && closing <= lowLevel;
        return {
          ...item,
          opening,
          received,
          issued,
          closing,
          value: closing * rate,
          low
        };
      });
  }, [items, movements, filters]);

  const totals = useMemo(() => ({
    drums: rows.filter((row) => row.kind === 'drum').reduce((sum, row) => sum + row.closing, 0),
    liners: rows.filter((row) => row.kind === 'liner').reduce((sum, row) => sum + row.closing, 0),
    value: rows.reduce((sum, row) => sum + row.value, 0),
    low: rows.filter((row) => row.low).length
  }), [rows]);

  const selected = rows.find((row) => String(row.id) === String(selectedId)) || rows[0] || null;

  const history = useMemo(() => {
    if (!selected) return [];
    const from = historyRange === 'all' ? '' : monthsAgo(Number(historyRange) || 3);
    return movements
      .filter((row) => String(row.itemId) === String(selected.id))
      .filter((row) => !from || inRange(row.date, from, today()))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [movements, selected, historyRange]);

  const viewItem = (item) => {
    setSelectedId(item.id);
    setScreen('register');
    setTimeout(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const openEntry = (item) => {
    if (!item) {
      setEntry(blankEntry());
    } else {
      setEntry({
        id: item.id,
        category: item.category || 'Drum & Liner',
        uom: item.uom === 'Nos' ? 'Nos.' : (item.uom || 'Nos.'),
        name: item.name || '',
        openingStock: item.openingStock ?? '',
        specification: item.specification || '',
        location: item.location || 'Main Store',
        purchaseDate: item.purchaseDate || today(),
        supplier: item.supplier || '',
        rate: item.rate ?? '',
        remarks: item.remarks || '',
        tracksUmaDrums: !!item.tracksUmaDrums,
        lowStockLevel: item.lowStockLevel || 0
      });
    }
    setScreen('items');
  };

  const pickItemName = (name) => {
    const match = items.find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!match) {
      setEntry((prev) => ({ ...prev, id: '', name }));
      return;
    }
    setEntry({
      id: '',
      category: match.category || 'Drum & Liner',
      uom: match.uom === 'Nos' ? 'Nos.' : (match.uom || 'Nos.'),
      name: match.name,
      openingStock: '',
      specification: match.specification || '',
      location: match.location || 'Main Store',
      purchaseDate: today(),
      supplier: match.supplier || '',
      rate: match.rate ?? '',
      remarks: '',
      tracksUmaDrums: !!match.tracksUmaDrums,
      lowStockLevel: match.lowStockLevel || 0
    });
  };

  const saveEntry = (event) => {
    event.preventDefault();
    const name = String(entry.name || '').trim();
    if (!name) {
      alert('Enter the item name.');
      return;
    }
    const qty = Number(entry.openingStock);
    if (!Number.isFinite(qty) || qty < 0) {
      alert('Enter the opening stock.');
      return;
    }
    const rate = Number(String(entry.rate || '').replace(/,/g, ''));
    if (!Number.isFinite(rate) || rate < 0) {
      alert('Enter the purchase rate.');
      return;
    }
    const fields = {
      category: entry.category || 'Drum & Liner',
      name,
      specification: entry.specification || '',
      uom: entry.uom === 'Nos.' ? 'Nos' : (entry.uom || 'Nos'),
      location: entry.location || 'Main Store',
      rate,
      supplier: entry.supplier || '',
      purchaseDate: entry.purchaseDate || today(),
      remarks: entry.remarks || '',
      kind: inferKind(name),
      tracksUmaDrums: !!entry.tracksUmaDrums,
      lowStockLevel: Number(entry.lowStockLevel) || 0
    };
    const byId = entry.id ? items.find((item) => String(item.id) === String(entry.id)) : null;
    const byName = items.find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
    if (fields.tracksUmaDrums) {
      items.filter((item) => item.tracksUmaDrums && String(item.id) !== String((byId || byName)?.id || '')).forEach((item) => {
        updateItem('stockItems', item.id, { ...item, tracksUmaDrums: false });
      });
    }
    if (byId) {
      updateItem('stockItems', byId.id, { ...byId, ...fields, openingStock: qty });
      setSelectedId(byId.id);
    } else if (byName) {
      updateItem('stockItems', byName.id, { ...byName, ...fields });
      if (qty > 0) {
        updateData('stockMovements', {
          id: `mov-${Date.now()}`,
          itemId: byName.id,
          date: fields.purchaseDate,
          type: 'Purchase',
          refNo: fields.supplier || 'PURCHASE',
          qty,
          rate,
          remarks: fields.remarks
        });
      }
      setSelectedId(byName.id);
    } else {
      const id = `stk-${Date.now()}`;
      updateData('stockItems', { ...fields, id, openingStock: qty });
      setSelectedId(id);
    }
    setEntry(blankEntry());
    setListPage(1);
  };

  const categoryOptions = useMemo(
    () => [...new Set(['Drum & Liner', 'Packing Material', ...items.map((item) => item.category).filter(Boolean)])],
    [items]
  );
  const locationOptions = useMemo(
    () => [...new Set(['Main Store', ...items.map((item) => item.location).filter(Boolean)])],
    [items]
  );
  const supplierOptions = useMemo(() => {
    const names = [
      ...(data.purchaseSuppliers || []).map((row) => row.supplierName),
      ...(data.parties || []).map((row) => row.partyName || row.name),
      ...items.map((item) => item.supplier)
    ].map((name) => String(name || '').trim()).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [data.purchaseSuppliers, data.parties, items]);

  const catalog = useMemo(() => items.map((item) => {
    const own = movements.filter((row) => String(row.itemId) === String(item.id));
    let currentStock = Number(item.openingStock) || 0;
    let lastPurchase = item.purchaseDate || '';
    let lastRemarks = item.remarks || '';
    let lastRate = Number(item.rate) || 0;
    own.forEach((row) => {
      const qty = Number(row.qty) || 0;
      currentStock += row.type === 'Issue' ? -qty : qty;
      if (row.type !== 'Issue' && String(row.date || '') >= String(lastPurchase || '')) {
        lastPurchase = row.date || lastPurchase;
        if (row.remarks) lastRemarks = row.remarks;
        if (Number(row.rate)) lastRate = Number(row.rate);
      }
    });
    return { ...item, currentStock, lastPurchase, lastRemarks, lastRate };
  }).filter((row) => {
    if (listCategory && row.category !== listCategory) return false;
    const query = itemQuery.trim().toLowerCase();
    if (!query) return true;
    return [row.name, row.specification, row.category, row.remarks, row.lastRemarks].join(' ').toLowerCase().includes(query);
  }), [items, movements, listCategory, itemQuery]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(catalog.length / pageSize));
  const safePage = Math.min(listPage, pageCount);
  const pageRows = catalog.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="stock-register">
      <style>{`
        .stock-register { display: flex; flex-direction: column; gap: 1rem; }
        .sr-title { display: flex; align-items: center; gap: 0.7rem; }
        .sr-title h1 { margin: 0; font-size: 1.7rem; font-weight: 800; color: #1f1633; }
        .sr-gear {
          width: 36px; height: 36px; border-radius: 10px;
          display: grid; place-items: center; color: #5b1c85; background: #f3e8ff;
        }
        .sr-filters {
          display: grid;
          grid-template-columns: 1.1fr 1.1fr 1fr 0.9fr 0.9fr auto;
          gap: 0.75rem;
          align-items: end;
          padding: 1rem 1.1rem;
        }
        .sr-filters label { display: block; font-size: 0.75rem; font-weight: 700; color: #5b1c85; margin-bottom: 0.3rem; }
        .sr-actions { display: flex; gap: 0.45rem; }
        .sr-search, .sr-reset, .sr-add {
          height: 42px; border-radius: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;
        }
        .sr-search { background: #5b1c85; color: #fff; border: none; padding: 0 0.95rem; }
        .sr-reset, .sr-add { background: #fff; color: #5b1c85; border: 1px solid #d8c4ea; padding: 0 0.8rem; }
        .sr-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem; }
        .sr-kpi { display: flex; align-items: center; gap: 0.8rem; padding: 0.95rem 1rem; }
        .sr-kpi-icon { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0; }
        .sr-kpi b { display: block; font-size: 1.25rem; color: #1f1633; line-height: 1.2; }
        .sr-kpi span { font-size: 0.78rem; color: #6b6280; font-weight: 600; }
        .sr-table-wrap, .sr-history { padding: 0; overflow: hidden; }
        .sr-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
        .sr-table th { background: #5b1c85; color: #fff; font-weight: 700; padding: 0.7rem 0.55rem; text-align: center; white-space: nowrap; }
        .sr-table th:nth-child(3), .sr-table td:nth-child(3) { text-align: left; }
        .sr-table td { padding: 0.65rem 0.55rem; text-align: center; border-bottom: 1px solid #f0e8f6; color: #2a2438; }
        .sr-table tbody tr:hover { background: #faf7fd; }
        .sr-thumb { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; margin: 0 auto; background: #f6f0fb; color: #5b1c85; }
        .sr-name { font-weight: 700; }
        .sr-pill { display: inline-flex; min-width: 78px; justify-content: center; border-radius: 999px; padding: 0.22rem 0.6rem; font-size: 0.75rem; font-weight: 800; }
        .sr-pill.in { background: #d1fae5; color: #047857; }
        .sr-pill.low { background: #ffedd5; color: #c2410c; }
        .sr-icon-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid #e4d4f0; background: #fff; color: #5b1c85; cursor: pointer; margin: 0 0.15rem; }
        .sr-history-head {
          display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
          background: #5b1c85; color: #fff; padding: 0.75rem 1rem; font-weight: 800;
        }
        .sr-history-head select { border: none; border-radius: 8px; padding: 0.35rem 0.5rem; color: #5b1c85; font-weight: 700; }
        .sr-modal-back { position: fixed; inset: 0; background: rgba(24, 16, 36, 0.45); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .sr-modal { width: min(720px, 96vw); max-height: 90vh; overflow: auto; padding: 1.1rem 1.2rem 1.25rem; }
        .sr-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
        .sr-form-grid label { font-size: 0.75rem; font-weight: 700; color: #5b1c85; }
        .sr-tabs { display: flex; gap: 0.45rem; }
        .sr-tabs button { border: 1px solid #e4d4f0; background: #fff; color: #5b1c85; border-radius: 999px; padding: 0.4rem 0.9rem; font-weight: 700; cursor: pointer; }
        .sr-tabs button.on { background: #5b1c85; color: #fff; border-color: #5b1c85; }
        .sr-bar { display: flex; align-items: center; gap: 0.55rem; background: #5b1c85; color: #fff; padding: 0.75rem 1rem; font-weight: 800; }
        .sr-entry { padding: 1rem 1.1rem 1.1rem; }
        .sr-entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem 1.2rem; }
        .sr-entry label { display: block; font-size: 0.78rem; font-weight: 700; color: #5b1c85; margin-bottom: 0.28rem; }
        .sr-stock-box { margin-top: 0.95rem; border: 1px solid #eadff3; border-radius: 12px; padding: 0.85rem 0.9rem 1rem; background: #fcfbfe; }
        .sr-stock-box h3 { margin: 0 0 0.7rem; font-size: 0.92rem; color: #3b2a55; }
        .sr-entry-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.9rem; }
        .sr-list-tools { margin-left: auto; display: flex; align-items: center; gap: 0.4rem; }
        .sr-list-tools input { border: none; border-radius: 8px; padding: 0.4rem 0.6rem; min-width: 180px; color: #2a2438; }
        .sr-page { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 0.9rem; color: #6b6280; font-size: 0.8rem; }
        .sr-page-btns { display: flex; gap: 0.3rem; }
        .sr-page-btns button { min-width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e4d4f0; background: #fff; color: #5b1c85; cursor: pointer; font-weight: 700; }
        .sr-page-btns button.on { background: #5b1c85; color: #fff; border-color: #5b1c85; }
        @media (max-width: 1100px) {
          .sr-filters, .sr-kpis { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="sr-title">
        <span className="sr-gear"><Settings size={18} /></span>
        <h1>Stock Register</h1>
      </div>
      <div className="sr-tabs">
        <button type="button" className={screen === 'register' ? 'on' : ''} onClick={() => setScreen('register')}>Stock Register</button>
        <button type="button" className={screen === 'items' ? 'on' : ''} onClick={() => setScreen('items')}>Add New Stock Item</button>
      </div>

      {screen === 'register' && <>
      <div className="premium-card sr-filters">
        <div>
          <label>Item Category</label>
          <select className="input-field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            <option value="">All Categories</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div>
          <label>Item Name</label>
          <select className="input-field" value={draft.itemId} onChange={(e) => setDraft({ ...draft, itemId: e.target.value })}>
            <option value="">All Items</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label>Location</label>
          <select className="input-field" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })}>
            <option value="">All Locations</option>
            {locations.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div>
          <label>From Date</label>
          <DateField className="input-field" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div>
          <label>To Date</label>
          <DateField className="input-field" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <div className="sr-actions">
          <button type="button" className="sr-search" onClick={() => setFilters({ ...draft })}><Search size={16} /> Search</button>
          <button
            type="button"
            className="sr-reset"
            onClick={() => {
              const next = emptyFilters();
              setDraft(next);
              setFilters(next);
            }}
          >
            <RotateCcw size={15} /> Reset
          </button>
          <button type="button" className="sr-add" onClick={() => openEntry(null)}>Add Item</button>
        </div>
      </div>

      <div className="sr-kpis">
        <div className="premium-card sr-kpi">
          <span className="sr-kpi-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><Package size={22} /></span>
          <div>
            <span>Total Drums In Stock</span>
            <b>{formatQty(totals.drums)} Nos.</b>
          </div>
        </div>
        <div className="premium-card sr-kpi">
          <span className="sr-kpi-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><Layers size={22} /></span>
          <div>
            <span>Total Liners In Stock</span>
            <b>{formatQty(totals.liners)} Nos.</b>
          </div>
        </div>
        <div className="premium-card sr-kpi">
          <span className="sr-kpi-icon" style={{ background: '#ffedd5', color: '#ea580c' }}><Box size={22} /></span>
          <div>
            <span>Total Stock Value</span>
            <b>{formatInr(totals.value)}</b>
          </div>
        </div>
        <div className="premium-card sr-kpi">
          <span className="sr-kpi-icon" style={{ background: '#fce7f3', color: '#db2777' }}><TrendingUp size={22} /></span>
          <div>
            <span>Low Stock Items</span>
            <b>{totals.low} Item{totals.low === 1 ? '' : 's'}</b>
          </div>
        </div>
      </div>

      <div className="premium-card sr-table-wrap">
        <div style={{ overflowX: 'auto' }}>
          <table className="sr-table">
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Item Image</th>
                <th>Item Name</th>
                <th>Specification</th>
                <th>UOM</th>
                <th>Opening Stock</th>
                <th>Received</th>
                <th>Issued</th>
                <th>Closing Stock</th>
                <th>Stock Value (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '1.4rem', color: 'var(--text-muted)' }}>No items for this filter.</td>
                </tr>
              ) : rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td><span className="sr-thumb">{row.kind === 'liner' ? <Layers size={16} /> : <Package size={16} />}</span></td>
                  <td className="sr-name">{row.name}</td>
                  <td>{row.specification || '—'}</td>
                  <td>{row.uom || 'Nos'}</td>
                  <td>{formatQty(row.opening)}</td>
                  <td>{formatQty(row.received)}</td>
                  <td>{formatQty(row.issued)}</td>
                  <td style={{ fontWeight: 800 }}>{formatQty(row.closing)}</td>
                  <td>{Math.round(row.value).toLocaleString('en-IN')}</td>
                  <td><span className={`sr-pill ${row.low ? 'low' : 'in'}`}>{row.low ? 'Low Stock' : 'In Stock'}</span></td>
                  <td>
                    <button type="button" className="sr-icon-btn" title="View" onClick={() => viewItem(row)}><Eye size={14} /></button>
                    <button type="button" className="sr-icon-btn" title="Edit" onClick={() => openEntry(row)}><Pencil size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="premium-card sr-history" ref={historyRef}>
        <div className="sr-history-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Clock size={16} />
            Transaction History{selected ? ` – ${selected.name}${selected.specification ? ` (${selected.specification})` : ''}` : ''}
          </span>
          <select value={historyRange} onChange={(e) => setHistoryRange(e.target.value)}>
            <option value="3">Last 3 Months</option>
            <option value="1">Last 1 Month</option>
            <option value="all">All</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sr-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction Type</th>
                <th>Reference No.</th>
                <th>Qty</th>
                <th>Rate (₹)</th>
                <th>Total Value (₹)</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '1.2rem', color: 'var(--text-muted)' }}>
                    No purchases or issues in this period. New Uma Drum rows on a packing list show here as Issue.
                  </td>
                </tr>
              ) : history.map((row) => (
                <tr key={row.id}>
                  <td>{showDate(row.date)}</td>
                  <td style={{ fontWeight: 700, color: row.type === 'Issue' ? '#c2410c' : '#047857' }}>{row.type}</td>
                  <td>{row.refNo || '—'}</td>
                  <td>{formatQty(row.qty)}</td>
                  <td>{formatQty(row.rate)}</td>
                  <td>{Math.round((Number(row.qty) || 0) * (Number(row.rate) || 0)).toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'left' }}>{row.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>}

      {screen === 'items' && (
        <>
          <form className="premium-card" style={{ padding: 0, overflow: 'hidden' }} onSubmit={saveEntry}>
            <div className="sr-bar"><Package size={18} /> Add New Stock Item</div>
            <div className="sr-entry">
              <div className="sr-entry-grid">
                <div>
                  <label>Item Category *</label>
                  <select className="input-field" required value={entry.category} onChange={(e) => setEntry({ ...entry, category: e.target.value })}>
                    {categoryOptions.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Unit of Measure (UOM) *</label>
                  <select className="input-field" required value={entry.uom} onChange={(e) => setEntry({ ...entry, uom: e.target.value })}>
                    {['Nos.', 'Kg', 'Pcs', 'Ltr', 'MT', 'Drum'].map((name) => <option key={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Item Name *</label>
                  <input
                    className="input-field"
                    list="stock-item-names"
                    required
                    placeholder="Select or type item name"
                    value={entry.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      if (entry.id) setEntry({ ...entry, name });
                      else pickItemName(name);
                    }}
                  />
                  <datalist id="stock-item-names">
                    {items.map((item) => <option key={item.id} value={item.name} />)}
                  </datalist>
                </div>
                <div>
                  <label>Opening Stock *</label>
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={entry.openingStock}
                    onChange={(e) => setEntry({ ...entry, openingStock: e.target.value })}
                  />
                </div>
                <div>
                  <label>Specification</label>
                  <input className="input-field" value={entry.specification} onChange={(e) => setEntry({ ...entry, specification: e.target.value })} />
                </div>
                <div>
                  <label>Location</label>
                  <select className="input-field" value={entry.location} onChange={(e) => setEntry({ ...entry, location: e.target.value })}>
                    {locationOptions.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </div>
              </div>
              <div className="sr-stock-box">
                <h3>Stock Details</h3>
                <div className="sr-entry-grid">
                  <div>
                    <label>Purchase Date *</label>
                    <DateField className="input-field" required value={entry.purchaseDate} onChange={(e) => setEntry({ ...entry, purchaseDate: e.target.value })} />
                  </div>
                  <div>
                    <label>Supplier</label>
                    <input
                      className="input-field"
                      list="stock-suppliers"
                      placeholder="Supplier name"
                      value={entry.supplier}
                      onChange={(e) => setEntry({ ...entry, supplier: e.target.value })}
                    />
                    <datalist id="stock-suppliers">
                      {supplierOptions.map((name) => <option key={name} value={name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label>Purchase Rate (₹) *</label>
                    <input
                      className="input-field"
                      required
                      inputMode="decimal"
                      placeholder="0.00"
                      value={entry.rate}
                      onChange={(e) => setEntry({ ...entry, rate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Remarks</label>
                    <input className="input-field" value={entry.remarks} onChange={(e) => setEntry({ ...entry, remarks: e.target.value })} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.75rem', fontSize: '0.82rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={!!entry.tracksUmaDrums} onChange={(e) => setEntry({ ...entry, tracksUmaDrums: e.target.checked })} />
                  Count New Uma Drum from packing list as issued
                </label>
              </div>
              <div className="sr-entry-actions">
                <button type="submit" className="sr-search"><Save size={16} /> Save</button>
                <button type="button" className="sr-reset" onClick={() => setEntry(blankEntry())}><RotateCcw size={15} /> Reset</button>
              </div>
            </div>
          </form>

          <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="sr-bar">
              <Package size={18} /> Current Stock Items
              <div className="sr-list-tools">
                <input
                  placeholder="Search item..."
                  value={itemQuery}
                  onChange={(e) => { setItemQuery(e.target.value); setListPage(1); }}
                />
                <button type="button" className="sr-icon-btn" title="Filter" onClick={() => setShowListFilter((open) => !open)} style={{ background: '#fff' }}>
                  <Filter size={14} />
                </button>
              </div>
            </div>
            {showListFilter && (
              <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid #f0e8f6' }}>
                <select className="input-field" style={{ maxWidth: 260 }} value={listCategory} onChange={(e) => { setListCategory(e.target.value); setListPage(1); }}>
                  <option value="">All Categories</option>
                  {categoryOptions.map((name) => <option key={name}>{name}</option>)}
                </select>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="sr-table">
                <thead>
                  <tr>
                    <th>Sr.</th>
                    <th>Item Category</th>
                    <th>Item Name</th>
                    <th>Specification</th>
                    <th>UOM</th>
                    <th>Current Stock</th>
                    <th>Purchase Rate (₹)</th>
                    <th>Last Purchase</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '1.2rem', color: 'var(--text-muted)' }}>No stock items yet.</td></tr>
                  ) : pageRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{(safePage - 1) * pageSize + index + 1}</td>
                      <td>{row.category || '—'}</td>
                      <td className="sr-name" style={{ textAlign: 'left' }}>{row.name}</td>
                      <td>{row.specification || '—'}</td>
                      <td>{row.uom === 'Nos' ? 'Nos.' : (row.uom || 'Nos.')}</td>
                      <td style={{ fontWeight: 800 }}>{formatQty(row.currentStock)}</td>
                      <td>{formatRate(row.lastRate)}</td>
                      <td>{row.lastPurchase ? showDate(row.lastPurchase) : '—'}</td>
                      <td style={{ textAlign: 'left' }}>{row.lastRemarks || '—'}</td>
                      <td>
                        <button type="button" className="sr-icon-btn" title="View" onClick={() => viewItem(row)}><Eye size={14} /></button>
                        <button type="button" className="sr-icon-btn" title="Edit" onClick={() => openEntry(row)}><Pencil size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sr-page">
              <span>
                Showing {catalog.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, catalog.length)} of {catalog.length} records
              </span>
              <div className="sr-page-btns">
                <button type="button" onClick={() => setListPage(1)} disabled={safePage === 1}>«</button>
                <button type="button" onClick={() => setListPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>‹</button>
                <button type="button" className="on">{safePage}</button>
                <button type="button" onClick={() => setListPage(Math.min(pageCount, safePage + 1))} disabled={safePage === pageCount}>›</button>
                <button type="button" onClick={() => setListPage(pageCount)} disabled={safePage === pageCount}>»</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StockRegister;
