import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import PrintPrefsModal from '../components/PrintPrefsModal';
import { getStoredPrintPrefs, setStoredPrintPrefs, normalizePrintPrefs } from './printPrefs';

/**
 * Promise-based print font/size picker shown before view/download.
 * Resolves with prefs, or null if cancelled.
 */
export const promptPrintPrefs = ({ mode = 'save', docType = '' } = {}) =>
  new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-print-prefs-modal', '1');
    document.body.appendChild(host);
    const root = createRoot(host);

    const finish = (value) => {
      root.unmount();
      host.remove();
      resolve(value);
    };

    root.render(
      createElement(PrintPrefsModal, {
        mode,
        docType,
        initial: getStoredPrintPrefs(),
        onCancel: () => finish(null),
        onConfirm: (prefs, saveDefault) => {
          const next = normalizePrintPrefs(prefs);
          if (saveDefault) setStoredPrintPrefs(next);
          finish(next);
        }
      })
    );
  });
