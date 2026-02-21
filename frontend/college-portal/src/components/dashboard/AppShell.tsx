import type { ReactNode } from 'react';
import { LeftRailNav } from './LeftRailNav';
import { Search, Bell, User } from 'lucide-react';

interface AppShellProps {
    children: ReactNode;
    activeItem: string;
}

export const AppShell = ({ children, activeItem }: AppShellProps) => {
    return (
        <div className="flex h-screen bg-dashboard-bg overflow-hidden font-sans text-dashboard-text">
            <LeftRailNav activeItem={activeItem} />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Topbar */}
                <header className="h-16 bg-dashboard-surface border-b border-dashboard-border shadow-soft flex items-center justify-between px-6 z-40 shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="font-bold text-xl tracking-tight lg:hidden">
                            Prasai<span className="text-dashboard-primary">Track</span>
                        </div>
                        
                        {/* Search Input */}
                        <div className="flex-1 max-w-xl hidden md:block">
                            <div className="relative flex items-center w-full h-10 rounded-xl bg-[#F8FAFC] border border-dashboard-border overflow-hidden focus-within:border-dashboard-primary/50 focus-within:ring-2 focus-within:ring-dashboard-primary/20 transition-all">
                                <Search className="absolute left-3 text-dashboard-muted" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search by bus no, plate..." 
                                    className="w-full h-full bg-transparent pl-10 pr-4 outline-none text-[13px] font-medium placeholder:text-dashboard-muted text-dashboard-text"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 rounded-xl flex items-center justify-center text-dashboard-muted hover:bg-slate-50 transition-colors relative border border-transparent hover:border-dashboard-border">
                            <Bell size={20} />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-dashboard-primary" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-dashboard-primary text-white flex items-center justify-center font-bold cursor-pointer hover:bg-blue-500 shadow-md shadow-dashboard-primary/20 transition-colors">
                            <User size={18} />
                        </div>
                    </div>
                </header>
                
                {/* Main page content area */}
                <main className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-6 relative z-0">
                    <div className="max-w-[1600px] h-full mx-auto flex flex-col">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
