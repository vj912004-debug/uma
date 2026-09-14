import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Thermometer,
  Calendar,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  FileText
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import { formatDate, getDefaultFiscalYearRange } from '../utils/dateUtils';

const PAGE_SIZE = 10;
const DEFAULT_RANGE = getDefaultFiscalYearRange();

const inRange = (date, from, to) => {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const phaseCells = (p) => `${p?.r || '—'} / ${p?.y || '—'} / ${p?.b || '—'}`;

const UtilityTempRecordList = () => {
  const { data, deleteItemSoftly } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);

  const rows = useMemo(
    () => (data.utilityTempRecords || []).filter((r) => !r.isDeleted).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [data.utilityTempRecords]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!inRange(r.date, rangeFrom, rangeTo)) return false;
      if (!q) return true;
      return [r.date, r.time, r.remarks, r.oilLevelAtRest, r.make]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, rangeFrom, rangeTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const handleEdit = (row) => {
    navigate('/utility-temp-record', { state: { editId: row.id } });
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this temperature record?')) deleteItemSoftly('utilityTempRecords', id);
  };

  const exportExcel = () => {
    const sheet = filtered.map((r, i) => ({
      'Sr. No': i + 1,
      Date: formatDate(r.date),
      Time: r.time || '',
      Make: r.make || '',
      'Oil Level At Rest': r.oilLevelAtRest,
      'Total Time To Fill 12.5kg (Min)': r.fillTimeMin,
      'Main Switch R': r.mainSwitch175A?.r,
      'Main Switch Y': r.mainSwitch175A?.y,
      'Main Switch B': r.mainSwitch175A?.b,
      'Panel Main Switch R': r.panelMainSwitch?.r,
      'Panel Main Switch Y': r.panelMainSwitch?.y,
      'Panel Main Switch B': r.panelMainSwitch?.b,
      'Capacitor Switch R': r.capacitorSwitch?.r,
      'Capacitor Switch Y': r.capacitorSwitch?.y,
      'Capacitor Switch B': r.capacitorSwitch?.b,
      'Change Over Switch R': r.changeOverSwitch?.r,
      'Change Over Switch Y': r.changeOverSwitch?.y,
      'Change Over Switch B': r.changeOverSwitch?.b,
      'Compressor Main Inputs R': r.compressorMainInputs?.r,
      'Compressor Main Inputs Y': r.compressorMainInputs?.y,
      'Compressor Main Inputs B': r.compressorMainInputs?.b,
      'Comp Motor': r.newCompMotor,
      'Oil Separator': r.oilSeparator,
      'Air End': r.airEnd,
      'Air Cooler': r.airCooler,
      Tank: r.tank,
      'Comp Air Discharge Pipe Ss': r.dischargePipe,
      Remarks: r.remarks
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), 'Temp Records');
    XLSX.writeFile(wb, 'Utility_Temp_Records.xlsx');
  };

  return (
    <div className="pm-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <Thermometer size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Temperature Record List</h1>
            <p className="page-subtitle">View and manage saved temperature records of utility equipment.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <div className="pm-range">
            <Calendar size={15} />
            <DateField className="input-field" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }} />
            <span>–</span>
            <DateField className="input-field" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setPage(1); }} />
          </div>
          <Link to="/utility-temp-record" className="btn btn-primary">
            <Plus size={15} /> Add New Record
          </Link>
        </div>
      </header>

      <section className="premium-card pm-card">
        <div className="pm-list-head">
          <h2 className="pm-card-title" style={{ margin: 0 }}>
            <FileText size={16} /> Temperature Record List
          </h2>
          <div className="pm-list-tools">
            <div className="pm-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by date, time or remarks..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={exportExcel}>
              <Download size={14} /> Export
            </button>
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
                <th>Oil Level At Rest</th>
                <th>Fill Time (Min)</th>
                <th>Main Switch (R/Y/B)</th>
                <th>Panel Main Switch (R/Y/B)</th>
                <th>Capacitor Switch (R/Y/B)</th>
                <th>Change Over Switch (R/Y/B)</th>
                <th>Compressor Main Inputs (R/Y/B)</th>
                <th>Comp Motor</th>
                <th>Oil Separator</th>
                <th>Air End</th>
                <th>Air Cooler</th>
                <th>Tank</th>
                <th>Discharge Pipe Ss</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="pm-empty">
                    {rows.length && !filtered.length
                      ? 'No records in the selected date range. Widen the date filter above to see saved entries.'
                      : 'No temperature records found.'}
                  </td>
                </tr>
              ) : pageRows.map((r, idx) => (
                <tr key={r.id}>
                  <td>{(pageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.time || '—'}</td>
                  <td>{r.make || '—'}</td>
                  <td>{r.oilLevelAtRest}</td>
                  <td>{r.fillTimeMin}</td>
                  <td>{phaseCells(r.mainSwitch175A)}</td>
                  <td>{phaseCells(r.panelMainSwitch)}</td>
                  <td>{phaseCells(r.capacitorSwitch)}</td>
                  <td>{phaseCells(r.changeOverSwitch)}</td>
                  <td>{phaseCells(r.compressorMainInputs)}</td>
                  <td>{r.newCompMotor}</td>
                  <td>{r.oilSeparator}</td>
                  <td>{r.airEnd}</td>
                  <td>{r.airCooler}</td>
                  <td>{r.tank}</td>
                  <td>{r.dischargePipe}</td>
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

export default UtilityTempRecordList;
