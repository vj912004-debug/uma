import React, { useEffect } from 'react';
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
import EWay from './modules/EWay';
import TaxInvoice from './modules/TaxInvoice';
import ProcessingSheet from './modules/ProcessingSheet';
import PartyDue from './modules/PartyDue';
import Payments from './modules/Payments';
import PaymentFollowUp from './modules/PaymentFollowUp';
import TaskManager from './modules/TaskManager';
import MasterSetup from './modules/MasterSetup';
import Reports from './modules/Reports';
import Quotations from './modules/Quotations';
import PurchaseOrders from './modules/PurchaseOrders';
import DebitNotes from './modules/DebitNotes';
import CreditNotes from './modules/CreditNotes';
import MonthlyBilling from './modules/MonthlyBilling';
import PurchaseManagement from './modules/PurchaseManagement';
import UtilityRecord from './modules/UtilityRecord';
import UtilityRecordList from './modules/UtilityRecordList';
import UtilityTempRecord from './modules/UtilityTempRecord';
import UtilityTempRecordList from './modules/UtilityTempRecordList';
import PmAirCompressor from './modules/PmAirCompressor';
import MarketingManagement from './modules/MarketingManagement';
import MarketingFollowUp from './modules/MarketingFollowUp';
import RecycleBin from './modules/RecycleBin';
import SystemLogs from './modules/SystemLogs';
import Attendance from './modules/Attendance';
import SalaryCalculation from './modules/SalaryCalculation';
import CompanyProfileSettings from './modules/CompanyProfileSettings';
import EmployeeManagement from './modules/EmployeeManagement';

const AppLayout = () => {
  useEffect(() => {
    const main = document.querySelector('.app-main');
    if (!main) return undefined;
    // Only jump to top when a form overlay opens — not on every checkbox/field re-render inside it.
    let hadOverlay = Boolean(main.querySelector('.page-form-overlay'));
    if (hadOverlay) main.scrollTop = 0;

    const observer = new MutationObserver(() => {
      const hasOverlay = Boolean(main.querySelector('.page-form-overlay'));
      if (hasOverlay && !hadOverlay) main.scrollTop = 0;
      hadOverlay = hasOverlay;
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
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
        <Route path="/eway" element={<EWay />} />
        <Route path="/eway-dc" element={<Navigate to="/eway" replace />} />
        <Route path="/tax-invoice" element={<TaxInvoice />} />
        <Route path="/eway-ti" element={<Navigate to="/eway" replace />} />
        <Route path="/processing-sheet" element={<ProcessingSheet />} />
        <Route path="/party-due" element={<ProtectedRoute><PartyDue /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
        <Route path="/payment-follow-up" element={<ProtectedRoute><PaymentFollowUp /></ProtectedRoute>} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/tasks" element={<TaskManager />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/debit-notes" element={<DebitNotes />} />
        <Route path="/credit-notes" element={<CreditNotes />} />
        <Route path="/monthly-billing" element={<MonthlyBilling />} />
        <Route path="/purchase-management" element={<PurchaseManagement />} />
        <Route path="/utility-record" element={<UtilityRecord />} />
        <Route path="/utility-record-list" element={<UtilityRecordList />} />
        <Route path="/utility-temp-record" element={<UtilityTempRecord />} />
        <Route path="/utility-temp-record-list" element={<UtilityTempRecordList />} />
        <Route path="/pm-air-compressor" element={<PmAirCompressor />} />
        <Route path="/marketing" element={<MarketingManagement />} />
        <Route path="/marketing-follow-up" element={<MarketingFollowUp />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/salary-calculation" element={<SalaryCalculation />} />
        <Route path="/settings/company-profile" element={<ProtectedRoute adminOnly><CompanyProfileSettings /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute adminOnly><EmployeeManagement /></ProtectedRoute>} />
        <Route path="/recycle-bin" element={<ProtectedRoute adminOnly><RecycleBin /></ProtectedRoute>} />
        <Route path="/system-logs" element={<ProtectedRoute adminOnly><SystemLogs /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
  );
};

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
