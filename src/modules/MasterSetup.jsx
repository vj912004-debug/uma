import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Trash2, Tag, Box, Ruler, Percent, SlidersHorizontal } from 'lucide-react';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';

const TAB_CONFIG = {
  Items: { key: 'items', title: 'Product Master', placeholder: 'Enter product name...', isTax: false },
  Materials: { key: 'materials', title: 'Material Master', placeholder: 'Enter material name...', isTax: false },
  PSDReq: { key: 'psdRequirements', title: 'PSD Requirement Master', placeholder: 'Enter PSD requirement (e.g. d(0.9) < 10 Micron)...', isTax: false },
  Units: { key: 'units', title: 'Unit Master', placeholder: 'Enter unit (e.g. Kg)...', isTax: false },
  Taxes: { key: 'taxes', title: 'Tax Master', isTax: true }
};

const MasterSetup = () => {
  const { data, setData } = useAppContext();
  const [activeTab, setActiveTab] = useState('Items');
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const addItem = (type, value) => {
    if (!value) return;
    setData(prev => {
      const currentList = prev[type] || [];
      if (type === 'taxes') {
        if (currentList.some(t => t.name === value.name)) {
          alert(`${value.name} already exists in ${type}`);
          return prev;
        }
      } else if (currentList.includes(value)) {
        alert(`${value} already exists in ${type}`);
        return prev;
      }
      return {
        ...prev,
        [type]: [...currentList, value]
      };
    });
  };

  const removeItem = (type, index) => {
    setData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const tab = TAB_CONFIG[activeTab];
  const rawItems = data[tab.key] || [];
  const itemLabels = useMemo(
    () => (tab.isTax ? rawItems.map((t) => t?.name) : rawItems),
    [rawItems, tab.isTax]
  );
  const productOptions = useMemo(() => uniqueSortedOptions(itemLabels), [itemLabels]);

  const filteredEntries = useMemo(() => (
    rawItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        const label = tab.isTax ? (item?.name || '') : String(item || '');
        if (productFilter && label !== productFilter) return false;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const hay = tab.isTax
            ? `${item?.name || ''} ${item?.rate ?? ''}`.toLowerCase()
            : label.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
  ), [rawItems, productFilter, searchTerm, tab.isTax]);

  const filteredItems = filteredEntries.map((e) => e.item);
  const removeFiltered = (displayIdx) => {
    const entry = filteredEntries[displayIdx];
    if (entry) removeItem(tab.key, entry.idx);
  };

  const TabButton = ({ name, icon: Icon, tabId }) => (
    <button 
      onClick={() => { setActiveTab(tabId); setSearchTerm(''); setProductFilter(''); }}
      className="btn"
      style={{
        background: activeTab === tabId ? 'rgba(91, 28, 133, 0.1)' : 'transparent',
        color: activeTab === tabId ? 'var(--accent-primary)' : 'var(--text-muted)',
        border: activeTab === tabId ? '1px solid var(--accent-primary)' : '1px solid transparent',
        flex: 1
      }}
    >
      <Icon size={18} /> {name}
    </button>
  );

  return (
    <div>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Master Setup</h1>
        <p style={{ color: 'var(--text-muted)' }}>Configure your system-wide master data.</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <TabButton name="Products" icon={Tag} tabId="Items" />
        <TabButton name="Materials" icon={Box} tabId="Materials" />
        <TabButton name="PSD Req" icon={SlidersHorizontal} tabId="PSDReq" />
        <TabButton name="Units" icon={Ruler} tabId="Units" />
        <TabButton name="Taxes" icon={Percent} tabId="Taxes" />
      </div>

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search master data…"
        showParty={false}
        productFilter={productFilter}
        onProductChange={setProductFilter}
        productOptions={productOptions}
        productAllLabel="All Items"
      />

      <div className="premium-card">
        {tab.isTax ? (
          <TaxList
            title={tab.title}
            items={filteredItems}
            onAdd={(val) => addItem(tab.key, val)}
            onRemove={removeFiltered}
          />
        ) : (
          <MasterList
            title={tab.title}
            items={filteredItems}
            onAdd={(val) => addItem(tab.key, val)}
            onRemove={removeFiltered}
            placeholder={tab.placeholder}
          />
        )}
      </div>
    </div>
  );
};

const MasterList = ({ title, items, onAdd, onRemove, placeholder }) => {
  const [val, setVal] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>{title}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="text" className="input-field" placeholder={placeholder} value={val} onChange={e => setVal(e.target.value)} />
          <button className="btn btn-primary" onClick={() => { if(val) { onAdd(val); setVal(''); } }}><Plus size={18} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {items.map((item, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{item}</span>
            <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => onRemove(idx)}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const TaxList = ({ title, items, onAdd, onRemove }) => {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>{title}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="text" className="input-field" placeholder="Tax Name" value={name} onChange={e => setName(e.target.value)} />
          <input type="number" className="input-field" placeholder="Rate %" style={{ width: '100px' }} value={rate} onChange={e => setRate(e.target.value)} />
          <button className="btn btn-primary" onClick={() => { if(name && rate) { onAdd({name, rate: Number(rate)}); setName(''); setRate(''); } }}><Plus size={18} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {items.map((item, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 600 }}>{item.name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.rate}%</p>
            </div>
            <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => onRemove(idx)}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MasterSetup;
