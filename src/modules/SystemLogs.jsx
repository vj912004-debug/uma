import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const SystemLogs = () => {
  const { data } = useAppContext();
  const logs = data.auditLogs || [];

  const today = new Date().toISOString().split('T')[0];
  const lastBackupDate = localStorage.getItem('uma_last_backup_date') || '';

  const handleBackup = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `Uma_ERP_Backup_${new Date().toISOString().split('T')[0]}.json`;
    
    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    localStorage.setItem('uma_last_backup_date', today);
  };

  const handleExcelBackup = () => {
    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    addSheet('Parties', data.parties || []);
    addSheet('MaterialReceipts', data.materialReceipts || []);
    addSheet('ProductionPlans', data.productionPlans || []);
    addSheet('Invoices', data.invoices || []);
    addSheet('BPR', data.bprs || []);
    addSheet('PSD', data.psds || []);
    addSheet('PackingLists', data.packingLists || []);
    addSheet('DeliveryChallans', data.deliveryChallans || []);
    addSheet('Payments', data.payments || []);
    addSheet('DebitNotes', data.debitNotes || []);
    addSheet('CreditNotes', data.creditNotes || []);
    addSheet('PurchaseOrders', data.purchaseOrders || []);
    addSheet('Quotations', data.quotations || []);
    addSheet('Tasks', data.tasks || []);
    addSheet('Attendance', data.attendance || []);
    addSheet('AuditLogs', (data.auditLogs || []).map(l => ({ ...l, oldValue: undefined, newValue: undefined })));

    XLSX.writeFile(wb, `Uma_ERP_All_Data_${today}.xlsx`);
    localStorage.setItem('uma_last_backup_date', today);
  };

  const handlePDFBackup = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("UMA MICRON - Full Data Summary", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${today}`, 14, 24);

    const sections = [
      { title: 'Material Receipts', rows: (data.materialReceipts || []).map(r => ({ receiptNo: r.receiptNo, date: r.date, partyName: r.partyName, productName: r.productName, totalQty: r.totalQty, totalDrums: r.totalDrums })) },
      { title: 'Tax Invoices', rows: (data.invoices || []).filter(i => i.invoiceNo?.includes('/IN/')).map(i => ({ invoiceNo: i.invoiceNo, date: i.date, partyName: i.partyName, qty: i.qty, total: i.total })) },
      { title: 'Payments', rows: (data.payments || []).map(p => ({ date: p.date, partyName: p.partyName, invoiceNo: p.invoiceNo, amount: p.amount, tds: p.tds, mode: p.paymentMode, ref: p.referenceNo })) },
      { title: 'Audit Logs', rows: (data.auditLogs || []).slice(-200).map(l => ({ time: l.timestamp, user: l.user, action: l.action, module: l.module, details: l.details })) }
    ];

    let y = 30;
    sections.forEach(sec => {
      doc.setFont("helvetica", "bold");
      doc.text(sec.title, 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [Object.keys(sec.rows[0] || { empty: '' })],
        body: (sec.rows.length ? sec.rows : [{ empty: 'No records' }]).map(r => Object.values(r)),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 }
      });
      y = doc.lastAutoTable.finalY + 8;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`Uma_ERP_Summary_${today}.pdf`);
    localStorage.setItem('uma_last_backup_date', today);
  };

  const reminderNeeded = lastBackupDate !== today;

  const lastActions = useMemo(() => logs.slice().reverse().slice(0, 50), [logs]);

  return (
    <div className="module-container">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>System Logs & Backups</h2>
          <p>Audit trail of all actions and data backups</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={handleBackup} className="btn" style={{ gap: '0.5rem' }}>
            <Download size={16} /> Backup JSON
          </button>
          <button onClick={handleExcelBackup} className="btn" style={{ gap: '0.5rem' }}>
            <Download size={16} /> Backup Excel
          </button>
          <button onClick={handlePDFBackup} className="btn" style={{ gap: '0.5rem' }}>
            <Download size={16} /> Backup PDF
          </button>
        </div>
      </div>

      {reminderNeeded && (
        <div className="premium-card" style={{ marginBottom: '1rem', border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Daily Backup Reminder</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>No backup downloaded today. Please click one of the backup buttons above.</p>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Module</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan="5" style={{textAlign:'center'}}>No logs available.</td></tr>
            ) : (
              lastActions.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.user}</td>
                  <td>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold',
                      backgroundColor: log.action === 'CREATE' ? 'rgba(16,185,129,0.2)' : log.action === 'UPDATE' ? 'rgba(59,130,246,0.2)' : log.action === 'DELETE' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                      color: log.action === 'CREATE' ? '#10b981' : log.action === 'UPDATE' ? '#3b82f6' : log.action === 'DELETE' ? '#ef4444' : '#f59e0b'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{textTransform:'capitalize'}}>{log.module}</td>
                  <td>
                    <div style={{ fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details || ''}>
                      {log.action === 'UPDATE' ? (log.message || log.details || 'Record modified') : 
                       log.action === 'CREATE' ? 'New record created' :
                       log.action === 'DELETE' ? 'Moved to recycle bin' : 
                       log.action === 'RESTORE' ? 'Restored from recycle bin' : 
                       log.action === 'HARD_DELETE' ? 'Permanently deleted' : 'Action performed'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SystemLogs;
