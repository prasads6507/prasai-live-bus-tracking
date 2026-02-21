import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, MapPin, Activity } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getBuses, getRoutes, validateSlug } from '../services/api';

import { AppShell } from '../components/dashboard/AppShell';
import { ChipStat, KpiStrip } from '../components/dashboard/StatComponents';
import { RoutePanelOverlay } from '../components/dashboard/RoutePanelOverlay';
import MapLibreMap from '../components/MapLibreMap';

const isLiveBus = (bus: any) => {
    if (bus.status !== 'ON_ROUTE') return false;
    if (!bus.activeTripId) return false;
    if (!bus.lastLocationUpdate) return false;
    try {
        const lastUpdate = bus.lastLocationUpdate.toDate ? bus.lastLocationUpdate.toDate() : new Date(bus.lastLocationUpdate);
        const diffMinutes = (new Date().getTime() - lastUpdate.getTime()) / 60000;
        return diffMinutes < 5;
    } catch (e) { return false; }
};

const Dashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [buses, setBuses] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentCollegeId, setCurrentCollegeId] = useState<string | null>(localStorage.getItem('current_college_id'));
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            const storedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            if (!storedUser || !token) {
                navigate(`/${orgSlug}/login`);
                return;
            }

            try {
                if (orgSlug) {
                    const orgData = await validateSlug(orgSlug);
                    localStorage.setItem('current_college_id', orgData.collegeId);
                    setCurrentCollegeId(orgData.collegeId);
                }

                const [busData, routeData] = await Promise.all([getBuses(), getRoutes()]);
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

    useEffect(() => {
        if (!currentCollegeId) return;

        const qBuses = query(collection(db, 'buses'), where('collegeId', '==', currentCollegeId));
        const unsubscribeBuses = onSnapshot(qBuses, (snapshot) => {
            const updatedBuses = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
            setBuses(updatedBuses);
        });

        const qRoutes = query(collection(db, 'routes'), where('collegeId', '==', currentCollegeId));
        const unsubscribeRoutes = onSnapshot(qRoutes, (snapshot) => {
            const updatedRoutes = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
            setRoutes(updatedRoutes);
        });

        return () => {
            unsubscribeBuses();
            unsubscribeRoutes();
        };
    }, [currentCollegeId]);

    const activeBusesCount = buses.filter(isLiveBus).length;
    const totalBusesCount = buses.length;
    const routesCount = routes.length;

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-dashboard-bg">
                <div className="w-10 h-10 border-4 border-dashboard-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <AppShell activeItem="dashboard">
            {/* KPI Strip */}
            <div className="mb-4 shrink-0">
                <KpiStrip>
                    <ChipStat 
                        title="Total Buses" 
                        value={totalBusesCount} 
                        icon={<Bus size={24} />} 
                        colorClass="text-dashboard-primary" 
                        bgClass="bg-dashboard-primary/10" 
                    />
                    <ChipStat 
                        title="Active / Live Tracking" 
                        value={activeBusesCount} 
                        icon={<Activity size={24} />} 
                        colorClass="text-dashboard-success" 
                        bgClass="bg-dashboard-success/10" 
                    />
                    <ChipStat 
                        title="Active Routes" 
                        value={routesCount} 
                        icon={<MapPin size={24} />} 
                        colorClass="text-dashboard-warning" 
                        bgClass="bg-dashboard-warning/10" 
                    />
                </KpiStrip>
            </div>

            {/* Main Map Workspace */}
            <div className="flex-1 relative rounded-2xl overflow-hidden border border-dashboard-border shadow-soft bg-dashboard-surface isolate">
                <RoutePanelOverlay 
                    routes={routes} 
                    buses={buses} 
                    selectedRouteId={selectedRouteId}
                    onSelectRoute={(id) => {
                        setSelectedRouteId(id);
                        if (id) {
                            const relatedBus = buses.find(b => b.routeId === id || b.routeName === routes.find(r => r._id === id)?.name);
                            if (relatedBus) setSelectedBusId(relatedBus._id);
                            else setSelectedBusId(null);
                        } else {
                            setSelectedBusId(null);
                        }
                    }}
                />
                
                {/* Map integration - Notice we pass routes & selectedRouteId now */}
                <MapLibreMap
                    buses={buses.map(b => isLiveBus(b) ? b : (b.status === 'ON_ROUTE' ? { ...b, status: 'Active (Offline)' } : b))}
                    selectedBusId={selectedBusId}
                    routes={routes}
                    selectedRouteId={selectedRouteId}
                    followBus={false} // Command Center view usually doesn't aggressively follow unless explicitly asked
                />

                {/* Optional Right Map Toolbar per prompt */}
                <div className="absolute right-4 top-4 z-10 flex flex-col gap-2 pointer-events-auto">
                    {/* Additional Map tools can be added here */}
                </div>
            </div>
        </AppShell>
    );
};

export default Dashboard;
