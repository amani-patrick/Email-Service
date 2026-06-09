import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Lock, Shield, Loader2, AlertCircle, CheckCircle, Key } from 'lucide-react';
import { decryptWithSecret } from '../crypto';

const api = axios.create({ baseURL: '' });

const ExternalView = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [meta, setMeta] = useState(null);
    const [secret, setSecret] = useState('');
    const [decrypted, setDecrypted] = useState(null);
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get(`/api/external/view/${token}`);
                setMeta(res.data);
            } catch (err) {
                setError(err.response?.data?.detail || 'This secure link is invalid or has expired.');
            } finally {
                setLoading(false);
            }
        };
        if (token) load();
    }, [token]);

    const handleUnlock = async (e) => {
        e.preventDefault();
        setUnlocking(true);
        setUnlockError(null);
        try {
            const plaintext = await decryptWithSecret(secret, meta.encrypted_payload);
            const parsed = JSON.parse(plaintext);
            setDecrypted(parsed);
            await api.post(`/api/external/view/${token}/opened`);
        } catch {
            setUnlockError('Incorrect shared secret or corrupted message.');
        } finally {
            setUnlocking(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-premium-bg flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-premium-accent animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-premium-bg flex items-center justify-center p-6">
                <div className="glass-card max-w-md w-full p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Link Unavailable</h1>
                    <p className="text-premium-secondary text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (decrypted) {
        return (
            <div className="min-h-screen bg-premium-bg p-6">
                <div className="max-w-2xl mx-auto glass-card p-8 space-y-6">
                    <div className="flex items-center gap-3 text-green-400">
                        <CheckCircle size={24} />
                        <span className="font-bold uppercase text-xs tracking-widest">Decrypted locally in your browser</span>
                    </div>
                    <div>
                        <p className="text-xs text-premium-secondary uppercase tracking-widest mb-1">From</p>
                        <p className="font-mono">{meta.sender}</p>
                    </div>
                    <div>
                        <p className="text-xs text-premium-secondary uppercase tracking-widest mb-1">Subject</p>
                        <p className="text-xl font-semibold">{decrypted.subject}</p>
                    </div>
                    <div className="border-t border-white/10 pt-6">
                        <p className="whitespace-pre-wrap leading-relaxed">{decrypted.body}</p>
                    </div>
                    {decrypted.attachments?.length > 0 && (
                        <div className="border-t border-white/10 pt-4 space-y-2">
                            <p className="text-xs uppercase tracking-widest text-premium-secondary">Attachments</p>
                            {decrypted.attachments.map((att, i) => (
                                <a
                                    key={i}
                                    href={`data:${att.mime};base64,${att.data}`}
                                    download={att.filename}
                                    className="block text-sm text-premium-accent hover:underline"
                                >
                                    {att.filename}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-premium-bg flex items-center justify-center p-6">
            <div className="max-w-md w-full glass-card p-8 space-y-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-premium-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Shield className="text-premium-accent" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold">Secure Message</h1>
                    <p className="text-premium-secondary text-sm mt-2">
                        From <span className="font-mono text-white">{meta.sender}</span>
                    </p>
                    <p className="text-[10px] text-premium-secondary mt-1">
                        Expires {new Date(meta.expires_at).toLocaleString()}
                    </p>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-100/80 leading-relaxed flex gap-2">
                    <Lock size={16} className="shrink-0 text-blue-400" />
                    <span>
                        This message is encrypted. SecureMail cannot read it. Enter the shared secret the sender gave you.
                    </span>
                </div>

                {meta.hint && (
                    <p className="text-xs text-premium-secondary">
                        <Key size={12} className="inline mr-1" />
                        Hint: {meta.hint}
                    </p>
                )}

                <form onSubmit={handleUnlock} className="space-y-4">
                    <input
                        type="password"
                        required
                        placeholder="Shared secret"
                        className="input-field w-full"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        autoComplete="off"
                    />
                    {unlockError && (
                        <p className="text-red-400 text-xs">{unlockError}</p>
                    )}
                    <button
                        type="submit"
                        disabled={unlocking}
                        className="premium-btn w-full py-3 flex items-center justify-center gap-2"
                    >
                        {unlocking ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                        Decrypt Message
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ExternalView;
