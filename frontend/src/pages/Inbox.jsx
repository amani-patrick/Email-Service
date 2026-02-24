import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCw, Star, Trash2, MailOpen, Inbox as InboxIcon, Mail } from 'lucide-react';

const Inbox = () => {
    const [emails, setEmails] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const fetchEmails = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/emails');
            setEmails(response.data);
        } catch (err) {
            console.error('Failed to fetch emails', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmails();
    }, []);

    const sortedEmails = Object.values(emails).sort((a, b) => b.time - a.time);
    const filteredEmails = sortedEmails.filter(email =>
        email.sender_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.uuid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Personal Inbox</h2>
                    <p className="text-premium-secondary mt-1">Manage your corporate encrypted communications</p>
                </div>
                <button
                    onClick={fetchEmails}
                    className="p-3 glass-card hover:bg-white/10 transition-colors"
                >
                    <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
                </button>
            </header>

            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-premium-secondary group-focus-within:text-premium-accent transition-colors" />
                <input
                    type="text"
                    placeholder="Search by sender or ID..."
                    className="input-field pl-12 h-14 bg-premium-card/30 backdrop-blur-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-premium-secondary">Sender</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-premium-secondary">Subject / ID</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-premium-secondary">Status</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-premium-secondary text-right">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode='popLayout'>
                                {filteredEmails.map((email, idx) => (
                                    <motion.tr
                                        key={email.uuid}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        onClick={() => navigate(`/email/${email.uuid}`)}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-medium flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-premium-accent/20 flex items-center justify-center text-premium-accent text-xs">
                                                {email.sender_username[0].toUpperCase()}
                                            </div>
                                            {email.sender_username}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold truncate max-w-md">
                                                {email.uuid}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {email.read ? (
                                                <span className="flex items-center gap-2 text-xs text-premium-secondary">
                                                    <MailOpen className="w-4 h-4" /> Read
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2 text-xs text-premium-accent font-bold">
                                                    <Mail className="w-4 h-4" /> Unread
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-premium-secondary">
                                            {new Date(email.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {filteredEmails.length === 0 && !loading && (
                        <div className="py-20 text-center flex flex-col items-center gap-4">
                            <div className="p-4 bg-white/5 rounded-full text-premium-secondary">
                                <InboxIcon size={48} strokeWidth={1} />
                            </div>
                            <div>
                                <p className="text-lg font-bold">Inbox is currently empty</p>
                                <p className="text-premium-secondary text-sm">No encrypted communications found at this time.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Inbox;

import { clsx } from 'clsx';
