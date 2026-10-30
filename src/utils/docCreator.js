/** Display name of the logged-in user for document stamps. */
export const actorDisplayName = (data) => {
  const u = data?.currentUser;
  return String(u?.name || u?.username || data?.settings?.userRole || 'System').trim() || 'System';
};

const docRefNo = (doc) => String(
  doc?.bprNo
  || doc?.invoiceNo
  || doc?.plNo
  || doc?.dcNo
  || doc?.noteNo
  || doc?.poNo
  || ''
).trim();

/** Prefer saved doneBy/createdBy; fall back to audit log for older docs. */
export const resolveCreatedBy = (doc, auditLogs = [], module = '') => {
  const saved = String(doc?.doneBy || doc?.createdBy || doc?.updatedBy || '').trim();
  if (saved) return saved;

  const id = String(doc?.id || '');
  const ref = docRefNo(doc);
  if (!id && !ref) return '—';

  const logs = [...(auditLogs || [])].reverse();
  const hit = logs.find((log) => {
    if (module && log.module && log.module !== module) return false;
    if (!['CREATE', 'UPDATE'].includes(String(log.action || ''))) return false;
    if (id && (String(log.refId || '') === id || String(log.newValue?.id || '') === id || String(log.oldValue?.id || '') === id)) {
      return true;
    }
    if (ref) {
      if (String(log.refNo || '') === ref) return true;
      const nv = log.newValue || {};
      const ov = log.oldValue || {};
      const candidates = [nv.bprNo, nv.invoiceNo, nv.plNo, nv.dcNo, ov.bprNo, ov.invoiceNo, ov.plNo, ov.dcNo];
      if (candidates.some((v) => String(v || '').trim() === ref)) return true;
      if (String(log.message || '').includes(ref)) return true;
    }
    return false;
  });

  return String(hit?.user || hit?.newValue?.doneBy || hit?.newValue?.createdBy || '').trim() || '—';
};

export const resolveCreatedAt = (doc, auditLogs = [], module = '') => {
  const saved = doc?.createdAt || doc?.updatedAt || '';
  if (saved) return saved;

  const id = String(doc?.id || '');
  const ref = docRefNo(doc);
  const logs = [...(auditLogs || [])].reverse();
  const hit = logs.find((log) => {
    if (log.action !== 'CREATE') return false;
    if (module && log.module && log.module !== module) return false;
    if (id && (String(log.refId || '') === id || String(log.newValue?.id || '') === id)) return true;
    if (ref && String(log.refNo || '') === ref) return true;
    return false;
  });
  if (hit?.timestamp) return hit.timestamp;
  return doc?.date || '';
};

export const formatCreatedAt = (raw) => {
  if (!raw) return '—';
  try {
    const str = String(raw).trim();
    const date = str.length === 10 && str[4] === '-'
      ? new Date(`${str}T00:00:00`)
      : new Date(str);
    if (Number.isNaN(date.getTime())) return str;
    // Date-only → show date; full timestamp → date + time
    if (str.length === 10 && str[4] === '-') {
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(raw);
  }
};
