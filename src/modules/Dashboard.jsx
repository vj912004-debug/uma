import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Factory,
  ShieldCheck,
  Cog,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Thermometer,
  Droplets,
  Gauge,
  PlusCircle,
  FileCheck,
  FileSpreadsheet,
  Activity,
  Layers,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { buildUnderProcessRows, getProductQty, receiptProductOptions } from '../utils/receiptProducts';
import { getCurrentFYKey } from '../utils/financialYear';

const StatKPI = ({ icon: Icon, value, label, subtext, subColor, path }) => {
  const navigate = useNavigate();
  return (
    <div
      className="ref-kpi-card"
      onClick={() => path && navigate(path)}
      style={{ cursor: path ? 'pointer' : 'default' }}
    >
      <div className="ref-kpi-icon-wrap">
        <Icon size={20} className="ref-kpi-icon" />
      </div>
      <div className="ref-kpi-content">
        <span className="ref-kpi-label">{label}</span>
        <div className="ref-kpi-value">{value}</div>
        <span className="ref-kpi-sub" style={{ color: subColor || '#16a34a' }}>
          {subtext}
        </span>
      </div>
    </div>
  );
};

const StatusBadge = ({ type, text }) => {
  return <span className={`ref-badge ref-badge-${type}`}>{text}</span>;
};

