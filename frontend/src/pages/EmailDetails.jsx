import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Calendar, User, ShieldCheck, Mail, Printer, Trash2, Lock, Unlock, ShieldAlert, Loader2, Download, File, Paperclip } from 'lucide-react';
import { importKey, unwrapPrivateKey, decryptMessage, importFileKey, decryptFile } from '../crypto';

const EmailDetails = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [decryptedData, setDecryptedData] = useState(null);
    const [password, setPassword] = useState('');
    const [decrypting, setDecrypting] = useState(false);
    const [error, setError] = useState(null);
    const [privateKey, setPrivateKey] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);

    useEffect(() => {
        const fetchEmail = async () => {
            try {
                const res = await api.get(`/api/email/${id}`);
                setEmail(res.data);
                if (!res.data.read) {
                    api.post(`/api/mark_read/${id}`);
                }
            } catch (err) {
                console.error('Failed to fetch email', err);
            } finally {
                setLoading(false);
            }
        };
        fetchEmail();
    }, [id]);

    const handleDecrypt = async (e) => {
        if (e) e.preventDefault();
        setDecrypting(true);
        setError(null);
        try {
            const unwrappedJwk = await unwrapPrivateKey(user.encrypted_private_key, password);
            const privKey = await importKey(unwrappedJwk, 'private');
            setPrivateKey(privKey);

            if (email.data.includes('---BEGIN ENCRYPTED MESSAGE---')) {
                const encryptedContent = email.data.split('---BEGIN ENCRYPTED MESSAGE---\n')[1].split('\n---END ENCRYPTED MESSAGE---')[0];
                const decrypted = await decryptMessage(privKey, encryptedContent);
                setDecryptedData(decrypted);
            }
        } catch (err) {
            console.error('Decryption failed', err);
            setError('Decryption failed. Please check your master password.');
        } finally {
            setDecrypting(false);
        }
    };

    const handleDownload = async (attachment) => {
        if (!privateKey && !password) {
            setError('Please provide your master password first to decrypt files.');
            return;
        }

        setDownloadingId(attachment.uuid);
        try {
            let activePrivKey = privateKey;
            if (!activePrivKey) {
                const unwrappedJwk = await unwrapPrivateKey(user.encrypted_private_key, password);
                activePrivKey = await importKey(unwrappedJwk, 'private');
                setPrivateKey(activePrivKey);
            }

            const res = await api.get(`/api/download/${attachment.uuid}`, { responseType: 'arraybuffer' });
            let finalData = res.data;

            if (attachment.encrypted_key) {
                const aesKey = await importFileKey(activePrivKey, attachment.encrypted_key);
                finalData = await decryptFile(aesKey, new Uint8Array(res.data));
            }

            const blob = new Blob([finalData], { type: attachment.mime_type });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed', err);
            alert('Failed to decrypt and download file.');
        } finally {
            setDownloadingId(null);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-premium-accent border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!email) return <div className="text-center py-20 text-premium-secondary">Message not found.</div>;

    const isEncrypted = email.data.includes('---BEGIN ENCRYPTED MESSAGE---');
    const needsPassword = (isEncrypted && !decryptedData) || (email.attachments?.length > 0 && !privateKey);

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <button
                onClick={() => navigate('/inbox')}
                className="flex items-center gap-2 text-premium-secondary hover:text-white transition-colors mb-8 group"
            >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Back to Inbox
            </button>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden border border-white/5 shadow-2xl"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-white/5 backdrop-blur-xl">
                    <div className="flex items-start justify-between mb-8">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight leading-tight flex items-center gap-2">
                                {isEncrypted && !decryptedData ? <Lock className="text-premium-accent" size={24} /> : <Mail className="text-premium-accent" size={24} />}
                                Secure Message: {email.uuid.split('-')[0]}
                            </h1>
                            <p className="text-xs text-premium-secondary uppercase tracking-widest font-mono">Reference ID: {email.uuid}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-white/10 rounded-lg text-premium-secondary transition-colors"><Printer size={20} /></button>
                            <button className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"><Trash2 size={20} /></button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-6 items-center text-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-premium-accent text-premium-bg flex items-center justify-center font-bold">
                                {email.sender_username[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-premium-secondary text-[10px] uppercase font-bold tracking-wider">Sender Identity</p>
                                <p className="font-semibold">{email.sender_username}</p>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-white/10 hidden md:block" />

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-premium-secondary border border-white/5">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-premium-secondary text-[10px] uppercase font-bold tracking-wider">Arrival Time</p>
                                <p className="font-semibold">{new Date(email.time * 1000).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg border border-green-500/20">
                            <ShieldCheck size={16} />
                            <span className="text-xs font-bold uppercase tracking-wide">Signature Validated</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {needsPassword ? (
                        <div className="bg-premium-bg/80 backdrop-blur-sm rounded-2xl border border-premium-accent/20 p-12 text-center space-y-6">
                            <div className="flex justify-center">
                                <div className="w-20 h-20 bg-premium-accent/10 rounded-full flex items-center justify-center text-premium-accent mb-2">
                                    <ShieldAlert size={40} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold">Local Decryption Required</h3>
                                <p className="text-premium-secondary max-w-sm mx-auto">Payload is encrypted with Zero-Knowledge protocols. Input master password to unlock.</p>
                            </div>

                            <form onSubmit={handleDecrypt} className="max-w-xs mx-auto space-y-4">
                                <input
                                    type="password"
                                    required
                                    placeholder="Master Password"
                                    className="input-field text-center"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError(null);
                                    }}
                                />
                                {error && <p className="text-xs text-red-400 font-bold uppercase">{error}</p>}
                                <button
                                    type="submit"
                                    disabled={decrypting}
                                    className="premium-btn w-full flex items-center justify-center gap-2"
                                >
                                    {decrypting ? <Loader2 className="animate-spin" size={18} /> : <><Unlock size={18} /> Decrypt Archive</>}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="prose prose-invert max-w-none">
                                <div className="bg-premium-bg/50 p-8 rounded-2xl border border-white/5 font-mono text-sm whitespace-pre-wrap leading-relaxed shadow-inner">
                                    {decryptedData || email.data}
                                </div>
                                {decryptedData && (
                                    <div className="mt-4 flex items-center gap-2 text-xs text-green-500 font-bold uppercase tracking-widest">
                                        <Unlock size={14} /> Local WebCrypto Decryption Success
                                    </div>
                                )}
                            </div>

                            {email.attachments?.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-premium-secondary flex items-center gap-2 uppercase tracking-widest">
                                        <Paperclip size={16} /> Secured File Drive ({email.attachments.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {email.attachments.map((file) => (
                                            <div key={file.uuid} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group hover:border-premium-accent/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-3 bg-premium-accent/10 rounded-xl text-premium-accent">
                                                        <File size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold truncate max-w-[180px]">{file.filename}</p>
                                                        <p className="text-[10px] text-premium-secondary uppercase font-bold">{(file.size / 1024).toFixed(1)} KB • {file.encrypted_key ? 'Encrypted' : 'Plaintext'}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDownload(file)}
                                                    disabled={downloadingId === file.uuid}
                                                    className="p-3 bg-white/5 hover:bg-premium-accent hover:text-premium-bg rounded-xl transition-all"
                                                >
                                                    {downloadingId === file.uuid ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default EmailDetails;
