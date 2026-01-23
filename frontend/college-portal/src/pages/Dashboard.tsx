import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, MapPin, Navigation, Settings, User } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase'; // Import Firestore instance
import { getBuses, getRoutes, validateSlug } from '../services/api';
import Layout from '../components/Layout';
import MapComponent from '../components/MapComponent';

const Dashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [buses, setBuses] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);


    // Initial Data Fetch & Validation
    useEffect(() => {
        const fetchInitialData = async () => {
            // 1. Verify User & Org
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                navigate(`/${orgSlug}/login`);
                return;
            }

            try {
                // 2. Fetch Org Details if name not set (optional optimization)
                if (orgSlug) {
                    const orgData = await validateSlug(orgSlug);
                    // Ensure context is set for API calls (important for Super Admin)
                    localStorage.setItem('current_college_id', orgData.collegeId);
                }

                // 3. Fetch Data in Parallel
                const [busData, routeData] = await Promise.all([
                    getBuses(),
                    getRoutes()
                ]);

                // Ensure data arrays
                setBuses(Array.isArray(busData) ? busData : busData.data || []);
                setRoutes(Array.isArray(routeData) ? routeData : routeData.data || []);

            } catch (err) {
                console.error("Dashboard Fetch Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [orgSlug, navigate]);

    // Real-time Bus Updates
    useEffect(() => {
        const collegeId = localStorage.getItem('current_college_id');
        if (!collegeId) return;

        // Listen for real-time updates to 'buses' collection
        // Assuming buses have a 'collegeId' field to filter by
        // Note: You needs to ensure your Firestore rules allow this query
        const q = query(collection(db, 'buses'), where('collegeId', '==', collegeId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatedBuses = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));

            // Only update buses if we have data, otherwise fallback to API (or just set it)
            // Ideally this replaces api.getBuses() entirely after initial load
            if (updatedBuses.length > 0) {
                setBuses(updatedBuses);
            }
        }, (error) => {
            console.error("Real-time Bus Sub Error:", error);
        });

        return () => unsubscribe();
    }, [orgSlug]); // Re-subscribe if org changes (though likely won't without page reload)

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <Layout activeItem="dashboard">
            <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Total Routes"
                            value={routes.length.toString()}
                            total={routes.length.toString()}
                            icon={<MapPin className="text-purple-600" size={24} />}
                            color="bg-purple-50"
                        />
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

                    {/* Map Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[500px]">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <MapPin size={20} className="text-blue-600" />
                                Live Fleet Tracking
                            </h3>
                            <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                LIVE
                            </div>
                        </div>
                        <MapComponent buses={buses} />
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
        </Layout>
    );
};

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
