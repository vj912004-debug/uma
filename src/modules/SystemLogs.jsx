import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Download } from 'lucide-react';

const SystemLogs = () => {
  const { data } = useAppContext();
  const logs = data.auditLogs || [];

  const handleBackup = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `Uma_ERP_Backup_${new Date().toISOString().split('T')[0]}.json`;
    
    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="module-container">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>System Logs & Backups</h2>
          <p>Audit trail of all actions and data backups</p>
        </div>
        <button onClick={handleBackup} className="btn" style={{ gap: '0.5rem' }}>
          <Download size={16} /> Download Full Backup
        </button>
      </div>
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
              logs.slice().reverse().map(log => (
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
                    <div style={{ fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.action === 'UPDATE' ? 'Record modified' : 
                       log.action === 'CREATE' ? 'New record created' :
                       log.action === 'DELETE' ? 'Moved to recycle bin' : 'Restored from recycle bin'}
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
