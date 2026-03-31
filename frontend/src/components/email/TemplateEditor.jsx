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
    <div className="template-editor-shell">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || 'Enter email body template...'}
        className="template-editor"
        style={{ minHeight: '300px' }}
      />
      
      {/* Custom CSS for Quill Editor */}
      <style>{`
        .template-editor-shell {
          border: 1px solid var(--nx-border);
          border-radius: 16px;
          overflow: hidden;
          background: var(--nx-surface);
          box-shadow: var(--nx-shadow-xs);
        }

        .template-editor-shell .ql-container {
          font-family: var(--nx-font);
          font-size: 14px;
          background: var(--nx-surface);
          color: var(--nx-text);
        }
        
        .template-editor-shell .ql-editor {
          min-height: 320px;
          max-height: 520px;
          overflow-y: auto;
          color: var(--nx-text);
          line-height: 1.65;
        }
        
        .template-editor-shell .ql-editor.ql-blank::before {
          color: var(--nx-muted);
          font-style: normal;
        }
        
        .template-editor-shell .ql-toolbar {
          background: var(--nx-bg);
          border-bottom: 1px solid var(--nx-border);
          border-top: none;
          border-left: none;
          border-right: none;
          padding: 10px 12px;
        }
        
        .template-editor-shell .ql-container {
          border: none;
        }
        
        .template-editor-shell .ql-toolbar .ql-stroke {
          stroke: var(--nx-text-secondary);
        }
        
        .template-editor-shell .ql-toolbar .ql-fill {
          fill: var(--nx-text-secondary);
        }
        
        .template-editor-shell .ql-toolbar .ql-picker-label {
          color: var(--nx-text-secondary);
        }
        
        .template-editor-shell .ql-toolbar button:hover,
        .template-editor-shell .ql-toolbar button:focus,
        .template-editor-shell .ql-toolbar button.ql-active {
          color: var(--nx-primary);
        }
        
        .template-editor-shell .ql-toolbar button:hover .ql-stroke,
        .template-editor-shell .ql-toolbar button:focus .ql-stroke,
        .template-editor-shell .ql-toolbar button.ql-active .ql-stroke {
          stroke: var(--nx-primary);
        }
        
        .template-editor-shell .ql-toolbar button:hover .ql-fill,
        .template-editor-shell .ql-toolbar button:focus .ql-fill,
        .template-editor-shell .ql-toolbar button.ql-active .ql-fill {
          fill: var(--nx-primary);
        }
        
        .template-editor-shell .ql-snow .ql-picker.ql-expanded .ql-picker-label,
        .template-editor-shell .ql-snow .ql-picker.ql-expanded .ql-picker-options {
          border-color: var(--nx-primary);
          color: var(--nx-text);
          background: var(--nx-surface);
        }
        
        .template-editor-shell .ql-snow .ql-picker-options {
          background: var(--nx-surface);
          border-color: var(--nx-border);
          box-shadow: var(--nx-shadow-md);
        }
        
        /* Custom scrollbar for editor */
        .template-editor-shell .ql-editor::-webkit-scrollbar {
          width: 8px;
        }
        
        .template-editor-shell .ql-editor::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .template-editor-shell .ql-editor::-webkit-scrollbar-thumb {
          background: var(--nx-scrollbar-thumb);
          border-radius: 4px;
        }
        
        .template-editor-shell .ql-editor::-webkit-scrollbar-thumb:hover {
          background: var(--nx-scrollbar-thumb-hover);
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
