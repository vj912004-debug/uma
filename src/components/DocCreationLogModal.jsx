import React, { useMemo, useState } from 'react';
import { Calendar, Edit2, FileText, Search, Trash2, X } from 'lucide-react';
import DateField from './DateField';
import StatusTabBar from './StatusTabBar';
import { formatDate, getDefaultFiscalYearRange, newestFirst } from '../utils/dateUtils';
import { formatCreatedAt, resolveCreatedAt, resolveCreatedBy } from '../utils/docCreator';

const PAGE_SIZE = 10;
const DEFAULT_RANGE = getDefaultFiscalYearRange();

const inRange = (date, from, to) => {
  if (!date) return true;
  const day = String(date).slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

/**
 * Same layout as Utility Record List: tabs, date range, search, table, pager, actions.
 * columns: [{ key, label, render?(row) }]
 */
const DocCreationLogModal = ({
  open,
  onClose,
  title = 'Document Log',
  rows = [],
  columns = [],
  auditLogs = [],
  module = '',
  searchPlaceholder = 'Search…',
  getSearchText = (row) => Object.values(row || {}).join(' '),
  isPending = () => false,
  onEdit,
  onDelete
}) => {
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);
  const [page, setPage] = useState(1);

  const enriched = useMemo(
    () => newestFirst((rows || []).filter((r) => !r.isDeleted)).map((row) => {
      const doneBy = resolveCreatedBy(row, auditLogs, module);
      return {
        ...row,
        _doneBy: doneBy || '—',
        _createdAtLabel: formatCreatedAt(resolveCreatedAt(row, auditLogs, module))
      };
    }),
    [rows, auditLogs, module]
  );

  const pendingCount = useMemo(() => enriched.filter((r) => isPending(r)).length, [enriched, isPending]);
  const completedCount = enriched.length - pendingCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((row) => {
      if (statusTab === 'pending' && !isPending(row)) return false;
      if (statusTab === 'completed' && isPending(row)) return false;
      if (!inRange(row.date || String(row.createdAt || '').slice(0, 10), rangeFrom, rangeTo)) return false;
      if (!q) return true;
      const blob = `${getSearchText(row)} ${row._doneBy} ${row._createdAtLabel}`.toLowerCase();
      return blob.includes(q);
    });
  }, [enriched, search, rangeFrom, rangeTo, statusTab, getSearchText, isPending]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  if (!open) return null;

  const tableCols = [
    ...columns,
    { key: '_doneBy', label: 'Done By' },
    { key: '_createdAtLabel', label: 'Created At' }
  ];
  const colSpan = tableCols.length + (onEdit || onDelete ? 2 : 1);

  return (
    <div className="page-form-overlay">
      <section className="premium-card pm-card">
        <div className="pm-modal-head">
          <h2 className="pm-card-title">
            <FileText size={16} /> {title}
          </h2>
          <button type="button" className="btn" onClick={onClose}><X size={14} /> Close</button>
        </div>

        <div className="pm-list-head">
          <StatusTabBar
            value={statusTab}
            onChange={(v) => { setStatusTab(v); setPage(1); }}
            allCount={enriched.length}
            pendingCount={pendingCount}
            completedCount={completedCount}
          />
          <div className="pm-list-tools">
            <div className="pm-range">
              <Calendar size={15} />
              <DateField className="input-field" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }} />
              <span>–</span>
              <DateField className="input-field" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setPage(1); }} />
            </div>
            <div className="pm-search">
              <Search size={14} />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>

        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Sr. No</th>
                {tableCols.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                {(onEdit || onDelete) ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="pm-empty">
                    {enriched.length && !filtered.length
                      ? 'No records in the selected date range. Widen the date filter above to see saved entries.'
                      : 'No records yet.'}
                  </td>
                </tr>
              ) : pageRows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={onEdit ? 'pm-click-row' : undefined}
                  title={onEdit ? 'Click to open record' : undefined}
                  onClick={onEdit ? () => onEdit(row) : undefined}
                >
                  <td>{(pageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                  {tableCols.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {(onEdit || onDelete) ? (
                    <td className="pm-actions" onClick={(e) => e.stopPropagation()}>
                      {onEdit ? (
                        <button type="button" title="Edit" onClick={() => onEdit(row)}><Edit2 size={14} /></button>
                      ) : null}
                      {onDelete ? (
                        <button type="button" title="Delete" className="danger" onClick={() => onDelete(row)}><Trash2 size={14} /></button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pm-pager">
          <span>
            Showing {filtered.length ? (pageSafe - 1) * PAGE_SIZE + 1 : 0} to {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length} records
          </span>
          <div className="pm-pager-btns">
            <button type="button" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 6).map((n) => (
              <button type="button" key={n} className={n === pageSafe ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DocCreationLogModal;
export { formatDate };
