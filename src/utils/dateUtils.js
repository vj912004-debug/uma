import { format, parseISO, isValid } from 'date-fns';

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
