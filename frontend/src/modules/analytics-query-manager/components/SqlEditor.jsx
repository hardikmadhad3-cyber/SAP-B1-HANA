import React, { Suspense, lazy } from 'react';

// Load monaco-editor itself alongside @monaco-editor/react and point the
// loader at that local bundle - by default @monaco-editor/react fetches
// monaco from the jsdelivr CDN at runtime, which this on-prem SAP portal
// cannot rely on. Both imports are dynamic so they only ever land in the
// lazy vendor-monaco chunk (see craco.config.js), never the main bundle.
const MonacoEditor = lazy(async () => {
  const [{ default: Editor, loader }, monaco] = await Promise.all([
    import('@monaco-editor/react'),
    import('monaco-editor'),
  ]);
  loader.config({ monaco });
  return { default: Editor };
});

const SqlEditor = ({ value, onChange, height = 260, readOnly = false }) => (
  <div className="aqm-sql-editor">
    <Suspense fallback={<div className="aqm-sql-editor__loading">Loading SQL editor...</div>}>
      <MonacoEditor
        height={height}
        defaultLanguage="sql"
        theme="light"
        value={value}
        onChange={(nextValue) => onChange(nextValue || '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
        }}
      />
    </Suspense>
  </div>
);

export default SqlEditor;
