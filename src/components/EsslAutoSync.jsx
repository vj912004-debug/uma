import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { applyEsslSyncToState, getBiometricDevices, recordSyncFailure } from '../utils/payroll';

/**
 * Pulls punches from the eSSL device in the background for approved employees.
 * Each run asks for every punch since the last successful sync, so time the software
 * was closed, offline, or the device was unreachable is caught up on the next success.
 */
const EsslAutoSync = () => {
  const { data, setData } = useAppContext();
  const autoSync = data.esslSettings?.autoSync !== false;
  const minutes = Math.max(1, Number(data.esslSettings?.autoSyncMinutes) || 5);

  useEffect(() => {
    if (!autoSync) return undefined;
    const run = () => setData((prev) => {
      if (prev.esslSettings?.autoSync === false) return prev;
      const devices = getBiometricDevices(prev);
      if (!devices.length || (!Array.isArray(prev.biometricDevices) && !prev.esslSettings?.connected && !prev.esslSettings?.lastSync)) {
        return prev;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return recordSyncFailure(prev, devices[0].id, 'Software offline (no network)');
      }
      if (!devices.some((d) => d.status === 'Online')) {
        return recordSyncFailure(prev, devices[0].id, 'Device offline / unreachable');
      }
      return applyEsslSyncToState(prev).next;
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    run();
    const timer = setInterval(run, minutes * 60 * 1000);
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [autoSync, minutes, setData]);

  return null;
};

export default EsslAutoSync;
