import React from 'react';
import { User as UserIcon, Shield, Key, HardDrive, Mail, Hash, Trash2, AlertCircle } from 'lucide-react';
import api from '../api';
import { motion } from 'framer-motion';

const StatCard = ({ icon: Icon, label, value, subtext }) => (
    <div className="glass-card p-6 border border-white/5 flex items-center gap-4">
        <div className="p-4 bg-premium-accent/10 rounded-2xl text-premium-accent">
            <Icon size={24} />
        </div>
        <div>
            <p className="text-[10px] uppercase font-bold text-premium-secondary tracking-widest">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtext && <p className="text-xs text-premium-secondary mt-0.5">{subtext}</p>}
        </div>
    </div>
);

const Profile = ({ user }) => {
    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
            <header className="flex items-center gap-6 pb-6 border-b border-white/5">
                <div className="w-24 h-24 rounded-3xl bg-premium-accent overflow-hidden flex items-center justify-center text-premium-bg text-4xl font-bold border-4 border-premium-card shadow-2xl">
                    {user?.username[0].toUpperCase()}
                </div>
                <div>
                    <h2 className="text-4xl font-bold tracking-tight">{user?.username}</h2>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="bg-premium-accent/20 text-premium-accent text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-premium-accent/20">
                            {user?.tier} Member
                        </span>
                        <span className="text-premium-secondary text-sm">• Account status: Active</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                    icon={HardDrive}
                    label="Resource usage"
                    value={`${(user?.storage_used / 1024 / 1024).toFixed(2)} MB`}
                    subtext={`of ${(user?.storage_limit / 1024 / 1024).toFixed(0)} MB limit`}
                />
                <StatCard
                    icon={Shield}
                    label="Security Level"
                    value="E2E Enabled"
                    subtext="WebCrypto 2048-bit"
                />
                <StatCard
                    icon={Hash}
                    label="Account Index"
                    value={`SES-${user?.id}`}
                    subtext="Internal Trace ID"
                />
            </div>

            <section className="glass-card p-8 border border-white/5 space-y-6">
                <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                    <Key className="text-premium-accent" size={20} />
                    <h3 className="font-bold uppercase tracking-wider text-sm">Security Infrastructure Keys</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-xs font-bold text-premium-secondary uppercase mb-2 tracking-tighter">Public Identification Key (JWK)</p>
                        <pre className="bg-premium-bg p-4 rounded-xl border border-white/10 text-[10px] font-mono whitespace-pre-wrap break-all text-premium-secondary">
                            {user?.public_key || "No key generated yet."}
                        </pre>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-yellow-500/80 italic">
                        <Shield size={12} />
                        Your private key is stored locally in an encrypted vault.
                    </div>
                </div>
            </section>

            <section className="glass-card p-8 border border-red-500/10 space-y-6 bg-red-500/[0.02]">
                <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                    <Trash2 className="text-red-500" size={20} />
                    <h3 className="font-bold uppercase tracking-wider text-sm">Account Management</h3>
                </div>

                <div className="flex items-center justify-between gap-6">
                    <div className="space-y-1">
                        <p className="font-bold">Purge Identity</p>
                        <p className="text-sm text-premium-secondary max-w-md">
                            Irrevocably remove your identity and all end-to-end encrypted data from this secure node. This action cannot be undone.
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            if (window.confirm("ARE YOU ABSOLUTELY SURE? This will permanently delete your identity and all encrypted messages. This action is IRREVERSIBLE.")) {
                                try {
                                    await api.post('/api/delete_account');
                                    localStorage.removeItem('token');
                                    window.location.href = '/';
                                } catch (e) {
                                    alert("Deletion failed. Please contact node administrator.");
                                }
                            }
                        }}
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-all border border-red-500/20 flex items-center gap-2"
                    >
                        <AlertCircle size={18} /> Delete Account
                    </button>
                </div>
            </section>
        </div>
    );
};

export default Profile;
