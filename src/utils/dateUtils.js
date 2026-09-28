import { format, parseISO, isValid } from 'date-fns';

/** Indian fiscal year: 1 Apr – 31 Mar */
export const getDefaultFiscalYearRange = (refDate = new Date()) => {
  const year = refDate.getFullYear();
  const startYear = refDate.getMonth() >= 3 ? year : year - 1;
  return {
    rangeFrom: `${startYear}-04-01`,
    rangeTo: `${startYear + 1}-03-31`
  };
};

/** Milliseconds used to order a saved record. Later entries win. */
const entryMillis = (item, index = 0) => {
  if (!item || typeof item !== 'object') return index;
  for (const key of ['createdAt', 'uploadedAt', 'updatedAt', 'timestamp', 'deletedAt']) {
    const t = Date.parse(item[key]);
    if (!Number.isNaN(t) && t > 0) return t;
  }
  for (const candidate of [item.id, item.sourceId, item.raw?.id]) {
    const idNum = Number(String(candidate || '').match(/\d{12,}/)?.[0]);
    if (Number.isFinite(idNum) && idNum > 1e11) return idNum;
  }
  for (const key of ['date', 'invoiceDate', 'dcDate', 'nextDueDate']) {
    const t = Date.parse(item[key]);
    if (!Number.isNaN(t) && t > 0) return t + index;
  }
  return index;
};

/** Newest saved entry first. `pick` reads the record when the row wraps it. */
export const newestFirst = (list, pick = (item) => item) => {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map((item, index) => ({ item, index, time: entryMillis(pick(item) || item, index) }))
    .sort((a, b) => (b.time - a.time) || (b.index - a.index))
    .map(({ item }) => item);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' && dateString.includes('-') 
      ? parseISO(dateString) 
      : new Date(dateString);
    if (!isValid(date)) return dateString;
    return format(date, 'dd/MM/yyyy');
  } catch (e) {
    return dateString;
  }
};
