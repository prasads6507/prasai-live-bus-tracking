import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiMenu, HiX } from 'react-icons/hi';

const Layout: React.FC = () => {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/colleges', label: 'Colleges' },
        { path: '/college-admins', label: 'Admins' },
        { path: '/analytics', label: 'Analytics' },
    ];

    const handleNavigation = (path: string) => {
        navigate(path);
        setSidebarOpen(false);
    };

    const SidebarContent = () => (
        <>
            <div className="p-6 bg-slate-900 border-b border-slate-700 flex flex-col items-center">
                <div className="flex items-center justify-between w-full lg:justify-center">
                    <div className="flex flex-col items-center">
                        <img src="/logo.png" alt="Logo" className="w-12 h-12 mb-3" />
                        <span className="text-2xl font-bold font-serif italic text-blue-400">Prasai</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest text-center">Live Bus Tracking</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 text-slate-400 hover:text-white absolute top-4 right-4"
                    >
                        <HiX size={24} />
                    </button>
                </div>
            </div>
            <nav className="flex-1 p-4 space-y-2 mt-4">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => handleNavigation(item.path)}
                        className={`block w-full text-left py-3 px-4 rounded-lg transition-all duration-200 font-medium ${location.pathname === item.path
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-700 bg-slate-900">
                <div className="mb-4 text-xs text-slate-400 font-medium px-2">
                    Logged in as: <br />
                    <span className="text-slate-100 text-sm">{user?.name}</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full bg-red-600/20 text-red-400 border border-red-600/30 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-600 hover:text-white transition-all duration-300"
                >
                    Sign Out
                </button>
                <div className="mt-6 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        © 2026 Prasai
                    </p>
                    <p className="text-[8px] text-slate-600 uppercase tracking-tighter mt-1">
                        Live Bus Tracking. All rights reserved.
                    </p>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="w-64 bg-slate-800 text-white flex-col shadow-xl z-20 hidden lg:flex">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={`fixed left-0 top-0 bottom-0 w-[280px] bg-slate-800 text-white flex flex-col z-50 lg:hidden shadow-2xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <SidebarContent />
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Horizontal Nav Bar */}
                <header className="h-14 sm:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 z-10 shadow-sm">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                            <HiMenu size={24} />
                        </button>
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                            {navItems.find(item => item.path === location.pathname)?.label || 'Bannu Bus Track'}
                        </h2>
                    </div>
                    <div className="flex items-center space-x-3 sm:space-x-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-bold text-gray-700">{user?.name}</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">System Administrator</span>
                        </div>
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-blue-200 text-sm sm:text-base">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-0">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
