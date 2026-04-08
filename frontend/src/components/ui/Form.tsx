import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface FormFieldProps {
  label: string;
  children: ReactNode;
  helperText?: string;
  error?: string;
}

export function FormField({ label, children, helperText, error }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
}

const inputBaseClasses =
  'w-full rounded-lg bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`${inputBaseClasses} ${className}`} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <select {...rest} className={`${inputBaseClasses} ${className}`}>
      {children}
    </select>
  );
}

