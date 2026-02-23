import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { motion } from 'framer-motion';
import { Send, User, Tag, FileText, Loader2, CheckCircle } from 'lucide-react';

const Compose = () => {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/send', { to, subject, body });
            setSuccess(true);
            setTimeout(() => navigate('/inbox'), 2000);
        } catch (err) {
            console.error('Failed to send email', err);
            alert('Error sending email: ' + (err.response?.data?.detail || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-6"
                >
                    <CheckCircle size={48} />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Message Sent Securely</h2>
                <p className="text-premium-secondary">Redirecting to inbox...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <header className="mb-10">
                <h2 className="text-3xl font-bold tracking-tight">Create Communication</h2>
                <p className="text-premium-secondary mt-1">End-to-end encrypted messaging</p>
            </header>

            <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSend}
                className="glass-card p-8 space-y-6"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-premium-secondary flex items-center gap-2">
                            <User className="w-4 h-4" /> Recipient
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="user@ses"
                            className="input-field"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-premium-secondary flex items-center gap-2">
                            <Tag className="w-4 h-4" /> Subject
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Confidential Topic"
                            className="input-field"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-premium-secondary flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Message Body
                    </label>
                    <textarea
                        required
                        placeholder="Type your secure message here..."
                        className="input-field min-h-[300px] resize-none py-4"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </div>

                <div className="flex items-center justify-between pt-4">
                    <p className="text-xs text-premium-secondary italic flex items-center gap-2">
                        <Lock size={12} /> Digital signatures will be automatically applied.
                    </p>
                    <button
                        type="submit"
                        disabled={loading}
                        className="premium-btn px-8 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <>
                                <Send className="w-4 h-4" /> Send Message
                            </>
                        )}
                    </button>
                </div>
            </motion.form>
        </div>
    );
};

export default Compose;

import { Lock } from 'lucide-react';
