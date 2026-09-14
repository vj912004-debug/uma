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
