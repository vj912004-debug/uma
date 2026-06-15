import React, { useRef, useEffect } from 'react';
import { Bold, Italic, List } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder = 'Enter description...' }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command) => {
    document.execCommand(command, false, null);
    editorRef.current?.focus();
    onChange(editorRef.current?.innerHTML || '');
  };

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.25rem', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--input-bg)' }}>
        <button type="button" className="btn" style={{ padding: '0.35rem' }} onClick={() => exec('bold')} title="Bold"><Bold size={14} /></button>
        <button type="button" className="btn" style={{ padding: '0.35rem' }} onClick={() => exec('italic')} title="Italic"><Italic size={14} /></button>
        <button type="button" className="btn" style={{ padding: '0.35rem' }} onClick={() => exec('insertUnorderedList')} title="Bullet list"><List size={14} /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="input-field"
        style={{ minHeight: '120px', border: 'none', borderRadius: 0, outline: 'none' }}
        data-placeholder={placeholder}
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        suppressContentEditableWarning
      />
    </div>
  );
};

export default RichTextEditor;
