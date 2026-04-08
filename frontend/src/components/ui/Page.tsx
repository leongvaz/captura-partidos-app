import type { ReactNode } from 'react';

interface AppPageProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthClass: Record<NonNullable<AppPageProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
};

export function AppPage({ children, maxWidth = 'md' }: AppPageProps) {
  return (
    <div className={`p-4 mx-auto ${maxWidthClass[maxWidth]} space-y-4`}>{children}</div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface SectionCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function SectionCard({ title, description, children, footer }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
      {(title || description) && (
        <header>
          {title && <h2 className="text-lg font-semibold text-slate-100">{title}</h2>}
          {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
        </header>
      )}
      <div>{children}</div>
      {footer && <div className="pt-2 border-t border-slate-700 mt-1">{footer}</div>}
    </section>
  );
}

