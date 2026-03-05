import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { webauthnLoginOptions, webauthnLoginVerify } from '../api';
import { generateKeyPair, exportKey, wrapPrivateKey } from '../crypto';
import { Fingerprint } from 'lucide-react';

const Login = ({ setToken }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('user@ses');
    const [password, setPassword] = useState('6d2a4116efe183555acaaaaaf3307bba');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const endpoint = isLogin ? '/api/login' : '/api/register';
            let payload = { username, password };

            if (!isLogin) {
                const keyPair = await generateKeyPair();
                const pubKeyJwk = await exportKey(keyPair.publicKey);
                const privKeyJwk = await exportKey(keyPair.privateKey);
                const wrappedPrivKey = await wrapPrivateKey(privKeyJwk, password);

                payload.public_key = pubKeyJwk;
                payload.encrypted_private_key = wrappedPrivKey;
            }

            const response = await api.post(endpoint, payload);
            const data = response.data;

            if (isLogin) {
                localStorage.setItem('token', data.access_token);
                if (setToken) setToken(data.access_token);
                navigate('/dashboard');
            } else {
                setSuccess('Account created! Please login.');
                setIsLogin(true);
                setError('');
            }
        } catch (err) {
            console.error('Registration/Login Error:', err);
            setError(err.response?.data?.detail || 'Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricLogin = async () => {
        if (!username) {
            setError('Please enter your username first');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const { data: options } = await webauthnLoginOptions(username);

            // Helper to handle base64url to buffer
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
                allowCredentials: options.allowCredentials.map(c => ({
                    ...c,
                    id: base64ToBuffer(c.id)
                }))
            };

            const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });

            const response = {
                id: assertion.id,
                rawId: bufferToBase64(assertion.rawId),
                type: assertion.type,
                response: {
                    authenticatorData: bufferToBase64(assertion.response.authenticatorData),
                    clientDataJSON: bufferToBase64(assertion.response.clientDataJSON),
                    signature: bufferToBase64(assertion.response.signature),
                    userHandle: assertion.response.userHandle ? bufferToBase64(assertion.response.userHandle) : null
                }
            };

            const { data } = await webauthnLoginVerify(username, response);
            localStorage.setItem('token', data.access_token);
            if (setToken) setToken(data.access_token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Biometric Login Error:', err);
            setError('Biometric authentication failed. Ensure you have registered a device.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-premium-bg text-premium-text flex items-center justify-center px-6 py-12 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-premium-accent/15 blur-3xl" />
                <div className="absolute -bottom-40 left-1/3 h-[450px] w-[700px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                <div className="glass-card p-10 border border-white/10">
                    <div className="text-center mb-8">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                            <span className="text-xl font-semibold">S</span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight">
                            {isLogin ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-premium-secondary mt-2">
                            {isLogin ? 'Sign in to your secure workspace' : 'Provision your cryptographic identity'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-premium-secondary">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="input-field"
                                placeholder="user@ses"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-premium-secondary">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="input-field"
                                placeholder="••••••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="premium-btn w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>

                    {isLogin && (
                        <div className="mt-4">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-premium-bg/50 px-2 text-premium-secondary font-black tracking-widest backdrop-blur-sm">OR</span>
                                </div>
                            </div>

                            <button
                                onClick={handleBiometricLogin}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-premium-accent/30 text-premium-accent font-bold hover:bg-premium-accent/5 transition-all text-sm uppercase tracking-widest"
                            >
                                <Fingerprint size={20} />
                                Biometric Login
                            </button>
                        </div>
                    )}

                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm font-semibold text-premium-accent hover:opacity-90 transition-opacity"
                        >
                            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                        </button>
                    </div>
                </div>

                <div className="mt-6 text-center text-xs text-premium-secondary">
                    By continuing, you agree to store keys locally and protect your master password.
                </div>
            </div>
        </div>
    );
};

export default Login;
