import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Inbox, PenSquare, LogOut, Shield, Settings, User, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const SidebarLink = ({ to, icon: Icon, children }) => (
    <NavLink
        to={to}
        className={({ isActive }) => twMerge(
            clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                isActive ? "bg-premium-accent text-premium-bg shadow-lg shadow-premium-accent/20" : "text-premium-secondary hover:bg-white/5 hover:text-white"
            )
        )}
    >
        <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="font-medium">{children}</span>
    </NavLink>
);

const Dashboard = ({ user, setToken }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        setToken(null);
        navigate('/login');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-premium-bg text-premium-text">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-64 border-r border-white/5 flex flex-col p-4 bg-premium-card/30 backdrop-blur-xl"
            >
                <div className="flex items-center gap-3 px-4 py-6 mb-8">
                    <div className="w-10 h-10 bg-gradient-to-br from-premium-accent to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">SecureMail</h1>
                        <p className="text-[10px] uppercase font-bold text-premium-accent tracking-widest mt-0.5">
                            {user?.tier || 'Professional'}
                        </p>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    <SidebarLink to="/inbox" icon={Inbox}>Inbox</SidebarLink>
                    <SidebarLink to="/compose" icon={PenSquare}>Compose</SidebarLink>

                    <div className="h-px bg-white/5 my-4 mx-2" />

                    <SidebarLink to="/profile" icon={User}>Profile</SidebarLink>
                    <SidebarLink to="/settings" icon={Settings}>Settings</SidebarLink>

                    {user?.is_admin && (
                        <>
                            <div className="h-px bg-white/5 my-4 mx-2" />
                            <SidebarLink to="/admin" icon={ShieldAlert}>Admin Panel</SidebarLink>
                        </>
                    )}
                </nav>

                <div className="mt-auto pt-4 border-t border-white/5">
                    <div className="px-4 py-3 mb-2">
                        <p className="text-[10px] text-premium-secondary uppercase tracking-widest font-bold">Logged in as</p>
                        <p className="text-sm font-medium truncate">{user?.username}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="max-w-5xl mx-auto"
                >
                    <Outlet />
                </motion.div>
            </main>
        </div>
    );
};

export default Dashboard;
