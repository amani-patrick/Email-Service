import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { webauthnRegisterOptions, webauthnRegisterVerify } from '../api';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, CreditCard, Shield, Zap, Check, ArrowRight, Loader2, Wallet, X, XCircle, CheckCircle, Info, Fingerprint } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

const PricingCard = ({ tier, limit, price, features, current, onUpgrade }) => (
    <div className={`glass-card p-8 flex flex-col h-full border ${current ? 'border-premium-accent ring-1 ring-premium-accent/20' : 'border-white/5'}`}>
        <div className="flex justify-between items-start mb-6">
            <div>
                <h3 className="text-xl font-bold">{tier}</h3>
                <p className="text-sm text-premium-secondary uppercase tracking-widest font-bold mt-1">{limit}</p>
            </div>
            {current && <div className="bg-premium-accent/20 text-premium-accent text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Current</div>}
        </div>

        <div className="mb-8">
            <span className="text-4xl font-bold">${price}</span>
            <span className="text-premium-secondary ml-1">/mo</span>
        </div>

        <ul className="space-y-4 mb-10 flex-1">
            {features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-premium-secondary">
                    <Check className="w-5 h-5 text-premium-accent shrink-0" />
                    <span>{f}</span>
                </li>
            ))}
        </ul>

        <button
            onClick={() => onUpgrade(tier)}
            disabled={current}
            className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${current
                ? 'bg-white/5 text-premium-secondary cursor-not-allowed'
                : 'bg-premium-accent text-premium-bg hover:shadow-lg hover:shadow-premium-accent/20 active:scale-95'
                }`}
        >
            {current ? 'Active Subscription' : (
                <>
                    Upgrade to {tier} <ArrowRight size={18} />
                </>
            )}
        </button>
    </div>
);

const Settings = ({ user }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);

    const handleUpgrade = (tier) => {
        navigate('/upgrade', { state: { tier } });
    };

    const handleRegisterBiometric = async () => {
        setLoading(true);
        setNotification(null);
        try {
            const { data: options } = await webauthnRegisterOptions();

            const base64ToBuffer = (base64) => {
                const bin = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
                const buffer = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
                return buffer;
            };

            const bufferToBase64 = (buffer) => {
                return btoa(String.fromCharCode(...new Uint8Array(buffer)))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            };

            const publicKeyOptions = {
                ...options,
                challenge: base64ToBuffer(options.challenge),
                user: {
                    ...options.user,
                    id: base64ToBuffer(options.user.id)
                },
                excludeCredentials: options.excludeCredentials.map(c => ({
                    ...c,
                    id: base64ToBuffer(c.id)
                }))
            };

            const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });

            const response = {
                id: credential.id,
                rawId: bufferToBase64(credential.rawId),
                type: credential.type,
                response: {
                    attestationObject: bufferToBase64(credential.response.attestationObject),
                    clientDataJSON: bufferToBase64(credential.response.clientDataJSON)
                }
            };

            await webauthnRegisterVerify(response);
            setNotification({ type: 'success', message: 'Biometric device registered successfully!' });
        } catch (err) {
            console.error('Biometric Registration Error:', err);
            setNotification({ type: 'error', message: 'Biometric registration failed.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <header className="flex items-center justify-between pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Account Configuration</h2>
                    <p className="text-premium-secondary mt-1">Manage your subscriptions and security parameters</p>
                </div>
                <div className="bg-premium-card/50 p-4 border border-white/5 rounded-2xl flex items-center gap-3">
                    <div className="p-3 bg-premium-accent/10 rounded-xl text-premium-accent">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-premium-secondary">Storage Used</p>
                        <p className="font-bold">{(user?.storage_used / 1024 / 1024).toFixed(2)} MB / {(user?.storage_limit / 1024 / 1024).toFixed(0)} MB</p>
                    </div>
                </div>
            </header>

            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className={`fixed bottom-8 right-8 z-[100] p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-4 min-w-[320px] ${notification.type === 'error'
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : notification.type === 'success'
                                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                : 'bg-premium-accent/10 border-premium-accent/20 text-premium-accent'
                            }`}
                    >
                        <div className={`p-2 rounded-lg ${notification.type === 'error' ? 'bg-red-500/20' : notification.type === 'success' ? 'bg-green-500/20' : 'bg-premium-accent/20'
                            }`}>
                            {notification.type === 'error' ? <XCircle size={20} /> : notification.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold">{notification.message}</p>
                        </div>
                        <button
                            onClick={() => setNotification(null)}
                            className="p-1 hover:bg-white/5 rounded-md transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <section className="space-y-8">
                <div className="flex items-center gap-2">
                    <Zap className="text-premium-accent" size={24} />
                    <h3 className="text-xl font-bold">Subscription Tiers</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <PricingCard
                        tier="Free"
                        limit="100 MB"
                        price="0"
                        current={user?.tier === 'Free'}
                        features={[
                            "Zero-Knowledge Encryption",
                            "Basic Signature Verification",
                            "Community Support",
                            "Internal Messaging Only"
                        ]}
                    />
                    <PricingCard
                        tier="Pro"
                        limit="1 GB"
                        price="12"
                        current={user?.tier === 'Pro'}
                        onUpgrade={handleUpgrade}
                        features={[
                            "Unlimited Private Drive Storage",
                            "External Secure Invites (50/mo)",
                            "24/7 Expert Support",
                            "Extended Storage Metrics",
                            "Priority Verification"
                        ]}
                    />
                    <PricingCard
                        tier="Enterprise"
                        limit="10 GB"
                        price="49"
                        current={user?.tier === 'Enterprise'}
                        onUpgrade={handleUpgrade}
                        features={[
                            "Unlimited External Invites",
                            "SMTP Gateway Support",
                            "Infinite Retention Policies",
                            "Advanced Threat Prevention",
                            "Dedicated Infrastructure"
                        ]}
                    />
                </div>
            </section>

            <section className="space-y-6 pt-12 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <Wallet className="text-premium-accent" size={24} />
                    <h3 className="text-xl font-bold">Alternative Payments</h3>
                </div>
                <div className="glass-card p-8 flex items-center justify-between border border-white/5">
                    <div className="space-y-2">
                        <h4 className="font-bold">Crypto-Asset Transfer</h4>
                        <p className="text-sm text-premium-secondary">Pay anonymously using BTC, ETH, or XMR for maximum operational security.</p>
                    </div>
                    <button className="premium-btn px-6 border-white/10 bg-transparent hover:bg-white/5">
                        Generate Invoice
                    </button>
                </div>
            </section>

            <section className="space-y-6 pt-12 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <Fingerprint className="text-premium-accent" size={24} />
                    <h3 className="text-xl font-bold">Biometric Security</h3>
                </div>
                <div className="glass-card p-8 flex items-center justify-between border border-premium-accent/20 bg-premium-accent/5">
                    <div className="space-y-2">
                        <h4 className="font-bold flex items-center gap-2">
                            Physical Identity Link
                            <span className="text-[10px] bg-premium-accent text-premium-bg px-2 py-0.5 rounded font-black uppercase">Premium Only</span>
                        </h4>
                        <p className="text-sm text-premium-secondary">Enable FaceID, TouchID, or YubiKey for physical-layer security. Replace password prompts with biometric verification.</p>
                    </div>
                    <button
                        onClick={handleRegisterBiometric}
                        disabled={loading || user?.tier === 'Free'}
                        className="premium-btn px-8 flex items-center gap-2 disabled:opacity-30"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Fingerprint size={18} />}
                        Register Device
                    </button>
                </div>
            </section>
        </div>
    );
};

export default Settings;
