/** Employee salary + eSSL attendance helpers */

export const SHIFT_TYPES = {
  '9hr': { label: '9hr', stdHours: 9, start: '09:00', end: '18:00' },
  '12hr': { label: '12hr', stdHours: 12, start: '08:00', end: '20:00' }
};

/** Legacy band shifts used on attendance rows */
export const SHIFTS = {
  Day: { start: '09:00', end: '18:30', stdHours: 9.5 },
  General: { start: '09:00', end: '18:30', stdHours: 9.5 },
  Evening: { start: '18:30', end: '21:00', stdHours: 2.5 },
  Night: { start: '21:00', end: '06:30', stdHours: 9.5 },
  Morning: { start: '06:30', end: '09:00', stdHours: 2.5 }
};

export const STATUS_CODES = {
  P: 'Present',
  A: 'Absent',
  HD: 'Half Day',
  WO: 'Weekly Off',
  PH: 'Public Holiday',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  PL: 'Paid Leave',
  LWP: 'Leave Without Pay'
};

const toMins = (t) => {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return h * 60 + m;
};

export const calculateTimes = (inTime, outTime, shift, stdHoursOverride) => {
  if (!inTime || !outTime) return { totalHours: 0, otHours: 0, isLate: false, isEarlyLeave: false };
  const shiftConfig = SHIFTS[shift] || SHIFTS.Day;
  const stdHours = stdHoursOverride != null ? Number(stdHoursOverride) : shiftConfig.stdHours;
  const inMins = toMins(inTime);
  let outMins = toMins(outTime);
  const startMins = toMins(shiftConfig.start);
  let endMins = toMins(shiftConfig.end);
  if (outMins < inMins) outMins += 24 * 60;
  if (endMins < startMins) endMins += 24 * 60;
  let actualOutForCompare = toMins(outTime);
  if (actualOutForCompare < toMins(shiftConfig.start)) actualOutForCompare += 24 * 60;
  const totalHours = (outMins - inMins) / 60;
  return {
    totalHours: Number(totalHours.toFixed(2)),
    otHours: Number(Math.max(0, totalHours - stdHours).toFixed(2)),
    isLate: inMins > startMins + 15,
    isEarlyLeave: actualOutForCompare < endMins
  };
};

export const money = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Latest rate whose effectiveFrom <= asOfDate (YYYY-MM-DD). */
export const getEffectiveRate = (user, asOfDate = new Date().toISOString().slice(0, 10)) => {
  const history = Array.isArray(user?.rateHistory) ? [...user.rateHistory] : [];
  const dated = history
    .filter((r) => r && r.effectiveFrom && String(r.effectiveFrom) <= String(asOfDate))
    .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)));
  if (dated.length) {
    return {
      perDayRate: Number(dated[0].perDayRate) || 0,
      otRate: Number(dated[0].otRate) || 0,
      effectiveFrom: dated[0].effectiveFrom
    };
  }
  if (user?.perDayRate != null || user?.otRate != null) {
    return {
      perDayRate: Number(user.perDayRate) || 0,
      otRate: Number(user.otRate) || 0,
      effectiveFrom: user.effectiveFrom || ''
    };
  }
  return { perDayRate: 0, otRate: 0, effectiveFrom: '' };
};

export const getShiftStdHours = (user) => {
  const key = user?.shiftType === '12hr' ? '12hr' : '9hr';
  return SHIFT_TYPES[key].stdHours;
};

export const dayName = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return '';
  }
};

export const monthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const calculateMonthSalary = (user, monthRows, month) => {
  const [y, m] = String(month || '').split('-').map(Number);
  const totalDays = y && m ? new Date(y, m, 0).getDate() : 0;
  const asOf = `${month}-28`;
  const rate = getEffectiveRate(user, asOf);

  const presentDays = monthRows.reduce((sum, r) => {
    if (r.statusCode === 'P') return sum + 1;
    if (r.statusCode === 'HD' || r.isHalfDay) return sum + 0.5;
    return sum;
  }, 0);
  const absentDays = monthRows.filter((r) => r.statusCode === 'A' || r.statusCode === 'LWP').length;
  const leaveDays = monthRows.filter((r) => ['CL', 'SL', 'PL', 'WO', 'PH'].includes(r.statusCode)).length;
  const paidDays = monthRows.reduce((sum, r) => {
    if (r.statusCode === 'P') return sum + 1;
    if (r.statusCode === 'HD' || r.isHalfDay) return sum + 0.5;
    if (['CL', 'SL', 'PL', 'WO', 'PH'].includes(r.statusCode)) return sum + 1;
    return sum;
  }, 0);
  const totalHours = monthRows.reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);
  const otHours = monthRows.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0);

  const basic = paidDays * rate.perDayRate;
  const otAmount = otHours * rate.otRate;
  const totalSalary = basic + otAmount;

  const detailRows = monthRows.map((r) => {
    const isPresent = r.statusCode === 'P';
    const isHalf = r.statusCode === 'HD' || r.isHalfDay;
    const dayFactor = isPresent ? 1 : isHalf ? 0.5 : ['CL', 'SL', 'PL', 'WO', 'PH'].includes(r.statusCode) ? 1 : 0;
    const dailyAmount = dayFactor * rate.perDayRate;
    const rowOt = (parseFloat(r.otHours) || 0) * rate.otRate;
    return {
      ...r,
      dayName: dayName(r.date),
      dailyAmount,
      otAmount: rowOt,
      perDayRate: rate.perDayRate,
      otRate: rate.otRate
    };
  });

  return {
    totalDays,
    presentDays: Number(presentDays.toFixed(2)),
    absentDays,
    leaveDays,
    paidDays: Number(paidDays.toFixed(2)),
    totalHours: Number(totalHours.toFixed(2)),
    otHours: Number(otHours.toFixed(2)),
    perDayRate: rate.perDayRate,
    otRate: rate.otRate,
    effectiveFrom: rate.effectiveFrom,
    shiftType: user?.shiftType || '9hr',
    basic,
    otAmount,
    totalSalary,
    detailRows
  };
};