const Dashboard = () => {
  const { data } = useAppContext();
  const navigate = useNavigate();

  const allRows = useMemo(
    () =>
      buildUnderProcessRows(data.materialReceipts || [], data).map((row) => ({
        ...row,
        prodOpts: receiptProductOptions(row.mr, data)
      })),
    [data]
  );

  const realJobs = useMemo(
    () =>
      allRows.slice(0, 5).map((row, idx) => ({
        batchNo: row.mr.receiptNo || `B-2600${idx + 1}`,
        party: row.mr.partyName || 'ABC Pharma',
        product: row.productName || 'API-A',
        equipment: idx % 2 === 0 ? 'Jet Mill-01' : 'Pin Mill-01',
        stage: idx % 3 === 0 ? 'Milling' : idx % 3 === 1 ? 'PSD' : 'Packing',
        qty: getProductQty(row.mr, row.productName, row.prodOpts) || 250,
        status: idx === 0 ? 'in-progress' : idx === 1 ? 'awaiting-psd' : idx === 2 ? 'completed' : idx === 3 ? 'qa-pending' : 'in-progress',
        statusLabel: idx === 0 ? 'In Progress' : idx === 1 ? 'Awaiting PSD' : idx === 2 ? 'Completed' : idx === 3 ? 'QA Pending' : 'In Progress'
      })),
    [allRows]
  );

  // Fallback demo rows if real jobs list is small
  const displayJobs = realJobs.length >= 5 ? realJobs : [
    { batchNo: 'B-26001', party: 'ABC Pharma', product: 'API-A', equipment: 'Jet Mill-01', stage: 'Milling', qty: 250, status: 'in-progress', statusLabel: 'In Progress' },
    { batchNo: 'B-26002', party: 'XYZ Labs', product: 'API-B', equipment: 'Pin Mill-01', stage: 'PSD', qty: 180, status: 'awaiting-psd', statusLabel: 'Awaiting PSD' },
    { batchNo: 'B-26003', party: 'PQR Pharma', product: 'API-C', equipment: 'Jet Mill-02', stage: 'Packing', qty: 320, status: 'completed', statusLabel: 'Completed' },
    { batchNo: 'B-26004', party: 'ABC Pharma', product: 'API-D', equipment: '—', stage: 'QA Review', qty: 150, status: 'qa-pending', statusLabel: 'QA Pending' },
    { batchNo: 'B-26005', party: 'Sun Pharma', product: 'API-E', equipment: 'Jet Mill-01', stage: 'Milling', qty: 400, status: 'in-progress', statusLabel: 'In Progress' }
  ];

  return (
    <div className="ref-dashboard-container">
      {/* Welcome Subheader */}
      <div className="ref-dash-header">
        <h1 className="ref-dash-title">Dashboard</h1>
        <p className="ref-dash-subtitle">Welcome back! Here's what's happening at your plant today.</p>
      </div>

      {/* Top 5 KPI Cards */}
      <div className="ref-kpi-row">
        <StatKPI
          icon={FlaskConical}
          value="08"
          label="Active Batches"
          subtext="↑ 2 from yesterday"
          subColor="#16a34a"
          path="/under-process"
        />
        <StatKPI
          icon={Factory}
          value="12 kg (API)"
          label="Today's Production"
          subtext="↑ 15% from last week"
          subColor="#16a34a"
          path="/processing-sheet"
        />
        <StatKPI
          icon={ShieldCheck}
          value="04 batches"
          label="Awaiting QA Release"
          subtext="→ 0 from yesterday"
          subColor="#64748b"
          path="/bpr"
        />
        <StatKPI
          icon={Cog}
          value="78%"
          label="Equipment Utilization"
          subtext="↑ 6% from last week"
          subColor="#16a34a"
          path="/pm-air-compressor"
        />
        <StatKPI
          icon={AlertTriangle}
          value="02 batches"
          label="Open Deviations"
          subtext="↓ 1 from yesterday"
          subColor="#dc2626"
          path="/tasks"
        />
      </div>

      {/* Main Grid: Left 2 Columns & Right 1 Column */}
      <div className="ref-main-grid">
        {/* Left Column (Main Tables & Panels) */}
        <div className="ref-grid-left">
          {/* Batch Processing Status */}
          <div className="ref-card">
            <div className="ref-card-header">
              <h3>Batch Processing Status</h3>
              <button className="ref-view-all" onClick={() => navigate('/under-process')}>
                View All →
              </button>
            </div>
            <div className="ref-table-responsive">
              <table className="ref-table">
                <thead>
                  <tr>
                    <th>Batch No.</th>
                    <th>Party</th>
                    <th>Product</th>
                    <th>Equipment</th>
                    <th>Stage</th>
                    <th>Qty (kg)</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayJobs.map((item, idx) => (
                    <tr key={idx} onClick={() => navigate('/under-process')}>
                      <td className="ref-td-bold">{item.batchNo}</td>
                      <td>{item.party}</td>
                      <td>{item.product}</td>
                      <td>{item.equipment}</td>
                      <td>{item.stage}</td>
                      <td>{item.qty}</td>
                      <td>
                        <StatusBadge type={item.status} text={item.statusLabel} />
                      </td>
                      <td>
                        <MoreVertical size={15} className="ref-row-more" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PSD & Equipment Utilization Grid */}
          <div className="ref-two-col-grid">
            {/* Particle Size Distribution (PSD) */}
            <div className="ref-card">
              <div className="ref-card-header">
                <h3>Particle Size Distribution (PSD)</h3>
                <button className="ref-view-all" onClick={() => navigate('/psd')}>
                  View All →
                </button>
              </div>
              <div className="ref-table-responsive">
                <table className="ref-table ref-table-compact">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Parameter</th>
                      <th>Target</th>
                      <th>Actual</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td rowSpan={3} className="ref-td-bold">B-26001 (API-A)</td>
                      <td>D10</td>
                      <td>≤ 10 µm</td>
                      <td>8.4 µm</td>
                      <td><CheckCircle2 size={15} className="text-green" /></td>
                    </tr>
                    <tr>
                      <td>D50</td>
                      <td>20 – 30 µm</td>
                      <td>24.6 µm</td>
                      <td><CheckCircle2 size={15} className="text-green" /></td>
                    </tr>
                    <tr>
                      <td>D90</td>
                      <td>≤ 50 µm</td>
                      <td>51.8 µm</td>
                      <td><AlertTriangle size={15} className="text-amber" /></td>
                    </tr>
                    <tr>
                      <td rowSpan={2} className="ref-td-bold">B-26002 (API-B)</td>
                      <td>D10</td>
                      <td>≤ 10 µm</td>
                      <td>9.1 µm</td>
                      <td><CheckCircle2 size={15} className="text-green" /></td>
                    </tr>
                    <tr>
                      <td>D50</td>
                      <td>20 – 30 µm</td>
                      <td>26.8 µm</td>
                      <td><CheckCircle2 size={15} className="text-green" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Equipment Utilization & Downtime */}
            <div className="ref-card">
              <div className="ref-card-header">
                <h3>Equipment Utilization & Downtime</h3>
                <button className="ref-view-all" onClick={() => navigate('/pm-air-compressor')}>
                  View All →
                </button>
              </div>
              <div className="ref-table-responsive">
                <table className="ref-table ref-table-compact">
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Status</th>
                      <th>Utilization</th>
                      <th>Runtime</th>
                      <th>Next Maint.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="ref-td-bold">Jet Mill-01</td>
                      <td><span className="dot-status dot-green"></span> Running</td>
                      <td>82%</td>
                      <td>168 hr</td>
                      <td>12 days</td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">Jet Mill-02</td>
                      <td><span className="dot-status dot-green"></span> Running</td>
                      <td>74%</td>
                      <td>143 hr</td>
                      <td>21 days</td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">Pin Mill-01</td>
                      <td><span className="dot-status dot-amber"></span> Idle</td>
                      <td>48%</td>
                      <td>82 hr</td>
                      <td>7 days</td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">Air Jet Sieve-01</td>
                      <td><span className="dot-status dot-green"></span> Available</td>
                      <td>65%</td>
                      <td>91 hr</td>
                      <td>15 days</td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">Compressor-01</td>
                      <td><span className="dot-status dot-green"></span> Running</td>
                      <td>88%</td>
                      <td>210 hr</td>
                      <td>30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* QA Release Queue & Production Trend Grid */}
          <div className="ref-two-col-grid">
            {/* QA Release Queue */}
            <div className="ref-card">
              <div className="ref-card-header">
                <h3>QA Release Queue</h3>
                <button className="ref-view-all" onClick={() => navigate('/bpr')}>
                  View All →
                </button>
              </div>
              <div className="ref-table-responsive">
                <table className="ref-table ref-table-compact">
                  <thead>
                    <tr>
                      <th>Batch No.</th>
                      <th>Product</th>
                      <th>QC</th>
                      <th>Docs</th>
                      <th>QA Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="ref-td-bold">B-26001</td>
                      <td>API-A</td>
                      <td>✓</td>
                      <td>✓</td>
                      <td><StatusBadge type="awaiting-qa" text="Awaiting QA" /></td>
                      <td><button className="ref-action-btn" onClick={() => navigate('/bpr')}>Review</button></td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">B-26002</td>
                      <td>API-B</td>
                      <td>✓</td>
                      <td>✓</td>
                      <td><StatusBadge type="awaiting-qa" text="Awaiting QA" /></td>
                      <td><button className="ref-action-btn" onClick={() => navigate('/bpr')}>Review</button></td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">B-26003</td>
                      <td>API-C</td>
                      <td>✓</td>
                      <td>✓</td>
                      <td><StatusBadge type="qa-pending" text="QC Pending" /></td>
                      <td><button className="ref-action-btn" onClick={() => navigate('/psd')}>View</button></td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">B-26004</td>
                      <td>API-D</td>
                      <td>✓</td>
                      <td>✓</td>
                      <td><StatusBadge type="qa-pending" text="QA Pending" /></td>
                      <td><button className="ref-action-btn" onClick={() => navigate('/bpr')}>Review</button></td>
                    </tr>
                    <tr>
                      <td className="ref-td-bold">B-26005</td>
                      <td>API-E</td>
                      <td>✓</td>
                      <td>✓</td>
                      <td><StatusBadge type="released" text="Released" /></td>
                      <td><button className="ref-action-btn" onClick={() => navigate('/packing-list')}>View</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Production Trend (Today) */}
            <div className="ref-card">
              <div className="ref-card-header">
                <h3>Production Trend (Today)</h3>
                <div className="ref-chart-legend-wrap">
                  <span className="legend-chip purple-chip">Production (kg)</span>
                  <span className="legend-chip line-chip">Utilization (%)</span>
                </div>
              </div>
              <div className="ref-chart-body">
                {/* Simulated Chart Bars */}
                <div className="ref-bar-chart">
                  {[
                    { time: '06:00', val: 120, pct: 40 },
                    { time: '08:00', val: 180, pct: 55 },
                    { time: '10:00', val: 240, pct: 70 },
                    { time: '12:00', val: 290, pct: 82 },
                    { time: '14:00', val: 320, pct: 90 },
                    { time: '16:00', val: 310, pct: 88 },
                    { time: '18:00', val: 280, pct: 75 }
                  ].map((bar, i) => (
                    <div key={i} className="chart-col">
                      <div className="chart-bar-wrap">
                        <div
                          className="chart-bar-fill"
                          style={{ height: `${(bar.val / 350) * 100}%` }}
                          title={`${bar.val} kg (${bar.pct}%)`}
                        ></div>
                      </div>
                      <span className="chart-time">{bar.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Widgets Stacked) */}
        <div className="ref-grid-right">
          {/* Today's Actions */}
          <div className="ref-card">
            <div className="ref-card-header">
              <h3>Today's Actions</h3>
            </div>
            <div className="ref-actions-list">
              <div className="ref-action-row" onClick={() => navigate('/tasks')}>
                <div className="ref-action-left">
                  <span className="num-badge num-red">1</span>
                  <span className="action-text">OOS Investigation</span>
                </div>
                <ChevronRight size={14} className="action-arrow" />
              </div>

              <div className="ref-action-row" onClick={() => navigate('/bpr')}>
                <div className="ref-action-left">
                  <span className="num-badge num-amber">4</span>
                  <span className="action-text">Batches Awaiting QA Release</span>
                </div>
                <ChevronRight size={14} className="action-arrow" />
              </div>

              <div className="ref-action-row" onClick={() => navigate('/tasks')}>
                <div className="ref-action-left">
                  <span className="num-badge num-amber">2</span>
                  <span className="action-text">Overdue Actions</span>
                </div>
                <ChevronRight size={14} className="action-arrow" />
              </div>

              <div className="ref-action-row" onClick={() => navigate('/pm-air-compressor')}>
                <div className="ref-action-left">
                  <span className="num-badge num-amber">1</span>
                  <span className="action-text">Maintenance Due</span>
                </div>
                <ChevronRight size={14} className="action-arrow" />
              </div>

              <div className="ref-action-row" onClick={() => navigate('/payment-follow-up')}>
                <div className="ref-action-left">
                  <span className="num-badge num-blue">3</span>
                  <span className="action-text">Follow-ups Due Today</span>
                </div>
                <ChevronRight size={14} className="action-arrow" />
              </div>
            </div>
          </div>

          {/* Cleanroom Environment */}
          <div className="ref-card">
            <div className="ref-card-header">
              <h3>Cleanroom Environment</h3>
              <button className="ref-view-all" onClick={() => navigate('/utility-temp-record')}>
                View All →
              </button>
            </div>
            <div className="cleanroom-metrics">
              <div className="metric-box">
                <div className="metric-icon-title">
                  <Thermometer size={14} className="text-purple" />
                  <span>Temperature</span>
                </div>
                <div className="metric-val">22.4 °C</div>
                <span className="metric-tag tag-green">(20 – 25) ✓</span>
              </div>

              <div className="metric-box">
                <div className="metric-icon-title">
                  <Droplets size={14} className="text-purple" />
                  <span>Humidity</span>
                </div>
                <div className="metric-val">48.2 % RH</div>
                <span className="metric-tag tag-green">(45 – 55) ✓</span>
              </div>

              <div className="metric-box">
                <div className="metric-icon-title">
                  <Gauge size={14} className="text-purple" />
                  <span>Diff. Pressure</span>
                </div>
                <div className="metric-val">+12 Pa</div>
                <span className="metric-tag tag-green">(2 – 10) ✓</span>
              </div>
            </div>

            <div className="area-status-head">Area Wise Status</div>
            <table className="ref-table ref-table-micro">
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Temp (°C)</th>
                  <th>RH (%)</th>
                  <th>DP (Pa)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Production</td>
                  <td>22.4</td>
                  <td>48.2</td>
                  <td>+12</td>
                  <td><CheckCircle2 size={14} className="text-green" /></td>
                </tr>
                <tr>
                  <td>Packing</td>
                  <td>23.1</td>
                  <td>51.0</td>
                  <td>+10</td>
                  <td><CheckCircle2 size={14} className="text-green" /></td>
                </tr>
                <tr>
                  <td>QC</td>
                  <td>21.8</td>
                  <td>47.0</td>
                  <td>+15</td>
                  <td><CheckCircle2 size={14} className="text-green" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quality & Compliance */}
          <div className="ref-card">
            <div className="ref-card-header">
              <h3>Quality & Compliance</h3>
              <button className="ref-view-all" onClick={() => navigate('/bpr')}>
                View All →
              </button>
            </div>
            <div className="ref-compliance-list">
              <div className="compliance-row">
                <span className="num-badge num-amber">4</span>
                <span>Batches Awaiting QA Release</span>
              </div>
              <div className="compliance-row">
                <span className="num-badge num-red">1</span>
                <span>OOS Investigation</span>
              </div>
              <div className="compliance-row">
                <span className="num-badge num-amber">2</span>
                <span>OOT Results</span>
              </div>
              <div className="compliance-row">
                <span className="num-badge num-amber">3</span>
                <span>Open Deviations</span>
              </div>
              <div className="compliance-row">
                <span className="num-badge num-green">18</span>
                <span>Batches Released Today</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="ref-card">
            <div className="ref-card-header">
              <h3>Recent Alerts</h3>
              <button className="ref-view-all" onClick={() => navigate('/tasks')}>
                View All →
              </button>
            </div>
            <div className="ref-alerts-list">
              <div className="alert-item">
                <span className="alert-time">10:24</span>
                <span className="alert-msg">Batch B26004 - OOS detected (D90)</span>
                <span className="alert-tag tag-high">High</span>
              </div>
              <div className="alert-item">
                <span className="alert-time">09:45</span>
                <span className="alert-msg">Jet Mill-02 - Maintenance due in 7 days</span>
                <span className="alert-tag tag-medium">Medium</span>
              </div>
              <div className="alert-item">
                <span className="alert-time">08:32</span>
                <span className="alert-msg">Batch B26002 - Awaiting PSD results</span>
                <span className="alert-tag tag-medium">Medium</span>
              </div>
              <div className="alert-item">
                <span className="alert-time">07:50</span>
                <span className="alert-msg">Cleanroom RH above range (56%)</span>
                <span className="alert-tag tag-high">High</span>
              </div>
              <div className="alert-item">
                <span className="alert-time">06:15</span>
                <span className="alert-msg">Dispatch delayed for Party: Sun Pharma</span>
                <span className="alert-tag tag-info">Info</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="ref-card">
            <div className="ref-card-header">
              <h3>Quick Links</h3>
            </div>
            <div className="ref-quick-links-grid">
              <button className="qlink-btn" onClick={() => navigate('/under-process')}>
                <PlusCircle size={16} className="text-purple" />
                <span>Create Job Order</span>
              </button>
              <button className="qlink-btn" onClick={() => navigate('/psd')}>
                <FileSpreadsheet size={16} className="text-purple" />
                <span>Run PSD Report</span>
              </button>
              <button className="qlink-btn" onClick={() => navigate('/bpr')}>
                <Activity size={16} className="text-purple" />
                <span>View Batch Records</span>
              </button>
              <button className="qlink-btn" onClick={() => navigate('/pm-air-compressor')}>
                <Cog size={16} className="text-purple" />
                <span>Equipment Status</span>
              </button>
              <button className="qlink-btn" onClick={() => navigate('/bpr')}>
                <ShieldCheck size={16} className="text-purple" />
                <span>QA Release Queue</span>
              </button>
              <button className="qlink-btn" onClick={() => navigate('/reports')}>
                <FileCheck size={16} className="text-purple" />
                <span>Generate Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
