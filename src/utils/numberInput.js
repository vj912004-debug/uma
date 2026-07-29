/** Parse weight/amount inputs so 0 is kept (unlike `parseFloat(val) || ''`). */
export const parseOptionalNumber = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const n = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(n) ? n : '';
};

/** Controlled input value for optional numeric fields (allows empty while typing). */
export const numberInputValue = (val) => (
  val === '' || val === null || val === undefined ? '' : val
);
