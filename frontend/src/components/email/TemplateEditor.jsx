// ============================================
// TEMPLATE EDITOR COMPONENT
// Rich text editor for email templates
// FILE: frontend/src/components/email/TemplateEditor.jsx
// ============================================

import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/** True for HTML snippets (quick blocks); false for merge tags like {{name}} */
export function isHtmlFragment(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trimStart();
  return t.startsWith('<') && /^<[a-z!/]/i.test(t);
}

function insertIntoQuill(editor, text) {
  if (!editor || text == null) return;
  const index = editor.getSelection()?.index ?? editor.getLength();
  if (isHtmlFragment(text)) {
    editor.clipboard.dangerouslyPasteHTML(index, text);
  } else {
    editor.insertText(index, text, 'user');
    editor.setSelection(index + text.length);
  }
}

const TemplateEditor = forwardRef(({ value, onChange, placeholder }, ref) => {
  const quillRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getEditor: () => quillRef.current?.getEditor?.(),
    insertAtCursor: (text) => {
      const editor = quillRef.current?.getEditor();
      insertIntoQuill(editor, text);
    },
  }));

  // Toolbar configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false
    }
  };

  // Formats allowed
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'align',
    'link'
  ];

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      backgroundColor: '#ffffff'
    }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || 'Enter email body template...'}
        style={{
          minHeight: '300px',
          backgroundColor: '#ffffff'
        }}
      />
      
      {/* Custom CSS for Quill Editor */}
      <style>{`
        .ql-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          font-size: 14px;
        }
        
        .ql-editor {
          min-height: 300px;
          max-height: 500px;
          overflow-y: auto;
        }
        
        .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
        }
        
        .ql-toolbar {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          border-top: none;
          border-left: none;
          border-right: none;
        }
        
        .ql-container {
          border: none;
        }
        
        .ql-toolbar .ql-stroke {
          stroke: #4b5563;
        }
        
        .ql-toolbar .ql-fill {
          fill: #4b5563;
        }
        
        .ql-toolbar .ql-picker-label {
          color: #4b5563;
        }
        
        .ql-toolbar button:hover,
        .ql-toolbar button:focus,
        .ql-toolbar button.ql-active {
          color: #3b82f6;
        }
        
        .ql-toolbar button:hover .ql-stroke,
        .ql-toolbar button:focus .ql-stroke,
        .ql-toolbar button.ql-active .ql-stroke {
          stroke: #3b82f6;
        }
        
        .ql-toolbar button:hover .ql-fill,
        .ql-toolbar button:focus .ql-fill,
        .ql-toolbar button.ql-active .ql-fill {
          fill: #3b82f6;
        }
        
        .ql-snow .ql-picker.ql-expanded .ql-picker-label {
          border-color: #3b82f6;
        }
        
        .ql-snow .ql-picker.ql-expanded .ql-picker-options {
          border-color: #3b82f6;
        }
        
        /* Custom scrollbar for editor */
        .ql-editor::-webkit-scrollbar {
          width: 8px;
        }
        
        .ql-editor::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .ql-editor::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        
        .ql-editor::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
});

TemplateEditor.displayName = 'TemplateEditor';

export { TemplateEditor as default };

/** Parent ref receives insertVariable(text) for merge tags / HTML snippets */
export const TemplateEditorWithRef = forwardRef((props, ref) => {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => ({
    insertVariable: (variable) => {
      const editor = innerRef.current?.getEditor?.();
      insertIntoQuill(editor, variable);
    },
  }));
  return <TemplateEditor {...props} ref={innerRef} />;
});
TemplateEditorWithRef.displayName = 'TemplateEditorWithRef';
