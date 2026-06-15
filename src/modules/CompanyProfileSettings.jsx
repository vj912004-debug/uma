import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Building2, Save, Upload, X } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';
import {
  DEFAULT_COMPANY_PROFILE,
  mergeCompanyProfile,
  validateCompanyProfile,
  formatCompanyAddressSingle
} from '../utils/companyProfile';

const Section = ({ title, children }) => (
  <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--accent-primary)' }}>{title}</h3>
    {children}
  </div>
);

const CompanyProfileSettings = () => {
  const { data, upsertCompanyProfile } = useAppContext();
  const [form, setForm] = useState(() => mergeCompanyProfile(data.companyProfile));
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(mergeCompanyProfile(data.companyProfile));
  }, [data.companyProfile]);

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
    setSaved(false);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField('logo', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateCompanyProfile(form);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    upsertCompanyProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={28} style={{ color: 'var(--accent-primary)' }} />
          Company Profile Settings
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Manage your company details shown on invoices, delivery challans, and PDF documents.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <Section title="Basic Info">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Company Name *</label>
              <input className="input-field" value={form.companyName} onChange={e => setField('companyName', e.target.value)} />
              {errors.companyName && <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.companyName}</p>}
            </div>
            <div className="form-group">
              <label>Tagline</label>
              <input className="input-field" value={form.tagline} onChange={e => setField('tagline', e.target.value)} placeholder="e.g. Quality Micronization Services" />
            </div>
            <div className="form-group">
              <label>Industry Type</label>
              <input className="input-field" value={form.industryType} onChange={e => setField('industryType', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Established Year</label>
              <input type="number" className="input-field" value={form.establishedYear} onChange={e => setField('establishedYear', e.target.value)} placeholder="e.g. 2010" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Company Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {form.logo ? (
                  <div style={{ position: 'relative' }}>
                    <img src={form.logo} alt="Logo preview" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }} />
                    <button type="button" onClick={() => setField('logo', '')} style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', padding: '2px' }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>No logo</div>
                )}
                <label className="btn" style={{ cursor: 'pointer' }}>
                  <Upload size={16} /> Upload Logo
                  <input type="file" accept="image/*" hidden onChange={handleLogoChange} />
                </label>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Contact">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Phone *</label>
              <input className="input-field" value={form.phone} onChange={e => setField('phone', e.target.value)} />
              {errors.phone && <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.phone}</p>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="input-field" value={form.email} onChange={e => setField('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Website</label>
              <input className="input-field" value={form.website} onChange={e => setField('website', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </Section>

        <Section title="Address">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Address Line 1 *</label>
              <input className="input-field" value={form.addressLine1} onChange={e => setField('addressLine1', e.target.value)} />
              {errors.addressLine1 && <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.addressLine1}</p>}
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Address Line 2</label>
              <input className="input-field" value={form.addressLine2} onChange={e => setField('addressLine2', e.target.value)} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input className="input-field" value={form.city} onChange={e => setField('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input className="input-field" value={form.state} onChange={e => setField('state', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Country</label>
              <input className="input-field" value={form.country} onChange={e => setField('country', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Pincode</label>
              <input className="input-field" value={form.pincode} onChange={e => setField('pincode', e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Business Info">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>GST Number</label>
              <input className="input-field" value={form.gstNumber} onChange={e => setField('gstNumber', e.target.value)} />
            </div>
            <div className="form-group">
              <label>PAN Number</label>
              <input className="input-field" value={form.panNumber} onChange={e => setField('panNumber', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Owner / Director Name</label>
              <input className="input-field" value={form.ownerName} onChange={e => setField('ownerName', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Description</label>
              <RichTextEditor value={form.description} onChange={(val) => setField('description', val)} />
            </div>
          </div>
        </Section>

        <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Document Preview</h3>
          <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              {form.logo && <img src={form.logo} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />}
              <div>
                <p style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{form.companyName || 'Company Name'}</p>
                {form.tagline && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{form.tagline}</p>}
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>{formatCompanyAddressSingle(form)}</p>
            <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>{form.phone}{form.email ? ` | ${form.email}` : ''}</p>
            {form.gstNumber && <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0.25rem 0' }}>GSTIN: {form.gstNumber}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
          {form.updatedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last updated: {new Date(form.updatedAt).toLocaleString()}
            </span>
          )}
          {saved && <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>Saved successfully!</span>}
          <button type="submit" className="btn btn-primary">
            <Save size={18} /> Save Company Profile
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyProfileSettings;
