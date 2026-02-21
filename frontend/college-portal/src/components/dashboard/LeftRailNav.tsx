import { Home, Bus, MapPin, Users, Settings, Power } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

interface LeftRailNavProps {
    activeItem: string;
}

export const LeftRailNav = ({ activeItem }: LeftRailNavProps) => {
    const navigate = useNavigate();
    const { orgSlug } = useParams<{ orgSlug: string }>();

    const NavItem = ({ id, icon: Icon, path, label, isDanger = false }: any) => {
        const isActive = activeItem === id;

        return (
            <button
                onClick={() => navigate(`/${orgSlug}/${path}`)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    isActive 
                        ? 'bg-dashboard-primary/10 text-dashboard-primary relative' 
                        : isDanger
                            ? 'text-dashboard-warning hover:bg-dashboard-warning/10'
                            : 'text-dashboard-muted hover:bg-slate-50 hover:text-dashboard-text'
                }`}
                title={label}
            >
                {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-dashboard-primary rounded-r-md" />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </button>
        );
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('driver_token');
        localStorage.removeItem('driver_user');
        localStorage.removeItem('current_college_id');
        localStorage.removeItem('orgName');
        navigate(`/${orgSlug}/login`);
    };

    return (
        <aside className="w-[72px] bg-dashboard-surface shadow-soft h-screen flex flex-col items-center py-6 z-50 border-r border-dashboard-border flex-shrink-0">
            {/* Logo area */}
            <div className="mb-8">
                <div className="w-10 h-10 bg-dashboard-primary rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-dashboard-primary/30">
                    P
                </div>
            </div>

            {/* Main Nav Items */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-3">
                <NavItem id="dashboard" icon={Home} path="dashboard" label="Dashboard" />
                <NavItem id="buses" icon={Bus} path="buses" label="Fleet/Buses" />
                <NavItem id="drivers" icon={Users} path="drivers" label="Drivers & Staff" />
                <NavItem id="students" icon={Users} path="students" label="Students" />
                <NavItem id="routes" icon={MapPin} path="routes" label="Routes" />
                <NavItem id="trip-history" icon={MapPin} path="trip-history" label="Trip History" />
                {JSON.parse(localStorage.getItem('user') || '{}')?.role === 'SUPER_ADMIN' || JSON.parse(localStorage.getItem('user') || '{}')?.role === 'OWNER' ? (
                    <NavItem id="admins" icon={Users} path="admins" label="Manage Admins" />
                ) : null}
            </nav>

            {/* Bottom Menu */}
            <div className="flex flex-col gap-4 w-full px-3 mt-auto">
                <NavItem id="settings" icon={Settings} path="settings" label="Settings" />
                <button
                    onClick={handleLogout}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-dashboard-warning hover:bg-dashboard-warning/10 transition-all"
                    title="Logout"
                >
                    <Power size={22} strokeWidth={2} />
                </button>
            </div>
        </aside>
    );
};
