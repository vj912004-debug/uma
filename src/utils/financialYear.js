/** Indian FY label from a Date (Apr–Mar), e.g. Jul 2026 → "26-27". */
export const getFYKeyFromDate = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return getFYKeyFromDate(new Date());
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed; 3 = April
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
};

export const getFYOfDate = (dateStr) => {
  try {
    return getFYKeyFromDate(new Date(dateStr));
  } catch {
    return getFYKeyFromDate(new Date());
  }
};

export const getCurrentFYKey = () => getFYKeyFromDate(new Date());

/** FY keys from earliest through current (inclusive), oldest → newest. */
export const getFYKeysThroughCurrent = (earliest = '21-22') => {
  const keys = [];
  const [startA] = earliest.split('-').map((n) => parseInt(n, 10));
  let a = startA;
  let b = a + 1;
  const current = getCurrentFYKey();
  for (let i = 0; i < 24; i += 1) {
    const key = `${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
    keys.push(key);
    if (key === current) break;
    a += 1;
    b += 1;
  }
  return keys;
};
