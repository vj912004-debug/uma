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
