import { Plus, User, MapPin } from 'lucide-react';

interface RoutePanelOverlayProps {
    routes: any[];
    buses: any[];
    selectedRouteId: string | null;
    onSelectRoute: (id: string | null) => void;
}

export const RoutePanelOverlay = ({ routes, buses, selectedRouteId, onSelectRoute }: RoutePanelOverlayProps) => {
    return (
        <div className="absolute top-4 left-4 z-10 w-[340px] max-h-[calc(100%-32px)] flex flex-col bg-dashboard-surface rounded-[16px] shadow-soft border border-dashboard-border overflow-hidden pointer-events-auto">
            <div className="p-4 border-b border-dashboard-border flex items-center justify-between shrink-0 bg-white">
                <h3 className="font-bold text-dashboard-text text-[16px]">Routes</h3>
                <button className="flex items-center gap-1 text-[12px] font-bold text-dashboard-primary bg-dashboard-primary/10 hover:bg-dashboard-primary/20 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={14} strokeWidth={3} />
                    Create
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {routes.map(route => {
                    // Approximate bus mapping
                    const assignedBus = buses.find(b => b.routeId === route._id || b.routeName === route.name || route.assignedBuses?.includes(b._id));
                    const isSelected = selectedRouteId === route._id;

                    return (
                        <div 
                            key={route._id}
                            onClick={() => onSelectRoute(isSelected ? null : route._id)}
                            className={`p-3 rounded-xl cursor-pointer transition-all border-l-[3px] ${
                                isSelected 
                                    ? 'bg-dashboard-warning/5 border-dashboard-warning' 
                                    : 'bg-transparent border-transparent hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-bold text-[14px] ${isSelected ? 'text-dashboard-warning' : 'text-dashboard-text'}`}>
                                    {route.name || `Route ${route.routeNumber}`}
                                </h4>
                                <div className="text-[10px] font-bold text-dashboard-muted">
                                    {route.stops?.length || 0} STOPS
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1 mt-2">
                                <div className="flex items-center gap-2 text-[12px] text-dashboard-secondary">
                                    <MapPin size={12} className={isSelected ? 'text-dashboard-warning/70' : 'text-dashboard-muted'} />
                                    <span className="truncate">{route.stops?.[0]?.name || 'N/A'} → {route.stops?.[route.stops.length-1]?.name || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-dashboard-secondary mt-0.5">
                                    <User size={12} className={isSelected ? 'text-dashboard-warning/70' : 'text-dashboard-muted'} />
                                    <span className="truncate">{assignedBus ? `Bus ${assignedBus.busNumber} • ${assignedBus.driverName || 'Driver'}` : 'No bus assigned'}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
