import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
    width?: string | number;
    height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
    className = '', 
    variant = 'rect', 
    width, 
    height 
}) => {
    const baseClass = "animate-pulse bg-slate-200";
    const variantClass = variant === 'circle' ? 'rounded-full' : 
                         variant === 'text' ? 'rounded h-4 w-full' : 'rounded-xl';
    
    return (
        <div 
            className={`${baseClass} ${variantClass} ${className}`}
            style={{ width, height }}
        />
    );
};

export const DashboardSkeleton = () => (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <Skeleton key={i} height={80} />
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
                <Skeleton height={450} />
            </div>
            <div className="lg:col-span-4">
                <Skeleton height={450} />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
                <Skeleton key={i} height={160} />
            ))}
        </div>
    </div>
);

export default Skeleton;
