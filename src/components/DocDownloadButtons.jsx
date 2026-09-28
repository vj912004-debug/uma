import { FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { downloadDocumentExcel, downloadDocumentPdf, downloadDocumentWord } from '../utils/documentFileExport';

const iconBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  display: 'inline-flex',
  alignItems: 'center'
};

/**
 * Excel, PDF, and Word downloads for one document.
 * `getData` runs on click so the row can pass the print-ready payload.
 * `onPdf` overrides the formatted PDF when a module already has its own PDF export.
 */
const DocDownloadButtons = ({
  docType,
  getData,
  title,
  size = 14,
  variant = 'icons',
  onPdf,
  onDone
}) => {
  const load = () => (typeof getData === 'function' ? getData() : getData);
  const finish = (fn) => () => {
    fn();
    onDone?.();
  };

  const excel = finish(() => downloadDocumentExcel(docType, load(), title));
  const pdf = finish(() => (onPdf ? onPdf(load()) : downloadDocumentPdf(docType, load(), title)));
  const word = finish(() => downloadDocumentWord(docType, load(), title));

  if (variant === 'menu') {
    return (
      <>
        <button type="button" className="context-menu-item" onClick={excel}>
          <FileSpreadsheet size={size} /> Download Excel
        </button>
        <button type="button" className="context-menu-item" onClick={pdf}>
          <FileText size={size} /> Download PDF
        </button>
        <button type="button" className="context-menu-item" onClick={word}>
          <FileDown size={size} /> Download Word
        </button>
      </>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: '0.15rem', alignItems: 'center' }}>
      <button type="button" title="Download Excel" onClick={excel} style={iconBtn}>
        <FileSpreadsheet size={size} color="#5b1c85" />
      </button>
      <button type="button" title="Download PDF" onClick={pdf} style={iconBtn}>
        <FileText size={size} color="#ef4444" />
      </button>
      <button type="button" title="Download Word" onClick={word} style={iconBtn}>
        <FileDown size={size} color="#3b82f6" />
      </button>
    </span>
  );
};

export default DocDownloadButtons;
