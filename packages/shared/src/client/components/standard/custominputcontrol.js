import React from 'react';

export function CustomInputControl({ label, children }) {
  return (
    <div className="space-y-3">
      {label ? (
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}
