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
  lastSync: null,
  autoSync: true,
  autoSyncMinutes: 5
});

const RAW_PUNCH_LIMIT = 20000;
const SYNC_HISTORY_LIMIT = 200;
const MAX_CATCHUP_DAYS = 90;
const FIRST_SYNC_DAYS = 7;

/** Saved biometric devices, or one default device built from the older single-device settings. */
export const getBiometricDevices = (data = {}) => {
  if (Array.isArray(data.biometricDevices)) return data.biometricDevices.filter((d) => !d.isDeleted);
  const essl = { ...defaultEsslSettings(), ...(data.esslSettings || {}) };
  return [{
    id: 'dev-1',
    name: 'Z900-01',
    model: essl.deviceName || 'eSSL Biometric',
    location: 'Factory',
    host: essl.host || '',
    port: 4370,
    status: essl.connected ? 'Online' : 'Offline',
    lastSync: essl.lastSync || null,
    lastTest: null,
    enrolled: []
  }];
};

/** Keep the legacy esslSettings.connected flag in step with device status. */
export const withDevices = (prev, devices) => ({
  ...prev,
  biometricDevices: devices,
  esslSettings: {
    ...defaultEsslSettings(),
    ...(prev.esslSettings || {}),
    connected: devices.some((d) => !d.isDeleted && d.status === 'Online')
  }
});

/** Employees saved before approval existed have no approvalStatus and count as approved. */
export const isEmployeeApproved = (user) =>
  !user?.approvalStatus || user.approvalStatus === 'Approved';

export const isPendingApproval = (user) => user?.approvalStatus === 'Pending';

export const approvalPatch = (approver) => ({
  approvalStatus: 'Approved',
  approvedAt: new Date().toISOString(),
  approvedBy: approver?.name || approver?.username || 'Admin'
});

export const isEsslSyncEligible = (user) =>
  Boolean(user && user.active !== false && !user.isDeleted && user.esslId && isEmployeeApproved(user));

const localDate = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

const pad2 = (n) => String(n).padStart(2, '0');
const nowHMS = (dt) => `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`;
const minsToHMS = (mins, secs) => `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}:${pad2(secs)}`;

const VERIFY_CODES = { Password: 0, Fingerprint: 1, Card: 2, Face: 15 };
const PUNCH_STATE_CODES = { IN: 0, OUT: 1, Unknown: 255 };

/** Raw biometric punches stored exactly as the device reported them. */
export const getRawPunches = (data) => (Array.isArray(data?.rawPunches) ? data.rawPunches : []);

/** Demo device: one punch near shift start and one near shift end (stable for the same day). */
const demoDayPunches = (user, idx, dt) => {
  const cfg = SHIFT_TYPES[user.shiftType === '12hr' ? '12hr' : '9hr'];
  const day = dt.getDate();
  const verification = (idx + day) % 5 === 0 ? 'Face' : 'Fingerprint';
  return [
    { time: minsToHMS(toMins(cfg.start) + ((idx + day) % 12), (idx * 7 + day * 3) % 60), type: 'IN', verification },
    { time: minsToHMS(toMins(cfg.end) + ((idx * 3 + day) % 20), (idx * 11 + day * 5) % 60), type: 'OUT', verification }
  ];
};

/**
 * Ask the device for every punch since `since` (the last successful sync). With no
 * `since`, the first FIRST_SYNC_DAYS days are fetched. Capped at MAX_CATCHUP_DAYS.
 * Returns { punches, fromDate }.
 */
export const fetchDevicePunches = (users = [], now = new Date(), since = null) => {
  let days = FIRST_SYNC_DAYS;
  if (since) {
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);
    days = Math.min(MAX_CATCHUP_DAYS, Math.max(1, Math.floor((now - start) / 86400000) + 1));
  }
  const enrolled = (users || []).filter((u) => u && !u.isDeleted && u.active !== false && u.esslId);
  const todayStr = localDate(now);
  const nowTime = nowHMS(now);
  const punches = [];
  let fromDate = todayStr;

  for (let d = 0; d < days; d += 1) {
    const dt = new Date(now);
    dt.setDate(now.getDate() - d);
    const date = localDate(dt);
    fromDate = date;
    if (dt.getDay() === 0) continue;
    enrolled.forEach((user, idx) => {
      demoDayPunches(user, idx, dt).forEach((p) => {
        if (date === todayStr && p.time > nowTime) return;
        const pin = String(user.esslId);
        punches.push({
          deviceUserId: pin,
          date,
          time: p.time,
          type: p.type,
          verification: p.verification,
          raw: `${pin}\t${date} ${p.time}\t${PUNCH_STATE_CODES[p.type]}\t${VERIFY_CODES[p.verification]}\t0\t0`
        });
      });
    });
  }
  return { punches, fromDate };
};

