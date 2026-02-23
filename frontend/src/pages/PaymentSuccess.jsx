import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Sparkles, ArrowRight } from 'lucide-react';

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing');
    const tier = searchParams.get('tier');

    useEffect(() => {
        const finalizeUpgrade = async () => {
            try {
                // In future, the webhook will handle this, 
                // but for this now, we'll call a confirm endpoint.
                await api.post('/api/confirm-upgrade', { tier });
                setStatus('success');
            } catch (err) {
                console.error(err);
                setStatus('error');
            }
        };
        if (tier) finalizeUpgrade();
    }, [tier]);

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-premium-bg">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-md w-full glass-card p-12 text-center space-y-8"
            >
                {status === 'processing' ? (
                    <>
                        <Loader2 className="w-16 h-16 text-premium-accent animate-spin mx-auto" />
                        <h2 className="text-2xl font-bold">Verifying Deployment...</h2>
                        <p className="text-premium-secondary">Upgrading your operational node to {tier} tier.</p>
                    </>
                ) : status === 'success' ? (
                    <>
                        <div className="relative inline-block">
                            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute -top-2 -right-2 text-premium-accent"
                            >
                                <Sparkles size={24} />
                            </motion.div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold">Upgrade Complete</h2>
                            <p className="text-premium-secondary mt-2">Your node has been successfully provisioned with {tier} resources.</p>
                        </div>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="premium-btn w-full py-4 flex items-center justify-center gap-2"
                        >
                            Return to HQ <ArrowRight size={20} />
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-red-500">Provisioning Error</h2>
                        <p className="text-premium-secondary">We couldn't verify your upgrade. Please contact admin support.</p>
                        <button
                            onClick={() => navigate('/settings')}
                            className="premium-btn w-full py-4"
                        >
                            Back to Settings
                        </button>
                    </>
                )}
            </motion.div>
        </div>
    );
};

export default PaymentSuccess;
