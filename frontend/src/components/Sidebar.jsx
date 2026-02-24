import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Inbox,
    Send,
    Settings,
    ShieldAlert,
    User,
    LogOut
} from 'lucide-react';

const SidebarItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `
            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
            ${isActive
                ? 'bg-premium-accent text-premium-bg shadow-lg shadow-premium-accent/20 font-bold'
                : 'text-premium-secondary hover:bg-white/5 hover:text-white'}
        `}
    >
        <Icon size={20} />
        <span className="text-sm tracking-wide">{label}</span>
    </NavLink>
);

const Sidebar = ({ user, onLogout }) => {
    return (
        <aside className="w-72 h-screen fixed left-0 top-0 flex flex-col glass-sidebar border-r border-white/5 z-50">
            <div className="p-8">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-premium-accent rounded-xl flex items-center justify-center text-premium-bg">
                        <ShieldAlert size={24} />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white italic">SecureMail</span>
                </div>

                <nav className="space-y-2">
                    <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <SidebarItem to="/inbox" icon={Inbox} label="Inbox" />
                    <SidebarItem to="/compose" icon={Send} label="Compose Email" />
                    <SidebarItem to="/settings" icon={Settings} label="Account Settings" />
                    <SidebarItem to="/profile" icon={User} label="Profile" />

                    {user?.is_admin && (
                        <div className="pt-6 mt-6 border-t border-white/5 space-y-2">
                            <p className="px-4 mb-2 text-[10px] uppercase tracking-widest font-black text-premium-secondary opacity-50">
                                Infrastructure
                            </p>
                            <SidebarItem to="/admin" icon={ShieldAlert} label="Global Management" />
                        </div>
                    )}
                </nav>
            </div>

            <div className="mt-auto p-8 pt-0">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    <LogOut size={20} />
                    <span className="text-sm font-bold uppercase tracking-widest">Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