/** Store new device punches as raw rows with a running Punch ID; duplicates are ignored. */
export const importRawPunches = (prev, fetched = [], device = null, stamp = new Date().toISOString()) => {
  const deviceId = device?.id || '';
  const keyOf = (devId, userId, date, time) => `${devId}|${userId}|${date}|${time}`;
  const seen = new Set(getRawPunches(prev).map((p) => keyOf(p.deviceId, p.deviceUserId, p.punchDate, p.punchTime)));
  const byPin = new Map((prev.users || []).filter((u) => !u.isDeleted && u.esslId).map((u) => [String(u.esslId), u]));
  let seq = Number(prev.rawPunchSeq) || 0;
  const added = [];
  fetched.forEach((p) => {
    const key = keyOf(deviceId, p.deviceUserId, p.date, p.time);
    if (seen.has(key)) return;
    seen.add(key);
    seq += 1;
    const user = byPin.get(String(p.deviceUserId));
    added.push({
      id: `rp-${seq}`,
      punchId: seq,
      employeeId: user?.employeeId || '',
      employeeName: user ? (user.name || user.username || '') : '',
      deviceId,
      deviceName: device?.name || 'eSSL',
      deviceUserId: String(p.deviceUserId),
      punchDate: p.date,
      punchTime: p.time,
      punchType: p.type || 'Unknown',
      verification: p.verification || 'Unknown',
      rawData: p.raw || '',
      importedAt: stamp
    });
  });
  return { added, seq };
};

const punchFields = (inTime, outTime, cfg) => {
  const calc = calculateTimes(inTime, outTime, 'Day', cfg.stdHours);
  return {
    inTime,
    outTime,
    totalHours: calc.totalHours,
    otHours: calc.otHours,
    isLate: outTime ? calc.isLate : false,
    isEarlyLeave: outTime ? calc.isEarlyLeave : false
  };
};

/**
 * Raw punches → attendance. For each approved employee and day (on or after the
 * approval date), the first punch is In and the last punch is Out. eSSL rows are kept in
 * step with their punches; rows entered or edited by hand are left alone.
 * Returns { records, updates }.
 */
export const buildAttendanceFromPunches = (users = [], attendance = [], rawPunches = [], fromDate = '', now = new Date()) => {
  const byPin = new Map((users || []).filter(isEsslSyncEligible).map((u) => [String(u.esslId), u]));
  const groups = new Map();
  rawPunches.forEach((p) => {
    if (fromDate && p.punchDate < fromDate) return;
    const user = byPin.get(String(p.deviceUserId));
    if (!user) return;
    const approvedFrom = String(user.approvedAt || '').slice(0, 10);
    if (approvedFrom && p.punchDate < approvedFrom) return;
    const key = `${user.id}|${p.punchDate}`;
    if (!groups.has(key)) groups.set(key, { user, date: p.punchDate, punches: [] });
    groups.get(key).punches.push(p);
  });

  const byKey = new Map();
  (attendance || []).forEach((r) => {
    const k = `${r.userId}|${r.date}`;
    if (!byKey.has(k) || byKey.get(k).isDeleted) byKey.set(k, r);
  });
  const records = [];
  const updates = [];
  const stamp = now.toISOString();

  groups.forEach(({ user, date, punches }, key) => {
    const sorted = [...punches].sort((a, b) => a.punchTime.localeCompare(b.punchTime));
    const inTime = sorted[0].punchTime.slice(0, 5);
    const outTime = sorted.length > 1 ? sorted[sorted.length - 1].punchTime.slice(0, 5) : '';
    const cfg = SHIFT_TYPES[user.shiftType === '12hr' ? '12hr' : '9hr'];
    const punchIds = sorted.map((p) => p.punchId);
    const existing = byKey.get(key);

    if (existing) {
      if (existing.isDeleted || existing.source !== 'essl') return;
      const same = existing.inTime === inTime
        && (existing.outTime || '') === outTime
        && (existing.punchIds || []).length === punchIds.length;
      if (!same) updates.push({ ...existing, ...punchFields(inTime, outTime, cfg), punchIds, punchCount: punchIds.length, updatedAt: stamp });
      return;
    }

    records.push({
      id: `essl-${user.id}-${date}`,
      userId: String(user.id),
      date,
      shift: 'Day',
      ...punchFields(inTime, outTime, cfg),
      statusCode: 'P',
      status: 'Present',
      remark: `eSSL sync · ID ${user.esslId}`,
      esslId: String(user.esslId),
      punchIds,
      punchCount: punchIds.length,
      isHalfDay: false,
      username: user.name || user.username,
      employeeId: user.employeeId || 'N/A',
      department: user.department || 'General',
      leaveType: '',
      source: 'essl',
      createdAt: stamp
    });
  });

  return { records, updates };
};

