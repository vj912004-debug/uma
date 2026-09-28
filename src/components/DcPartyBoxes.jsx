import SearchableSelect from './SearchableSelect';

const boxStyle = {
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  overflow: 'hidden',
  background: 'var(--glass-bg, transparent)'
};

const headStyle = {
  background: 'rgba(91, 28, 133, 0.1)',
  color: 'var(--accent-primary)',
  fontWeight: 800,
  letterSpacing: '0.04em',
  padding: '0.55rem 0.85rem',
  fontSize: '0.85rem'
};

const bodyStyle = {
  padding: '0.85rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem'
};

const findParty = (parties, name) => (parties || []).find((p) => (
  !p.isDeleted && (p.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()
));

/** Bill To and Ship To cards on the Delivery Challan form. */
const DcPartyBoxes = ({ form, setForm, parties }) => {
  const nameOptions = [
    { value: '', label: 'Select or type name' },
    ...(parties || []).filter((p) => !p.isDeleted).map((p) => ({ value: p.name, label: p.name }))
  ];
  const onBillName = (e) => {
    const name = e.target.value || '';
    const party = findParty(parties, name);
    setForm((prev) => {
      const next = {
        ...prev,
        partyId: party?.id || '',
        partyName: party?.name || name
      };
      if (!party) return next;
      next.billAddress = party.billAddress || '';
      next.gstinBill = party.gstinBill || '';
      const shipBlank = !String(prev.shipName || '').trim() && !String(prev.shipAddress || '').trim();
      if (shipBlank) {
        next.shipName = party.name || '';
        next.shipAddress = party.shipAddress || party.billAddress || '';
        next.gstinShip = party.gstinShip || party.gstinBill || '';
      }
      return next;
    });
  };

  const onShipName = (e) => {
    const name = e.target.value || '';
    const party = findParty(parties, name);
    setForm((prev) => ({
      ...prev,
      shipName: party?.name || name,
      ...(party ? {
        shipAddress: party.shipAddress || party.billAddress || prev.shipAddress || '',
        gstinShip: party.gstinShip || party.gstinBill || prev.gstinShip || ''
      } : {})
    }));
  };

  return (
    <div style={{ gridColumn: 'span 4', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div style={boxStyle}>
        <div style={headStyle}>BILL TO</div>
        <div style={bodyStyle}>
          <div>
            <label>Name</label>
            <SearchableSelect
              allowCustom
              className="input-field"
              placeholder="Select or type name"
              value={form.partyName || ''}
              onChange={onBillName}
              options={nameOptions}
            />
          </div>
          <div>
            <label>Address</label>
            <textarea
              className="input-field"
              rows="3"
              placeholder="Billing address"
              value={form.billAddress || ''}
              onChange={(e) => setForm({ ...form, billAddress: e.target.value })}
            />
          </div>
          <div>
            <label>GSTIN</label>
            <input
              type="text"
              className="input-field"
              placeholder="Bill To GSTIN"
              value={form.gstinBill || ''}
              onChange={(e) => setForm({ ...form, gstinBill: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div style={boxStyle}>
        <div style={headStyle}>SHIP TO</div>
        <div style={bodyStyle}>
          <div>
            <label>Name</label>
            <SearchableSelect
              allowCustom
              className="input-field"
              placeholder="Select or type name"
              value={form.shipName || ''}
              onChange={onShipName}
              options={nameOptions}
            />
          </div>
          <div>
            <label>Address</label>
            <textarea
              className="input-field"
              rows="3"
              placeholder="Shipping address"
              value={form.shipAddress || ''}
              onChange={(e) => setForm({ ...form, shipAddress: e.target.value })}
            />
          </div>
          <div>
            <label>GSTIN</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ship To GSTIN"
              value={form.gstinShip || ''}
              onChange={(e) => setForm({ ...form, gstinShip: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DcPartyBoxes;
