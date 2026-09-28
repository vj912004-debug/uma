import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Wrench,
  Calendar,
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import ExportButton from '../components/ExportButton';
import DateField from '../components/DateField';
import StatusTabBar from '../components/StatusTabBar';
import { formatDate, getDefaultFiscalYearRange, newestFirst } from '../utils/dateUtils';

const PAGE_SIZE = 10;
const DEFAULT_RANGE = getDefaultFiscalYearRange();

const inRange = (date, from, to) => {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const UtilityRecordList = () => {
  const { data, deleteItemSoftly } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);

  const rows = useMemo(
    () => newestFirst((data.utilityRecords || []).filter((r) => !r.isDeleted)),
    [data.utilityRecords]
  );

  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(`${dateStr}T00:00:00`);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const isUtilityPending = (r) => {
    if (String(r.status || '').toLowerCase() === 'pending') return true;
    const incomplete = !String(r.doneBy || '').trim() || !String(r.time || '').trim();
    return isCurrentMonth(r.date) && incomplete;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusTab === 'pending' && !isUtilityPending(r)) return false;
      if (statusTab === 'completed' && isUtilityPending(r)) return false;
      if (!inRange(r.date, rangeFrom, rangeTo)) return false;
      if (!q) return true;
      return [r.date, r.time, r.remarks, r.doneBy, r.loadingUnloadingTime, r.make]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, rangeFrom, rangeTo, statusTab]);

  const pendingCount = rows.filter(isUtilityPending).length;
  const completedCount = rows.filter((r) => !isUtilityPending(r)).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const handleEdit = (row) => {
    navigate('/utility-record', { state: { editId: row.id } });
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this utility record?')) deleteItemSoftly('utilityRecords', id);
  };

  const exportRows = filtered.map((r, i) => ({
    srNo: i + 1,
    date: formatDate(r.date),
    time: r.time || '',
    make: r.make || '',
    voltage1: r.voltage1,
    voltage2: r.voltage2,
    voltage3: r.voltage3,
    ampere1: r.ampere1,
    ampere2: r.ampere2,
    ampere3: r.ampere3,
    dryer1: r.oldDryerStart,
    dryer2: r.newDryerStart,
    moisture1: r.oldMoistureSeparator,
    moisture2: r.newMoistureSeparator,
    tank1: r.smallTank1Pressure,
    tank2: r.bigNewTank2Pressure,
    loadingTime: r.loadingUnloadingTime,
    temp1: r.tempCompressorOld,
    temp2: r.tempCompressorNew,
    doneBy: r.doneBy,
    remarks: r.remarks
  }));
  const exportColumns = [
    { label: 'Sr. No', key: 'srNo' },
    { label: 'Date', key: 'date' },
    { label: 'Time', key: 'time' },
    { label: 'Make', key: 'make' },
    { label: 'Voltage - 1 (V)', key: 'voltage1' },
    { label: 'Voltage - 2 (V)', key: 'voltage2' },
    { label: 'Voltage - 3 (V)', key: 'voltage3' },
    { label: 'Ampere - 1 (A)', key: 'ampere1' },
    { label: 'Ampere - 2 (A)', key: 'ampere2' },
    { label: 'Ampere - 3 (A)', key: 'ampere3' },
    { label: 'Dryer Start - 1', key: 'dryer1' },
    { label: 'Dryer Start - 2', key: 'dryer2' },
    { label: 'Moisture Separator Working - 1', key: 'moisture1' },
    { label: 'Moisture Separator Working - 2', key: 'moisture2' },
    { label: 'Tank - 1 Pressure (Kg)', key: 'tank1' },
    { label: 'Tank - 2 Pressure (Kg)', key: 'tank2' },
    { label: 'Loading/Unloading Time', key: 'loadingTime' },
    { label: 'Temp. of Compressor - 1 (°C)', key: 'temp1' },
    { label: 'Temp. of Compressor - 2 (°C)', key: 'temp2' },
    { label: 'Done By', key: 'doneBy' },
    { label: 'Remarks', key: 'remarks' }
  ];

  return (
    <div className="pm-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <Wrench size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Utility Record List</h1>
            <p className="page-subtitle">View and manage saved daily utility consumption records.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <div className="pm-range">
            <Calendar size={15} />
            <DateField className="input-field" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }} />
            <span>–</span>
            <DateField className="input-field" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setPage(1); }} />
          </div>
          <ExportButton data={exportRows} columns={exportColumns} filename="Utility_Records" title="Utility Records" />
          <Link to="/utility-record" className="btn btn-primary">
            <Plus size={15} /> Add New Record
          </Link>
        </div>
      </header>

      <StatusTabBar
        value={statusTab}
        onChange={(v) => { setStatusTab(v); setPage(1); }}
        allCount={rows.length}
        pendingCount={pendingCount}
        completedCount={completedCount}
      />

      <section className="premium-card pm-card">
        <div className="pm-list-head">
          <h2 className="pm-card-title" style={{ margin: 0 }}>
            <FileText size={16} /> Utility Records
          </h2>
          <div className="pm-list-tools">
            <div className="pm-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by date, time, or remarks..."
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
                <th>Date</th>
                <th>Time</th>
                <th>Make</th>
                <th>Voltage - 1 (V)</th>
                <th>Voltage - 2 (V)</th>
                <th>Voltage - 3 (V)</th>
                <th>Ampere - 1 (A)</th>
                <th>Ampere - 2 (A)</th>
                <th>Ampere - 3 (A)</th>
                <th>Dryer Start - 1</th>
                <th>Dryer Start - 2</th>
                <th>Moisture Separator Working - 1</th>
                <th>Moisture Separator Working - 2</th>
                <th>Tank - 1 Pressure (Kg)</th>
                <th>Tank - 2 Pressure (Kg)</th>
                <th>Loading/Unloading Time</th>
                <th>Temp. Comp. - 1 (°C)</th>
                <th>Temp. Comp. - 2 (°C)</th>
                <th>Done By</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={22} className="pm-empty">
                    {rows.length && !filtered.length
                      ? 'No records in the selected date range. Widen the date filter above to see saved entries.'
                      : 'No utility records found.'}
                  </td>
                </tr>
              ) : pageRows.map((r, idx) => (
                <tr key={r.id}>
                  <td>{(pageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.time || '—'}</td>
                  <td>{r.make || '—'}</td>
                  <td>{r.voltage1}</td>
                  <td>{r.voltage2}</td>
                  <td>{r.voltage3}</td>
                  <td>{r.ampere1}</td>
                  <td>{r.ampere2}</td>
                  <td>{r.ampere3}</td>
                  <td>{r.oldDryerStart}</td>
                  <td>{r.newDryerStart}</td>
                  <td>{r.oldMoistureSeparator}</td>
                  <td>{r.newMoistureSeparator}</td>
                  <td>{r.smallTank1Pressure}</td>
                  <td>{r.bigNewTank2Pressure}</td>
                  <td>{r.loadingUnloadingTime}</td>
                  <td>{r.tempCompressorOld}</td>
                  <td>{r.tempCompressorNew}</td>
                  <td>{r.doneBy}</td>
                  <td>{r.remarks || '—'}</td>
                  <td className="pm-actions">
                    <button type="button" title="Edit" onClick={() => handleEdit(r)}><Edit2 size={14} /></button>
                    <button type="button" title="Delete" className="danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                  </td>
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

export default UtilityRecordList;
