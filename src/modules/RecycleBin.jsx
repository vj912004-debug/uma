import React from 'react';
import { useAppContext } from '../context/AppContext';

const RecycleBin = () => {
  const { data, restoreItem } = useAppContext();

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
                    <button className="btn-secondary" onClick={() => restoreItem(item._module, item.id)}>
                      Restore
                    </button>
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
