import { type ReactNode, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Menu, Bell, User, LayoutDashboard, Settings, LogOut, MapPin, Search, X } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
    activeItem?: string;
}

const Layout = ({ children, activeItem = 'dashboard' }: LayoutProps) => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('driver_token');
        localStorage.removeItem('driver_user');
        localStorage.removeItem('current_college_id');
        localStorage.removeItem('orgName');
        navigate(`/${orgSlug}/login`);
    };

    const handleNavigation = (path: string) => {
        navigate(path);
        setSidebarOpen(false); // Close sidebar on mobile after navigation
    };

    const SidebarContent = () => (
        <>
            <div className="p-6 border-b border-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <Bus size={20} className="text-white" />
                        </div>
                        <span>Prasai<span className="text-blue-500">Track</span></span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                <SidebarItem
                    icon={<LayoutDashboard size={20} />}
                    label="Dashboard"
                    active={activeItem === 'dashboard'}
                    onClick={() => handleNavigation(`/${orgSlug}/dashboard`)}
                />
                <SidebarItem
                    icon={<Bus size={20} />}
                    label="Buses"
                    active={activeItem === 'buses'}
                    onClick={() => handleNavigation(`/${orgSlug}/buses`)}
                />
                <SidebarItem
                    icon={<User size={20} />}
                    label="Drivers & Staff"
                    active={activeItem === 'drivers'}
                    onClick={() => handleNavigation(`/${orgSlug}/drivers`)}
                />
                <SidebarItem
                    icon={<MapPin size={20} />}
                    label="Routes"
                    active={activeItem === 'routes'}
                    onClick={() => handleNavigation(`/${orgSlug}/routes`)}
                />
                <SidebarItem
                    icon={<Settings size={20} />}
                    label="Settings"
                    active={activeItem === 'settings'}
                    onClick={() => handleNavigation(`/${orgSlug}/settings`)}
                />
            </nav>

            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                        {user?.name?.charAt(0) || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
                        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors py-2"
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-64 bg-slate-900 text-white flex-col hidden lg:flex"
            >
                <SidebarContent />
            </motion.aside>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 bottom-0 w-[280px] bg-slate-900 text-white flex flex-col z-50 lg:hidden shadow-2xl"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800">College Portal</h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search buses, drivers..."
                                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                        </div>
                        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

const SidebarItem = ({ icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}>
        {icon}
        <span className="font-medium text-sm">{label}</span>
    </button>
);

export default Layout;
