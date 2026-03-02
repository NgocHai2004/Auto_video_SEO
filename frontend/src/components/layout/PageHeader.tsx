import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
}

export default function PageHeader({ icon, title, subtitle }: PageHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-10 w-10 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center text-violet-400">
        {icon}
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-100">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
