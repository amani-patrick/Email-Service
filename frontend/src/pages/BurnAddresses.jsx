import React, { useState, useEffect } from 'react';
import { getBurnAddresses, createBurnAddress } from '../api';
import { Flame, Plus, Clock, ShieldCheck, Copy, Info } from 'lucide-react';
import Notification from '../components/Notification';

const BurnAddresses = () => {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
    };

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            const { data } = await getBurnAddresses();
            setAddresses(data);
        } catch (error) {
            showNotification('Failed to fetch addresses', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            await createBurnAddress();
            showNotification('Burn address created', 'success');
            await fetchAddresses();
        } catch (error) {
            showNotification('Failed to create address. Upgrade to Premium.', 'error');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard', 'info');
    };

    return (
        <div className="max-w-6xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter mb-2 italic">
                        EPHEMERAL <span className="text-premium-accent">BURN</span> ADDRESSES
                    </h1>
                    <p className="text-premium-secondary font-medium tracking-tight">Generate temporary identities that self-destruct after 24 hours.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-premium-accent text-premium-bg px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl shadow-premium-accent/20 uppercase tracking-widest text-xs"
                >
                    <Plus size={20} />
                    Generate New
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64 text-premium-accent">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-accent"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {addresses.length === 0 ? (
                        <div className="col-span-full glass-card p-12 text-center border-dashed border-2 border-white/5">
                            <Flame size={48} className="mx-auto mb-4 text-premium-secondary opacity-20" />
                            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">No Active Burn Addresses</h3>
                            <p className="text-premium-secondary mb-6 max-w-sm mx-auto">Create a temporary identity to protect your main address from spam and tracking.</p>
                        </div>
                    ) : (
                        addresses.map((addr) => (
                            <div key={addr.id} className="glass-card p-6 border border-white/10 hover:border-premium-accent/50 transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-premium-accent/10 rounded-lg flex items-center justify-center text-premium-accent">
                                        <Flame size={20} />
                                    </div>
                                    <span className="bg-green-500/10 text-green-400 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">
                                        Active
                                    </span>
                                </div>

                                <h3 className="text-white font-black tracking-tight mb-1 truncate">{addr.address}</h3>
                                <div className="flex items-center gap-2 text-premium-secondary text-xs mb-4">
                                    <Clock size={12} />
                                    <span>Expires {new Date(addr.expires_at).toLocaleString()}</span>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyToClipboard(addr.address)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10 transition-colors"
                                    >
                                        <Copy size={14} />
                                        COPY
                                    </button>
                                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-premium-accent/5 text-premium-accent">
                                        <ShieldCheck size={16} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default BurnAddresses;
