import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './modules/Dashboard';
import Parties from './modules/Parties';
import MaterialReceipt from './modules/MaterialReceipt';
import ProductionPlanning from './modules/ProductionPlanning';
import UnderProcess from './modules/UnderProcess';
import InvoicesPI from './modules/InvoicesPI';
import BPR from './modules/BPR';
import PSD from './modules/PSD';
import PackingList from './modules/PackingList';
import DeliveryChallan from './modules/DeliveryChallan';
import EWayDC from './modules/EWayDC';
import TaxInvoice from './modules/TaxInvoice';
import EWayTI from './modules/EWayTI';
import ProcessingSheet from './modules/ProcessingSheet';
import PartyDue from './modules/PartyDue';
import Payments from './modules/Payments';
import TaskManager from './modules/TaskManager';
import MasterSetup from './modules/MasterSetup';
import Reports from './modules/Reports';
import Quotations from './modules/Quotations';
import PurchaseOrders from './modules/PurchaseOrders';
import DebitNotes from './modules/DebitNotes';
import CreditNotes from './modules/CreditNotes';
import RecycleBin from './modules/RecycleBin';
import SystemLogs from './modules/SystemLogs';
import Attendance from './modules/Attendance';
import CompanyProfileSettings from './modules/CompanyProfileSettings';

const AppLayout = () => (
  <div className="app-layout">
    <Sidebar />
    <main className="app-main">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/master" element={<MasterSetup />} />
        <Route path="/parties" element={<Parties />} />
        <Route path="/material-receipt" element={<MaterialReceipt />} />
        <Route path="/production-planning" element={<ProductionPlanning />} />
        <Route path="/under-process" element={<UnderProcess />} />
        <Route path="/invoices-pi" element={<InvoicesPI />} />
        <Route path="/bpr" element={<BPR />} />
        <Route path="/psd" element={<PSD />} />
        <Route path="/packing-list" element={<PackingList />} />
        <Route path="/dc" element={<DeliveryChallan />} />
        <Route path="/eway-dc" element={<EWayDC />} />
        <Route path="/tax-invoice" element={<TaxInvoice />} />
        <Route path="/eway-ti" element={<EWayTI />} />
        <Route path="/processing-sheet" element={<ProcessingSheet />} />
        <Route path="/party-due" element={<ProtectedRoute adminOnly><PartyDue /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute adminOnly><Payments /></ProtectedRoute>} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/tasks" element={<TaskManager />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/debit-notes" element={<DebitNotes />} />
        <Route path="/credit-notes" element={<CreditNotes />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/settings/company-profile" element={<ProtectedRoute adminOnly><CompanyProfileSettings /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute adminOnly><EmployeeManagement /></ProtectedRoute>} />
        <Route path="/recycle-bin" element={<ProtectedRoute adminOnly><RecycleBin /></ProtectedRoute>} />
        <Route path="/system-logs" element={<ProtectedRoute adminOnly><SystemLogs /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
);

function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </Router>
      </AuthProvider>
    </AppProvider>
  );
}

export default App;
