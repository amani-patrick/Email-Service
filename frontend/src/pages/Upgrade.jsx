import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CreditCard, Lock, Check, X, Shield, Zap, Loader2, ChevronRight, Info, Wallet, ArrowRight } from 'lucide-react';
import Notification from '../components/Notification';

const TIERS = [
  {
    name: 'Starter',
    limit: '100 MB Storage',
    price: 0,
    features: [
      '100 MB secure storage',
      'End-to-end encryption',
      'Secure key management',
      'Basic audit logs',
      'Email attachments up to 5MB'
    ],
    color: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'Professional',
    limit: '1 GB Storage',
    price: 12,
    features: [
      '1 GB secure storage',
      'End-to-end encrypted Private Drive',
      'Ephemeral Burn Addresses',
      'Advanced encryption controls',
      'Priority email delivery',
      'Custom email domains'
    ],
    color: 'from-purple-500 to-pink-500',
    popular: true
  },
  {
    name: 'Enterprise',
    limit: '10 GB Storage',
    price: 49,
    features: [
      '10 GB secure storage',
      'Military-grade Stego Vault',
      'Dedicated infrastructure',
      'Real-time monitoring',
      'Advanced team management',
      '24/7 priority support'
    ],
    color: 'from-amber-500 to-orange-500'
  }
];

const PaymentForm = ({ tier, onBack, onSuccess }) => {
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: '',
    email: ''
  });
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length !== 16) {
      newErrors.cardNumber = 'Valid 16-digit card number required';
    }
    if (!formData.expiry || !formData.expiry.match(/^(0[1-9]|1[0-2])\/\d{2}$/)) {
      newErrors.expiry = 'Format: MM/YY';
    }
    if (!formData.cvv || formData.cvv.length !== 3) {
      newErrors.cvv = '3-digit CVV required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Cardholder name required';
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      newErrors.email = 'Valid email required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setProcessing(true);
    try {
      // Mock payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Call backend upgrade endpoint
      await api.post('/api/confirm-upgrade', {
        tier: tier.name
      });

      onSuccess();
    } catch (error) {
      console.error('Payment failed:', error);
      setErrors({ submit: 'Payment failed. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ').substr(0, 19);
  };

  const formatExpiry = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      className="max-w-2xl mx-auto"
    >
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-premium-secondary hover:text-premium-text transition-colors"
      >
        <ArrowLeft size={20} />
        Back to tier selection
      </button>

      <div className="glass-card p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{tier.name} Plan</h2>
            <p className="text-premium-secondary">${tier.price}/month • {tier.limit}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Card Number</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-premium-secondary" />
                <input
                  type="text"
                  value={formData.cardNumber}
                  onChange={(e) => setFormData({ ...formData, cardNumber: formatCardNumber(e.target.value) })}
                  placeholder="1234 5678 9012 3456"
                  className={`input-field pl-12 ${errors.cardNumber ? 'border-red-500' : ''}`}
                  maxLength={19}
                />
              </div>
              {errors.cardNumber && <p className="text-red-500 text-sm mt-1">{errors.cardNumber}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Expiry Date</label>
              <input
                type="text"
                value={formData.expiry}
                onChange={(e) => setFormData({ ...formData, expiry: formatExpiry(e.target.value) })}
                placeholder="MM/YY"
                className={`input-field ${errors.expiry ? 'border-red-500' : ''}`}
                maxLength={5}
              />
              {errors.expiry && <p className="text-red-500 text-sm mt-1">{errors.expiry}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">CVV</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-premium-secondary" />
                <input
                  type="text"
                  value={formData.cvv}
                  onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '') })}
                  placeholder="123"
                  className={`input-field pl-12 ${errors.cvv ? 'border-red-500' : ''}`}
                  maxLength={3}
                />
              </div>
              {errors.cvv && <p className="text-red-500 text-sm mt-1">{errors.cvv}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Cardholder Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className={`input-field ${errors.name ? 'border-red-500' : ''}`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className={`input-field ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          {errors.submit && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500">
              {errors.submit}
            </div>
          )}

          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-premium-accent mt-0.5" />
              <div className="text-sm text-premium-secondary">
                <p className="font-medium text-premium-text mb-1">Secure Payment</p>
                <p>Your payment information is encrypted and secure. We use industry-standard SSL encryption to protect your data.</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="premium-btn w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Pay ${tier.price}/month
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

const Upgrade = ({ user, onRefreshUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTier, setSelectedTier] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [currentTier, setCurrentTier] = useState('Starter');

  // Get preselected tier from navigation state
  React.useEffect(() => {
    if (location.state?.tier) {
      const tier = TIERS.find(t => t.name === location.state.tier);
      if (tier) {
        setSelectedTier(tier);
        setShowPayment(true);
      }
    }
  }, [location.state]);

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    setShowPayment(true);
  };

  const handlePaymentSuccess = async () => {
    if (onRefreshUser) {
      await onRefreshUser();
    }
    navigate('/payment-success', {
      state: { tier: selectedTier.name },
      replace: true
    });
  };

  const handleBackToSelection = () => {
    setShowPayment(false);
    setSelectedTier(null);
  };

  return (
    <div className="min-h-screen bg-premium-bg text-premium-text p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Upgrade Your Secure Email</h1>
          <p className="text-xl text-premium-secondary max-w-2xl mx-auto">
            Choose the perfect plan for your secure communication needs. All plans include end-to-end encryption.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!showPayment ? (
            <motion.div
              key="tiers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {TIERS.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative ${tier.popular ? 'md:scale-105' : ''}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-premium-accent text-premium-bg px-4 py-1 rounded-full text-sm font-bold">
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  <div className={`glass-card p-8 h-full flex flex-col border ${currentTier === tier.name
                    ? 'border-premium-accent ring-1 ring-premium-accent/20'
                    : 'border-white/5'
                    }`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                        <p className="text-premium-secondary uppercase tracking-wider text-sm font-bold">
                          {tier.limit}
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                        {index === 0 && <Zap className="w-6 h-6 text-white" />}
                        {index === 1 && <Shield className="w-6 h-6 text-white" />}
                        {index === 2 && <Info className="w-6 h-6 text-white" />}
                      </div>
                    </div>

                    <div className="mb-8">
                      <span className="text-4xl font-bold">${tier.price}</span>
                      <span className="text-premium-secondary ml-2">/month</span>
                    </div>

                    <ul className="space-y-4 mb-8 flex-1">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-premium-accent shrink-0 mt-0.5" />
                          <span className="text-premium-secondary text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleTierSelect(tier)}
                      disabled={currentTier === tier.name}
                      className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${currentTier === tier.name
                        ? 'bg-white/5 text-premium-secondary cursor-not-allowed'
                        : tier.popular
                          ? 'bg-premium-accent text-premium-bg hover:shadow-lg hover:shadow-premium-accent/20 active:scale-95'
                          : 'bg-white/10 text-premium-text hover:bg-white/15 active:scale-95'
                        }`}
                    >
                      {currentTier === tier.name ? (
                        'Current Plan'
                      ) : (
                        <>
                          Upgrade to {tier.name}
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <PaymentForm
              tier={selectedTier}
              onBack={handleBackToSelection}
              onSuccess={handlePaymentSuccess}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Upgrade;
