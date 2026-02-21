import { type ReactNode, useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Bell, User, LogOut } from 'lucide-react';
import { LeftRailNav } from './dashboard/LeftRailNav';

interface LayoutProps {
    children: ReactNode;
    activeItem?: string;
}

const Layout = ({ children, activeItem = 'dashboard' }: LayoutProps) => {
    const navigate = useNavigate();
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('driver_token');
        localStorage.removeItem('driver_user');
        localStorage.removeItem('current_college_id');
        localStorage.removeItem('orgName');
        navigate(`/${orgSlug}/login`);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                    
                    <div className="flex items-center gap-4 relative" ref={dropdownRef}>
                        <button className="w-10 h-10 rounded-xl flex items-center justify-center text-dashboard-muted hover:bg-slate-50 transition-colors relative border border-transparent hover:border-dashboard-border">
                            <Bell size={20} />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-dashboard-primary" />
                        </button>
                        
                        <div 
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="w-10 h-10 rounded-xl bg-dashboard-primary text-white flex items-center justify-center font-bold cursor-pointer hover:bg-blue-500 shadow-md shadow-dashboard-primary/20 transition-colors"
                        >
                            {user?.name?.charAt(0) || <User size={18} />}
                        </div>

                        {/* Dropdown Menu */}
                        {dropdownOpen && (
                            <div className="absolute top-12 right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-dashboard-border overflow-hidden z-50">
                                <div className="px-4 py-3 border-b border-dashboard-border">
                                    <p className="text-sm font-semibold text-dashboard-text truncate">{user?.name || 'Admin User'}</p>
                                    <p className="text-xs text-dashboard-muted truncate">{user?.email || 'admin@example.com'}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-3 text-sm text-dashboard-warning hover:bg-dashboard-warning/10 flex items-center gap-2 transition-colors"
                                >
                                    <LogOut size={16} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        )}
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

export default Layout;
