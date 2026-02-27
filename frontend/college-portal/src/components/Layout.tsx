import { type ReactNode, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Menu, User, LayoutDashboard, Settings, LogOut, MapPin, X, Clock, UserCog, ClipboardList } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
    activeItem?: string;
}

const Layout = ({ children, activeItem = 'dashboard' }: LayoutProps) => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Role check for admin-only features
    const canManageAdmins = user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER';

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
            <div className="p-8 pb-10">
                <div className="flex items-center justify-between">
                    <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 font-black text-2xl tracking-tighter"
                    >
                        <div className="bg-gradient-to-tr from-blue-600 to-blue-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                            <Bus size={22} className="text-white" />
                        </div>
                        <span className="text-white">Prasai<span className="text-blue-500">Track</span></span>
                    </motion.div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 text-slate-500 hover:text-white transition-colors"
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
                    icon={<User size={20} />}
                    label="Students"
                    active={activeItem === 'students'}
                    onClick={() => handleNavigation(`/${orgSlug}/students`)}
                />
                <SidebarItem
                    icon={<MapPin size={20} />}
                    label="Routes"
                    active={activeItem === 'routes'}
                    onClick={() => handleNavigation(`/${orgSlug}/routes`)}
                />
                <SidebarItem
                    icon={<ClipboardList size={20} />}
                    label="Attendance"
                    active={activeItem === 'attendance'}
                    onClick={() => handleNavigation(`/${orgSlug}/attendance`)}
                />
                <SidebarItem
                    icon={<Clock size={20} />}
                    label="Trip History"
                    active={activeItem === 'trip-history'}
                    onClick={() => handleNavigation(`/${orgSlug}/trip-history`)}
                />
                {canManageAdmins && (
                    <SidebarItem
                        icon={<UserCog size={20} />}
                        label="Manage Admins"
                        active={activeItem === 'admins'}
                        onClick={() => handleNavigation(`/${orgSlug}/admins`)}
                    />
                )}
                <SidebarItem
                    icon={<Settings size={20} />}
                    label="Settings"
                    active={activeItem === 'settings'}
                    onClick={() => handleNavigation(`/${orgSlug}/settings`)}
                />
            </nav>

            <div className="p-6 mt-auto">
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-inner">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate leading-tight">{user?.name || 'Admin'}</p>
                            <p className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-widest mt-0.5">{user?.role?.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-400 transition-all py-2.5 rounded-lg hover:bg-red-400/10 border border-transparent hover:border-red-400/20"
                    >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-72 bg-[#0B0F19] text-white flex-col hidden lg:flex border-r border-slate-800/50"
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
                            initial={{ x: -300 }}
                            animate={{ x: 0 }}
                            exit={{ x: -300 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed left-0 top-0 bottom-0 w-[300px] bg-[#0B0F19] text-white flex flex-col z-50 lg:hidden shadow-2xl"
                        >
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="h-16 h-18 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 sm:px-8 z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <Menu size={22} />
                        </button>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Organization</p>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                {localStorage.getItem('orgName') || 'College Portal'}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex flex-col items-end mr-2">
                             <p className="text-xs font-bold text-slate-900">{user?.name}</p>
                             <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Administrator</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold overflow-hidden">
                             {user?.name?.charAt(0) || 'A'}
                        </div>
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
    <motion.button 
        whileTap={{ scale: 0.98 }}
        onClick={onClick} 
        className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 relative group ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
        }`}
    >
        <span className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`}>{icon}</span>
        <span className={`font-bold text-sm tracking-tight ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>{label}</span>
        
        {active && (
            <motion.div 
                layoutId="sidebar-active"
                className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            />
        )}
    </motion.button>
);

export default Layout;
