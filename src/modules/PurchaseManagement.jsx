import SimpleCrudModule from '../components/SimpleCrudModule';

const emptyForm = () => ({
  purchaseNo: `PM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
  date: new Date().toISOString().split('T')[0],
  vendorName: '',
  itemDescription: '',
  category: 'General',
  qty: '',
  unit: 'Pcs',
  amount: '',
  invoiceNo: '',
  paymentStatus: 'Pending',
  remarks: ''
});

const PurchaseManagement = () => (
  <SimpleCrudModule
    title="Purchase Management"
    subtitle="Track vendor purchases, invoices and payment status."
    collectionKey="purchaseManagement"
    docNoKey="purchaseNo"
    searchKeys={['purchaseNo', 'vendorName', 'itemDescription', 'invoiceNo', 'category', 'paymentStatus']}
    emptyForm={emptyForm}
    columns={[
      { key: 'purchaseNo', label: 'Purchase No.' },
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'vendorName', label: 'Vendor' },
      { key: 'itemDescription', label: 'Item' },
      { key: 'qty', label: 'Qty' },
      { key: 'amount', label: 'Amount', format: 'money' },
      { key: 'paymentStatus', label: 'Status' }
    ]}
    fields={[
      { key: 'purchaseNo', label: 'Purchase No.', type: 'text', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'vendorName', label: 'Vendor Name', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['General', 'Spares', 'Consumables', 'Utilities', 'Services', 'Capital'], required: true },
      { key: 'itemDescription', label: 'Item / Description', type: 'textarea', span: 2, required: true },
      { key: 'qty', label: 'Quantity', type: 'number', required: true },
      { key: 'unit', label: 'Unit', type: 'select', options: ['Pcs', 'Kg', 'Ltr', 'Set', 'Nos', 'MT'], required: true },
      { key: 'amount', label: 'Amount (₹)', type: 'number', required: true },
      { key: 'invoiceNo', label: 'Vendor Invoice No.', type: 'text' },
      { key: 'paymentStatus', label: 'Payment Status', type: 'select', options: ['Pending', 'Partial', 'Paid'], required: true },
      { key: 'remarks', label: 'Remarks', type: 'textarea', span: 2 }
    ]}
  />
);

export default PurchaseManagement;
