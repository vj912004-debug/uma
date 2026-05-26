import React from 'react';
import { useAppContext } from '../context/AppContext';

const RecycleBin = () => {
  const { data, restoreItem, hardDeleteItem } = useAppContext();

  // Find all items with isDeleted: true across all modules
  const getDeletedItems = () => {
    const deleted = [];
    Object.keys(data).forEach(module => {
      if (Array.isArray(data[module])) {
        data[module].forEach(item => {
          if (item.isDeleted) {
            deleted.push({ ...item, _module: module });
          }
        });
      }
    });
    return deleted.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
  };

  const deletedItems = getDeletedItems();

  return (
    <div className="module-container">
      <div className="module-header">
        <h2>Recycle Bin</h2>
        <p>View and restore deleted records</p>
      </div>
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Deleted At</th>
              <th>Module</th>
              <th>Record ID / Name</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {deletedItems.length === 0 ? (
              <tr><td colSpan="4" style={{textAlign:'center'}}>Recycle bin is empty.</td></tr>
            ) : (
              deletedItems.map(item => (
                <tr key={item.id}>
                  <td>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'N/A'}</td>
                  <td style={{textTransform:'capitalize'}}>{item._module}</td>
                  <td>{item.name || item.partyName || item.productName || item.batchNo || item.id}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-secondary" onClick={() => restoreItem(item._module, item.id)}>
                        Restore
                      </button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => {
                        if (window.confirm("Permanently delete this record? This action cannot be undone.")) {
                          hardDeleteItem(item._module, item.id);
                        }
                      }}>
                        Permanent Delete
                      </button>
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

export default RecycleBin;
