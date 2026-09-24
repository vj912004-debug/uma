/**
 * Attendance module — re-exports payroll helpers and opens the
 * Employee Salary Management hub on the Attendance tab.
 */
export {
  SHIFTS,
  STATUS_CODES,
  calculateTimes
} from '../utils/payroll';

import EmployeeSalaryManagement from './EmployeeSalaryManagement';

const Attendance = () => <EmployeeSalaryManagement defaultTab="attendance" />;

export default Attendance;
