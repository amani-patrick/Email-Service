import React, { useState, useEffect } from 'react';
import api from '../api';
import { Link2, Ban, Loader2, ExternalLink, Clock } from 'lucide-react';

const ExternalSent = ({ user }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchMessages = async () => {
        try {
            const res = await api.get('/api/external/sent');
            setMessages(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleRevoke = async (id) => {
        if (!confirm('Revoke access to this secure link?')) return;
        try {
            await api.post(`/api/external/${id}/revoke`);
            fetchMessages();
        } catch (err) {
            alert(err.response?.data?.detail || 'Revoke failed');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-premium-accent" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <header>
                <h2 className="text-3xl font-bold tracking-tight">Secure External Messages</h2>
                <p className="text-premium-secondary mt-1">
                    Zero-knowledge links sent to recipients outside your deployment.
                </p>
            </header>

            {messages.length === 0 ? (
                <div className="glass-card p-12 text-center text-premium-secondary">
                    No external secure messages sent yet.
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs text-premium-secondary uppercase border-b border-white/5">
                                <th className="px-6 py-4">Recipient</th>
                                <th className="px-6 py-4">Sent</th>
                                <th className="px-6 py-4">Expires</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {messages.map((m) => (
                                <tr key={m.uuid} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="px-6 py-4 font-mono">{m.recipient_email}</td>
                                    <td className="px-6 py-4 text-premium-secondary">
                                        {new Date(m.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-premium-secondary flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(m.expires_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {m.revoked ? (
                                            <span className="text-red-400 text-xs font-bold">REVOKED</span>
                                        ) : m.viewed ? (
                                            <span className="text-green-400 text-xs font-bold">VIEWED</span>
                                        ) : (
                                            <span className="text-amber-400 text-xs font-bold">PENDING</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {!m.revoked && (
                                            <button
                                                onClick={() => handleRevoke(m.uuid)}
                                                className="text-red-400 hover:underline text-xs flex items-center gap-1"
                                            >
                                                <Ban size={12} /> Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ExternalSent;
