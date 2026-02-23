import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { motion } from 'framer-motion';
import { ChevronLeft, Calendar, User, ShieldCheck, Mail, Printer, Trash2 } from 'lucide-react';

const EmailDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmail = async () => {
            try {
                const res = await api.get(`/api/email/${id}`);
                setEmail(res.data);
                if (!res.data.read) {
                    api.post(`/api/mark_read/${id}`);
                }
            } catch (err) {
                console.error('Failed to fetch email', err);
            } finally {
                setLoading(false);
            }
        };
        fetchEmail();
    }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-premium-accent border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!email) return <div>Email not found.</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <button
                onClick={() => navigate('/inbox')}
                className="flex items-center gap-2 text-premium-secondary hover:text-white transition-colors mb-8 group"
            >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Back to Workspace
            </button>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden"
            >
                {/* Header Section */}
                <div className="p-8 border-b border-white/5 bg-white/5">
                    <div className="flex items-start justify-between mb-8">
                        <h1 className="text-2xl font-bold tracking-tight leading-tight max-w-2xl">
                            Log ID: {email.uuid}
                        </h1>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-white/10 rounded-lg text-premium-secondary transition-colors"><Printer size={20} /></button>
                            <button className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"><Trash2 size={20} /></button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-6 items-center text-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-premium-accent/20 flex items-center justify-center text-premium-accent font-bold">
                                {email.sender_username[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-premium-secondary text-[10px] uppercase font-bold tracking-wider">From Agent</p>
                                <p className="font-semibold">{email.sender_username}</p>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-white/10 hidden md:block" />

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-premium-secondary">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-premium-secondary text-[10px] uppercase font-bold tracking-wider">Intercept Time</p>
                                <p className="font-semibold">{new Date(email.time * 1000).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg border border-green-500/20">
                            <ShieldCheck size={16} />
                            <span className="text-xs font-bold uppercase tracking-wide">Signature Verified</span>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-8 glass-bg">
                    <div className="prose prose-invert max-w-none text-premium-secondary leading-relaxed bg-premium-bg/50 p-6 rounded-xl border border-white/5 font-mono text-sm whitespace-pre-wrap">
                        {email.data}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default EmailDetails;