/** Raw punches behind one attendance row (by linked Punch IDs, else by device user + date). */
export const punchesForAttendanceRow = (data, row) => {
  const all = getRawPunches(data);
  const ids = new Set((row?.punchIds || []).map(Number));
  const user = (data?.users || []).find((u) => String(u.id) === String(row?.userId));
  const pin = String(row?.esslId || user?.esslId || '');
  return all
    .filter((p) => (ids.size ? ids.has(Number(p.punchId)) : (pin && String(p.deviceUserId) === pin && p.punchDate === row?.date)))
    .sort((a, b) => a.punchTime.localeCompare(b.punchTime));
};

/** When the device last handed over punches successfully; null means never (first sync). */
export const lastSuccessfulSync = (data, device) =>
  device?.lastSuccessSync || device?.lastSync || data?.esslSettings?.lastSync || null;

const addSyncHistory = (prev, entry) => {
  const history = prev.deviceSyncHistory || [];
  const latest = history[0];
  const quiet = (e) => e && e.status === 'Success' && !e.imported && !e.added && !e.updated;
  if (quiet(entry) && quiet(latest) && latest.deviceId === entry.deviceId) {
    return [{ ...latest, at: entry.at, checks: (latest.checks || 1) + 1 }, ...history.slice(1)];
  }
  return [
    { id: `sync-${Date.parse(entry.at) || Date.now()}-${entry.deviceId}`, ...entry },
    ...history
  ].slice(0, SYNC_HISTORY_LIMIT);
};

/**
 * A failed attempt is recorded but leaves the last successful sync untouched, so the
 * next successful sync still asks for every punch since then.
 */
export const recordSyncFailure = (prev, deviceId, reason, now = new Date()) => {
  const devices = getBiometricDevices(prev);
  const device = devices.find((d) => d.id === deviceId) || devices[0] || null;
  const stamp = now.toISOString();
  const history = prev.deviceSyncHistory || [];
  const latest = history[0];
  const entry = {
    deviceId: device?.id || '',
    deviceName: device?.name || 'eSSL',
    at: stamp,
    from: lastSuccessfulSync(prev, device),
    status: 'Failed',
    reason,
    added: 0,
    updated: 0
  };
  const deviceSyncHistory = latest && latest.status === 'Failed' && latest.deviceId === entry.deviceId
    ? [{ ...latest, ...entry, id: latest.id, firstFailedAt: latest.firstFailedAt || latest.at, attempts: (latest.attempts || 1) + 1 }, ...history.slice(1)]
    : addSyncHistory(prev, { ...entry, attempts: 1 });
  return {
    ...prev,
    biometricDevices: devices.map((d) => (d === device ? { ...d, lastSyncError: reason, lastSyncAttempt: stamp } : d)),
    deviceSyncHistory
  };
};

/** Apply a sync result to the whole app state (used by manual and automatic sync). */
export const applyEsslSyncToState = (prev, now = new Date(), deviceId = null) => {
  const devices = getBiometricDevices(prev);
  const online = devices.filter((d) => d.status === 'Online');
  const source = devices.find((d) => d.id === deviceId) || online[0] || devices[0] || null;
  const stamp = now.toISOString();
  const since = lastSuccessfulSync(prev, source);

  const { punches: fetched } = fetchDevicePunches(prev.users || [], now, since);
  const { added: newPunches, seq } = importRawPunches(prev, fetched, source, stamp);
  const rawPunches = [...newPunches, ...getRawPunches(prev)].slice(0, RAW_PUNCH_LIMIT);
  const { records, updates } = buildAttendanceFromPunches(prev.users || [], prev.attendance || [], rawPunches, '', now);
  const updatedById = new Map(updates.map((r) => [r.id, r]));
  const attendance = [
    ...records,
    ...(prev.attendance || []).map((r) => updatedById.get(r.id) || r)
  ];
  const result = { imported: newPunches.length, added: records.length, updated: updates.length, records, updates, since };

  const syncedDevices = devices.map((d) => ((deviceId ? d === source : d.status === 'Online') || (!online.length && d === source)
    ? { ...d, status: 'Online', lastSync: stamp, lastSuccessSync: stamp, lastSyncError: '' }
    : d));

  return {
    result,
    next: {
      ...withDevices(prev, syncedDevices),
      attendance,
      rawPunches,
      rawPunchSeq: seq,
      deviceSyncHistory: addSyncHistory(prev, {
        deviceId: source?.id || '',
        deviceName: source?.name || 'eSSL',
        at: stamp,
        from: since,
        status: 'Success',
        imported: result.imported,
        added: result.added,
        updated: result.updated
      }),
      esslSettings: {
        ...defaultEsslSettings(),
        ...(prev.esslSettings || {}),
        connected: true,
        lastSync: stamp
      }
    }
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
