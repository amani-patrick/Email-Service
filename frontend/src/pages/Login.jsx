import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, UserPlus, ArrowRight, ShieldCheck } from 'lucide-react';

const Login = ({ setToken }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        const endpoint = isLogin ? '/api/login' : '/api/register';

        try {
            const response = await axios.post(endpoint, { username, password });
            if (isLogin) {
                setToken(response.data.access_token);
            } else {
                setSuccess('Account created successfully. Please sign in.');
                setIsLogin(true);
                setPassword('');
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-premium-bg">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card w-full max-w-md p-10 relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-premium-accent via-blue-500 to-premium-accent" />

                <div className="flex flex-col items-center mb-10">
                    <motion.div
                        key={isLogin ? 'login-icon' : 'reg-icon'}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="p-4 bg-premium-accent/10 rounded-2xl mb-4 text-premium-accent"
                    >
                        {isLogin ? <ShieldCheck size={32} /> : <UserPlus size={32} />}
                    </motion.div>
                    <h1 className="text-3xl font-bold tracking-tight">SecureMail <span className="text-premium-accent text-lg">Enterprise</span></h1>
                    <p className="text-premium-secondary mt-2 text-sm">
                        {isLogin ? 'Access your secure environment' : 'Provision a new secure identity'}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold uppercase tracking-wider text-center"
                        >
                            {error}
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-xs font-bold uppercase tracking-wider text-center"
                        >
                            {success}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-premium-secondary uppercase tracking-widest flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5" /> Identity Address
                        </label>
                        <input
                            type="text"
                            required
                            className="input-field"
                            placeholder="username@ses"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-premium-secondary uppercase tracking-widest flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5" /> Access Credential
                        </label>
                        <input
                            type="password"
                            required
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="premium-btn w-full flex items-center justify-center gap-2 h-14 text-lg"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                            <>
                                {isLogin ? 'Initialize Workspace' : 'Confirm Registration'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setSuccess('');
                        }}
                        className="text-sm font-medium text-premium-secondary hover:text-premium-accent transition-colors"
                    >
                        {isLogin ? "Don't have an enterprise account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
