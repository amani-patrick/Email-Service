import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, HardDrive, Zap, ChevronRight, Globe, Server, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const FeatureCard = ({ icon: Icon, title, description }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="glass-card p-8 border border-white/5 space-y-4"
    >
        <div className="p-3 bg-premium-accent/10 rounded-xl text-premium-accent w-fit">
            <Icon size={24} />
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-premium-secondary text-sm leading-relaxed">{description}</p>
    </motion.div>
);

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-premium-bg text-premium-text">
            {/* Navigation */}
            <nav className="border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-premium-accent rounded-xl flex items-center justify-center text-premium-bg font-bold shadow-lg shadow-premium-accent/20">
                            S
                        </div>
                        <span className="text-xl font-bold tracking-tight">SecureMail <span className="text-premium-accent">Enterprise</span></span>
                    </div>
                    <div className="flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-premium-secondary hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="text-sm font-medium text-premium-secondary hover:text-white transition-colors">Pricing</a>
                        <Link to="/login" className="premium-btn px-6 py-2.5 text-sm">Sign In</Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative pt-32 pb-40 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-premium-accent/5 to-transparent pointer-events-none" />
                <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-premium-accent"
                    >
                        <Zap size={14} /> Next-Generation Secure Communication
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9]"
                    >
                        Zero-Knowledge <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-premium-accent to-blue-400">Security for Enterprise</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-premium-secondary max-w-2xl mx-auto leading-relaxed"
                    >
                        Military-grade E2E encryption for your corporate messages and documents.
                        No backdoors. No surveillance. Only absolute privacy.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center justify-center gap-4 pt-4"
                    >
                        <Link to="/login" className="premium-btn px-10 py-5 text-lg flex items-center gap-2 group">
                            Get Started Now <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <button className="px-10 py-5 text-lg font-bold border border-white/10 rounded-2xl hover:bg-white/5 transition-all">
                            Request Demo
                        </button>
                    </motion.div>
                </div>
            </header>

            {/* Features Section */}
            <section id="features" className="max-w-7xl mx-auto px-6 py-32 space-y-20">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-bold tracking-tight">Engineered for absolute trust</h2>
                    <p className="text-premium-secondary max-w-xl mx-auto italic">Strategic communication tools designed for the modern sovereign enterprise.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <FeatureCard
                        icon={Lock}
                        title="Zero-Knowledge"
                        description="Encryption happens entirely on your device. We never hold your keys or access your plaintext data."
                    />
                    <FeatureCard
                        icon={Shield}
                        title="Digital Identity"
                        description="Cryptographic signatures ensure every communication is authentic and untampered."
                    />
                    <FeatureCard
                        icon={HardDrive}
                        title="Secure Drive"
                        description="Enterprise-grade file storage with end-to-end encryption for every attachment."
                    />
                    <FeatureCard
                        icon={Globe}
                        title="Global Resilience"
                        description="Distributed architecture ensures your communication remains accessible from anywhere."
                    />
                </div>
            </section>

            {/* Trusted By Section */}
            <section className="bg-white/5 py-20 border-y border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-10">
                    <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-premium-secondary">Security Infrastructure Integrated With</p>
                    <div className="flex flex-wrap justify-center items-center gap-16 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
                        <Server size={40} />
                        <Globe size={40} />
                        <Shield size={40} />
                        <Lock size={40} />
                        <UserCheck size={40} />
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="max-w-5xl mx-auto px-6 py-40 text-center space-y-10">
                <h2 className="text-5xl font-bold tracking-tight">Ready to de-risk your <br /> corporate communications?</h2>
                <Link to="/login" className="premium-btn px-12 py-6 text-xl mx-auto">
                    Join the Elite Network
                </Link>
                <p className="text-xs text-premium-secondary uppercase tracking-[0.2em]">Zero setup fees • 256-bit AES standard • GDPR Compliant</p>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3 text-premium-secondary">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center font-bold">S</div>
                        <span className="text-sm font-bold">© 2026 SecureMail Enterprise Group.</span>
                    </div>
                    <div className="flex gap-10 text-xs font-bold uppercase tracking-widest text-premium-secondary">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-white transition-colors">Security Audit</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
