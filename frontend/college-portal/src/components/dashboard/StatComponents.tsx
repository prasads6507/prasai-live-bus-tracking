import type { ReactNode } from 'react';

interface ChipStatProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    colorClass: string;
    bgClass: string;
}

export const ChipStat = ({ title, value, icon, colorClass, bgClass }: ChipStatProps) => (
    <div className="bg-dashboard-surface rounded-[16px] p-4 flex items-center gap-4 shadow-sm border border-dashboard-border hover:shadow-soft transition-all min-w-[200px] flex-1 cursor-default">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgClass} ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-[14px] font-medium text-dashboard-secondary mb-1">{title}</p>
            <h3 className="text-[24px] font-black text-dashboard-text leading-none">{value}</h3>
        </div>
    </div>
);

export const KpiStrip = ({ children }: { children: ReactNode }) => (
    <div className="flex flex-wrap items-center gap-4 w-full shrink-0">
        {children}
    </div>
);
