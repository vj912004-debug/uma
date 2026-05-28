import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Trash2, Tag, Box, Ruler, Percent, SlidersHorizontal } from 'lucide-react';

const MasterSetup = () => {
  const { data, setData } = useAppContext();
  const [activeTab, setActiveTab] = useState('Items');

  const addItem = (type, value) => {
    if (!value) return;
    setData(prev => {
      const currentList = prev[type] || [];
      if (currentList.includes(value)) {
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

  const TabButton = ({ name, icon: Icon, tabId }) => (
    <button 
      onClick={() => setActiveTab(tabId)}
      className="btn"
      style={{
        background: activeTab === tabId ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
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

      <div className="premium-card">
        {activeTab === 'Items' && (
          <MasterList 
            title="Product Master" 
            items={data.items} 
            onAdd={(val) => addItem('items', val)} 
            onRemove={(idx) => removeItem('items', idx)}
            placeholder="Enter product name..."
          />
        )}
        {activeTab === 'Materials' && (
          <MasterList 
            title="Material Master" 
            items={data.materials} 
            onAdd={(val) => addItem('materials', val)} 
            onRemove={(idx) => removeItem('materials', idx)}
            placeholder="Enter material name..."
          />
        )}
        {activeTab === 'PSDReq' && (
          <MasterList
            title="PSD Requirement Master"
            items={data.psdRequirements || []}
            onAdd={(val) => addItem('psdRequirements', val)}
            onRemove={(idx) => removeItem('psdRequirements', idx)}
            placeholder="Enter PSD requirement (e.g. d(0.9) < 10 Micron)..."
          />
        )}
        {activeTab === 'Units' && (
          <MasterList 
            title="Unit Master" 
            items={data.units} 
            onAdd={(val) => addItem('units', val)} 
            onRemove={(idx) => removeItem('units', idx)}
            placeholder="Enter unit (e.g. Kg)..."
          />
        )}
        {activeTab === 'Taxes' && (
          <TaxList 
            title="Tax Master" 
            items={data.taxes} 
            onAdd={(val) => addItem('taxes', val)} 
            onRemove={(idx) => removeItem('taxes', idx)}
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
