import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const Notification = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        success: <CheckCircle className="text-green-400" size={20} />,
        error: <XCircle className="text-red-400" size={20} />,
        info: <Info className="text-premium-accent" size={20} />
    };

    const colors = {
        success: 'bg-green-500/10 border-green-500/20',
        error: 'bg-red-500/10 border-red-500/20',
        info: 'bg-premium-accent/10 border-premium-accent/20'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`fixed bottom-8 right-8 z-[100] min-w-[320px] glass-card p-4 border flex items-center gap-4 ${colors[type]}`}
        >
            <div className="shrink-0">{icons[type]}</div>
            <div className="flex-1">
                <p className="text-sm font-bold text-white tracking-tight">{message}</p>
            </div>
            <button
                onClick={onClose}
                className="p-1 hover:bg-white/5 rounded-lg transition-colors text-premium-secondary hover:text-white"
            >
                <X size={16} />
            </button>
            <div className="absolute bottom-0 left-0 h-0.5 bg-white/10 w-full overflow-hidden rounded-full">
                <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 5, ease: 'linear' }}
                    className={`h-full ${type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-premium-accent'}`}
                />
            </div>
        </motion.div>
    );
};

export default Notification;
