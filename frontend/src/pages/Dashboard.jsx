import React from 'react';
import { Link } from 'react-router-dom';
import {
    Inbox,
    Send,
    ShieldCheck,
    ChevronRight,
    ArrowUpRight,
    User as UserIcon,
    Settings as SettingsIcon
} from 'lucide-react';

const STAT_ICON_STYLES = {
    'premium-accent': { wrap: 'bg-premium-accent/10 text-premium-accent' },
    'blue-400': { wrap: 'bg-blue-400/10 text-blue-400' },
    'purple-400': { wrap: 'bg-purple-400/10 text-purple-400' }
};

const StatCard = ({ title, value, subtext, icon: Icon, color, to }) => (
    <div className="glass-card p-6 flex flex-col h-full group hover:border-premium-accent/30 transition-all duration-300">
        <div className="flex justify-between items-start mb-6">
            <div className={`p-3 rounded-xl ${STAT_ICON_STYLES[color]?.wrap || 'bg-white/10 text-premium-text'}`}>
                <Icon size={24} />
            </div>
            {to && (
                <Link to={to} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-white/5 rounded-lg text-premium-secondary">
                    <ArrowUpRight size={18} />
                </Link>
            )}
        </div>
        <h3 className="text-premium-secondary text-sm font-black uppercase tracking-widest mb-2">{title}</h3>
        <p className="text-4xl font-bold text-white mb-2">{value}</p>
        <p className="text-sm text-premium-secondary">{subtext}</p>
    </div>
);

const Dashboard = ({ user }) => {
    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/5">
                <div>
                    <h1 className="text-5xl font-black text-white tracking-tight mb-2">
                        Welcome back, <span className="text-premium-accent italic">{user?.username?.split('@')[0]}</span>
                    </h1>
                    <p className="text-premium-secondary font-medium">
                        Your secure workspace is encrypted and ready for operation.
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-widest text-premium-secondary">Identity Verified</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Communications"
                    value="0"
                    subtext="Unread messages in your inbox"
                    icon={Inbox}
                    color="premium-accent"
                    to="/inbox"
                />
                <StatCard
                    title="Security Level"
                    value="E2EE"
                    subtext="Post-quantum cryptographic protection"
                    icon={ShieldCheck}
                    color="blue-400"
                />
                <StatCard
                    title="Account Identity"
                    value={user?.tier || 'Free'}
                    subtext={`${(user?.storage_used / 1024 / 1024).toFixed(1)}MB of ${(user?.storage_limit / 1024 / 1024).toFixed(0)}MB used`}
                    icon={UserIcon}
                    color="purple-400"
                    to="/profile"
                />
            </div>

            {/* Quick Actions Panel */}
            <div className="glass-card p-1">
                <div className="p-8 pb-4">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        Quick Actions
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
                    <Link to="/compose" className="p-8 bg-premium-card hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-6">
                            <div className="p-4 rounded-2xl bg-premium-accent/10 text-premium-accent group-hover:scale-110 transition-transform">
                                <Send size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg">Compose Email</h4>
                                <p className="text-sm text-premium-secondary">Send encrypted message</p>
                            </div>
                        </div>
                        <ChevronRight className="text-premium-secondary group-hover:translate-x-1 transition-transform" />
                    </Link>

                    <Link to="/inbox" className="p-8 bg-premium-card hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-6">
                            <div className="p-4 rounded-2xl bg-blue-400/10 text-blue-400 group-hover:scale-110 transition-transform">
                                <Inbox size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg">Access Inbox</h4>
                                <p className="text-sm text-premium-secondary">View received messages</p>
                            </div>
                        </div>
                        <ChevronRight className="text-premium-secondary group-hover:translate-x-1 transition-transform" />
                    </Link>

                    <Link to="/settings" className="p-8 bg-premium-card hover:bg-white/[0.02] transition-colors flex items-center justify-between group md:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-6">
                            <div className="p-4 rounded-2xl bg-purple-400/10 text-purple-400 group-hover:scale-110 transition-transform">
                                <SettingsIcon size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg">System Settings</h4>
                                <p className="text-sm text-premium-secondary">Manage keys and profile</p>
                            </div>
                        </div>
                        <ChevronRight className="text-premium-secondary group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
