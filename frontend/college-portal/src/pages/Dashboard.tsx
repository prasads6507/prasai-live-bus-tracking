import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bus, MapPin, Search, Menu, Bell, User, LayoutDashboard, Settings, LogOut, Navigation } from 'lucide-react';
import { getBuses, validateSlug } from '../services/api';

const Dashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [buses, setBuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [orgName, setOrgName] = useState('College Admin');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            // 1. Verify User & Org
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                navigate(`/${orgSlug}/login`);
                return;
            }
            setUser(JSON.parse(storedUser));

            try {
                // 2. Fetch Org Details if name not set (optional optimization)
                if (orgSlug) {
                    const orgData = await validateSlug(orgSlug);
                    setOrgName(orgData.collegeName);
                }

                // 3. Fetch Buses
                const busData = await getBuses();
                // Ensure busData is an array (API might wrap it)
                setBuses(Array.isArray(busData) ? busData : busData.data || []);

            } catch (err) {
                console.error("Dashboard Fetch Error:", err);
                // Optionally handle auth errors with redirect
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [orgSlug, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate(`/${orgSlug}/login`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-64 bg-slate-900 text-white flex flex-col hidden lg:flex"
            >
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <Bus size={20} className="text-white" />
                        </div>
                        <span>Prasai<span className="text-blue-500">Track</span></span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
                    <SidebarItem icon={<Bus size={20} />} label="Fleet Management" />
                    <SidebarItem icon={<User size={20} />} label="Drivers & Staff" />
                    <SidebarItem icon={<MapPin size={20} />} label="Routes" />
                    <SidebarItem icon={<Settings size={20} />} label="Settings" />
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
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10">
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800">{orgName}</h1>
                    </div>
                    <div className="flex items-center gap-4">
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

                {/* Dashboard Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-7xl mx-auto space-y-6">

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard
                                title="Active Buses"
                                value={buses.filter(b => b.status === 'ACTIVE').length.toString()}
                                total={buses.length.toString()}
                                icon={<Bus className="text-blue-600" size={24} />}
                                color="bg-blue-50"
                            />
                            <StatCard
                                title="On Route"
                                value={buses.filter(b => b.status === 'ON_ROUTE').length.toString()}
                                total={buses.length.toString()}
                                icon={<Navigation className="text-green-600" size={24} />}
                                color="bg-green-50"
                            />
                            <StatCard
                                title="Maintenance"
                                value={buses.filter(b => b.status === 'MAINTENANCE').length.toString()}
                                total={buses.length.toString()}
                                icon={<Settings className="text-orange-600" size={24} />}
                                color="bg-orange-50"
                            />
                        </div>

                        {/* Map Section (Placeholder) */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-96 relative group">
                            <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <MapPin className="text-slate-400" size={32} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-600">Live Map Integration</h3>
                                    <p className="text-slate-400 mt-1">Real-time bus tracking map will appear here</p>
                                </div>
                            </div>
                            {/* Overlay for "View Full Map" or similar interactions */}
                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur shadow-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200">
                                Live Updates
                            </div>
                        </div>

                        {/* Bus List */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-800">Fleet Status</h2>
                                <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">View All</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {buses.length > 0 ? (
                                    buses.map((bus) => (
                                        <BusCard key={bus._id} bus={bus} />
                                    ))
                                ) : (
                                    <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                                        <Bus className="mx-auto text-slate-300 mb-3" size={48} />
                                        <p className="text-slate-500 font-medium">No buses found in the fleet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

// Sub-components for cleaner code
const SidebarItem = ({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) => (
    <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}>
        {icon}
        <span className="font-medium text-sm">{label}</span>
    </button>
);

const StatCard = ({ title, value, total, icon, color }: any) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-start justify-between">
        <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
                <span className="text-sm text-slate-400 font-medium">/ {total}</span>
            </div>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
            {icon}
        </div>
    </div>
);

const BusCard = ({ bus }: { bus: any }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    {bus.busNumber?.slice(0, 2) || 'BS'}
                </div>
                <div>
                    <h4 className="font-bold text-slate-800">{bus.busNumber}</h4>
                    <p className="text-xs text-slate-500">{bus.capacity || 0} Seats</p>
                </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${bus.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    bus.status === 'MAINTENANCE' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                }`}>
                {bus.status || 'Unknown'}
            </span>
        </div>
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <User size={14} className="text-slate-400" />
                <span>{bus.driver?.name || 'No Driver Assigned'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={14} className="text-slate-400" />
                <span className="truncate">{bus.lastLocation?.address || 'Location Unavailable'}</span>
            </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Last updated: Just now</span>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Track Live
            </button>
        </div>
    </div>
);

export default Dashboard;
