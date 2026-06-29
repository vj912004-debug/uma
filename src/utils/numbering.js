import { format, isBefore, setYear, setMonth, setDate } from 'date-fns';

export const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const aprilFirst = setDate(setMonth(setYear(new Date(), year), 3), 1); // 0-indexed months, so 3 is April
  
  if (isBefore(date, aprilFirst)) {
    return `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
  }
  return `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
};

export const generateDocNumber = (docType, serial, date = new Date()) => {
  const fy = getFinancialYear(new Date(date));
  const paddedSerial = serial.toString().padStart(4, '0');
  return `UMA/${docType}/${fy}/${paddedSerial}`;
};

/** Pick the next unused document number (skips duplicates already in saved docs). */
export const nextAvailableDocNumber = (docType, startSerial, date, existingDocs, options = {}) => {
  const { numberKey = 'invoiceNo', excludeId = null } = options;
  const used = new Set(
    (existingDocs || [])
      .filter(d => d.id !== excludeId)
      .map(d => d[numberKey])
      .filter(Boolean)
  );
  let serial = Math.max(1, parseInt(startSerial, 10) || 1);
  let docNo = generateDocNumber(docType, serial, date);
  while (used.has(docNo)) {
    serial += 1;
    docNo = generateDocNumber(docType, serial, date);
  }
  return { docNo, nextSerial: serial + 1 };
};
