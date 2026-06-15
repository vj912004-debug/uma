export const DEFAULT_COMPANY_PROFILE = {
  companyName: 'UMA MICRON',
  logo: '',
  tagline: 'ERP & Process Tracking',
  industryType: 'Micronization / Manufacturing',
  phone: '+91 97120 00297',
  email: 'info@umamicron.com',
  website: '',
  gstNumber: '24AGBPP8564D1ZE',
  panNumber: '',
  addressLine1: 'PLOT NO 1116 G.I.D.C. RANOLI, N.H.NO. 8,',
  addressLine2: '',
  city: 'VADODARA',
  state: 'GUJARAT',
  country: 'India',
  pincode: '391350',
  establishedYear: '',
  ownerName: '',
  description: '',
  updatedAt: null
};

export const mergeCompanyProfile = (profile) => ({
  ...DEFAULT_COMPANY_PROFILE,
  ...(profile || {})
});

export const getStoredCompanyProfile = () => {
  try {
    const raw = localStorage.getItem('uma_erp_data');
    if (!raw) return { ...DEFAULT_COMPANY_PROFILE };
    const parsed = JSON.parse(raw);
    return mergeCompanyProfile(parsed.companyProfile);
  } catch {
    return { ...DEFAULT_COMPANY_PROFILE };
  }
};

export const formatCompanyAddressLines = (profile) => {
  const p = mergeCompanyProfile(profile);
  const cityLine = [p.city, p.state, p.pincode].filter(Boolean).join(' - ');
  const lines = [p.addressLine1, p.addressLine2, cityLine, p.country].filter(Boolean);
  return lines.length ? lines : [DEFAULT_COMPANY_PROFILE.addressLine1];
};

export const formatCompanyAddressSingle = (profile) =>
  formatCompanyAddressLines(profile).join(', ');

export const getContactLine = (profile) => {
  const p = mergeCompanyProfile(profile);
  const parts = [];
  if (p.phone) parts.push(`Tel: ${p.phone}`);
  if (p.email) parts.push(`Email: ${p.email}`);
  if (p.website) parts.push(p.website);
  return parts.join(' | ');
};

/** Two-line address for Tax Invoice boxed header (matches printed TI format). */
export const formatTiHeaderAddressLines = (profile) => {
  const p = mergeCompanyProfile(profile);
  const line1 = (p.addressLine1 || '').replace(/,\s*$/, '');
  const country = (p.country || 'India').toUpperCase();
  const line2 = [p.city, p.pincode].filter(Boolean).join(' - ') +
    (p.state ? `, ${p.state}` : '') +
    (country ? ` ${country}` : '');
  return [line1, line2].filter(Boolean);
};

/** Contact line for Tax Invoice header: "Tel: ..., Email : ..." */
export const getTiContactLine = (profile) => {
  const p = mergeCompanyProfile(profile);
  const parts = [];
  if (p.phone) parts.push(`Tel: ${p.phone}`);
  if (p.email) parts.push(`Email : ${p.email}`);
  return parts.join(', ');
};

/** Contact line for PO header: "Tel: ..., Email: ..." */
export const getPoContactLine = (profile) => {
  const p = mergeCompanyProfile(profile);
  const parts = [];
  if (p.phone) parts.push(`Tel: ${p.phone}`);
  if (p.email) parts.push(`Email: ${p.email}`);
  return parts.join(', ');
};

export const validateCompanyProfile = (profile) => {
  const errors = {};
  if (!profile.companyName?.trim()) errors.companyName = 'Company name is required.';
  if (!profile.phone?.trim()) errors.phone = 'Phone is required.';
  if (!profile.addressLine1?.trim()) errors.addressLine1 = 'Address line 1 is required.';
  return errors;
};

const drawFallbackLogo = (doc, x, y) => {
  doc.setDrawColor(0, 150, 0);
  doc.setLineWidth(0.8);
  doc.ellipse(x + 10, y + 10, 8, 12);
  doc.setDrawColor(150, 0, 0);
  doc.ellipse(x + 14, y + 10, 8, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(150, 0, 0);
  doc.text('U', x + 5, y + 15);
  doc.setTextColor(0, 150, 0);
  doc.text('M', x + 12, y + 15);
  doc.setTextColor(0, 0, 0);
};

export const drawCompanyLogo = (doc, x, y, profile) => {
  const p = mergeCompanyProfile(profile);
  if (p.logo && p.logo.startsWith('data:image')) {
    try {
      const format = p.logo.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(p.logo, format, x, y, 28, 28);
      return;
    } catch {
      drawFallbackLogo(doc, x, y);
      return;
    }
  }
  drawFallbackLogo(doc, x, y);
};

/**
 * Draw company header on a jsPDF document.
 * Returns the Y position after the header block.
 */
export const drawPdfCompanyHeader = (doc, options = {}) => {
  const profile = mergeCompanyProfile(options.profile || getStoredCompanyProfile());
  const pageWidth = doc.internal.pageSize.getWidth();
  const centered = options.centered !== false;
  const logoX = options.logoX ?? (centered ? 15 : 15);
  const logoY = options.logoY ?? 10;
  let y = options.startY ?? 10;

  drawCompanyLogo(doc, logoX, logoY, profile);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(options.titleSize ?? 18);
  const nameX = centered ? pageWidth / 2 : 50;
  const nameAlign = centered ? 'center' : 'left';
  doc.text(profile.companyName || DEFAULT_COMPANY_PROFILE.companyName, nameX, y + 6, { align: nameAlign });

  doc.setFontSize(9);
  const addressLines = formatCompanyAddressLines(profile);
  addressLines.forEach((line, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(line, nameX, y + 12 + i * 5, { align: nameAlign });
  });

  const contactY = y + 12 + addressLines.length * 5;
  doc.setFont('helvetica', 'normal');
  const contact = getContactLine(profile);
  if (contact) doc.text(contact, nameX, contactY, { align: nameAlign });

  if (profile.gstNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${profile.gstNumber}`, nameX, contactY + 5, { align: nameAlign });
  }
  if (profile.tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(profile.tagline, nameX, contactY + (profile.gstNumber ? 10 : 5), { align: nameAlign });
  }

  doc.setTextColor(0, 0, 0);
  return contactY + (profile.gstNumber ? 14 : 8);
};

export const drawPdfCompanyHeaderBoxed = (doc, options = {}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const profile = mergeCompanyProfile(options.profile || getStoredCompanyProfile());
  const isTi = options.variant === 'ti';
  const isPo = options.variant === 'po';
  const boxTop = options.boxTop ?? 15;
  const boxHeight = options.boxHeight ?? 30;

  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.rect(14, boxTop, pageWidth - 28, boxHeight);
  drawCompanyLogo(doc, 20, boxTop + 3, profile);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.companyName, pageWidth / 2, boxTop + 6, { align: 'center' });

  const addressLines = (isTi || isPo) ? formatTiHeaderAddressLines(profile) : formatCompanyAddressLines(profile);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  addressLines.slice(0, 2).forEach((line, i) => {
    doc.text(line, pageWidth / 2, boxTop + 11 + i * 5, { align: 'center' });
  });

  doc.setFont('helvetica', 'normal');
  const contact = isTi ? getTiContactLine(profile) : (isPo ? getPoContactLine(profile) : getContactLine(profile));
  if (contact) doc.text(contact, pageWidth / 2, boxTop + 21, { align: 'center' });
  if (profile.gstNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${profile.gstNumber}`, pageWidth / 2, boxTop + 26, { align: 'center' });
  }
  return boxTop + boxHeight;
};
