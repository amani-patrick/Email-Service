import React, { useState } from 'react';
import api from '../api';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, CreditCard, Shield, Zap, Check, ArrowRight, Loader2, Wallet } from 'lucide-react';

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
    const [loading, setLoading] = useState(false);

    const handleUpgrade = async (tier) => {
        setLoading(true);
        try {
            const res = await api.post('/api/create-checkout-session', { tier });
            if (res.data.url) {
                window.location.href = res.data.url;
            }
        } catch (err) {
            console.error('Upgrade failed', err);
            alert('Payment system error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <header className="flex items-center justify-between">
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
                            "Standard Archive Access"
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
                            "Priority Signature Verification",
                            "24/7 Expert Support",
                            "Extended Storage Metrics",
                            "Custom Security Certificates"
                        ]}
                    />
                    <PricingCard
                        tier="Enterprise"
                        limit="10 GB"
                        price="49"
                        current={user?.tier === 'Enterprise'}
                        onUpgrade={handleUpgrade}
                        features={[
                            "Full Corporate Transparency",
                            "Team Resource Collaboration",
                            "Infinite Retention Policies",
                            "Advanced Threat Prevention",
                            "Dedicated Private Infrastructure"
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
        </div>
    );
};

export default Settings;