export const defaultEsslSettings = () => ({
  connected: false,
  deviceName: 'eSSL Biometric',
  host: '192.168.1.50',
  lastSync: null
});

/**
 * Demo eSSL sync: create Present punches for employees with esslId for recent days
 * that do not already have attendance. Returns { added, skipped, records }.
 */
export const simulateEsslSync = (users = [], attendance = [], daysBack = 7) => {
  const active = (users || []).filter((u) => u.active !== false && u.esslId);
  const existing = new Set(
    (attendance || [])
      .filter((r) => !r.isDeleted)
      .map((r) => `${r.userId}|${r.date}`)
  );
  const records = [];
  const today = new Date();

  for (let d = 0; d < daysBack; d += 1) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - d);
    if (dt.getDay() === 0) continue; // skip Sunday
    const date = dt.toISOString().slice(0, 10);

    active.forEach((user, idx) => {
      const key = `${user.id}|${date}`;
      if (existing.has(key)) return;

      const shiftType = user.shiftType === '12hr' ? '12hr' : '9hr';
      const cfg = SHIFT_TYPES[shiftType];
      const inJitter = (idx + d) % 12;
      const outJitter = (idx * 3 + d) % 20;
      const inH = Number(cfg.start.split(':')[0]);
      const inM = Number(cfg.start.split(':')[1]) + inJitter;
      const outH = Number(cfg.end.split(':')[0]);
      const outM = Number(cfg.end.split(':')[1]) + outJitter;
      const pad = (n) => String(Math.max(0, Math.min(59, n))).padStart(2, '0');
      const inTime = `${String(inH + Math.floor(inM / 60)).padStart(2, '0')}:${pad(inM % 60)}`;
      const outTime = `${String(outH + Math.floor(outM / 60)).padStart(2, '0')}:${pad(outM % 60)}`;
      const band = shiftType === '12hr' ? 'Day' : 'Day';
      const calc = calculateTimes(inTime, outTime, band, cfg.stdHours);

      records.push({
        id: `essl-${user.id}-${date}`,
        userId: String(user.id),
        date,
        shift: band,
        inTime,
        outTime,
        statusCode: 'P',
        status: 'Present',
        remark: `eSSL sync · ID ${user.esslId}`,
        isHalfDay: false,
        username: user.name || user.username,
        employeeId: user.employeeId || 'N/A',
        department: user.department || 'General',
        totalHours: calc.totalHours,
        otHours: calc.otHours,
        isLate: calc.isLate,
        isEarlyLeave: calc.isEarlyLeave,
        leaveType: '',
        source: 'essl',
        createdAt: new Date().toISOString()
      });
      existing.add(key);
    });
  }

  return {
    added: records.length,
    skipped: active.length * daysBack - records.length,
    records
  };
};

export const summarizeAttendanceDay = (rows = []) => {
  const present = rows.filter((r) => r.statusCode === 'P').length;
  const half = rows.filter((r) => r.statusCode === 'HD' || r.isHalfDay).length;
  const absent = rows.filter((r) => r.statusCode === 'A' || r.statusCode === 'LWP').length;
  const leave = rows.filter((r) => ['CL', 'SL', 'PL', 'WO', 'PH'].includes(r.statusCode)).length;
  const otHours = rows.reduce((s, r) => s + (parseFloat(r.otHours) || 0), 0);
  const employees = new Set(rows.map((r) => String(r.userId))).size;
  return {
    totalEmployees: employees,
    present,
    half,
    absent,
    leave,
    otHours: Number(otHours.toFixed(2))
  };
};
