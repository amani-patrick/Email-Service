import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Tag, FileText, Loader2, CheckCircle, Lock, ShieldCheck, ShieldAlert, Paperclip, X, File as FileIcon, AlertCircle, Info, XCircle, Zap, Key, Copy, Link2 } from 'lucide-react';
import { encryptMessage, importKey, generateFileKey, encryptFile, exportFileKey, encryptWithSecret, generateSharedSecret } from '../crypto';

const Compose = ({ user }) => {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [encryptionStatus, setEncryptionStatus] = useState('idle');
    const [notification, setNotification] = useState(null);
    const [sharedSecret, setSharedSecret] = useState('');
    const [secretHint, setSecretHint] = useState('');
    const [externalResult, setExternalResult] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        if (location.state?.stegoFile) {
            setAttachments([location.state.stegoFile]);
            setSubject('Locked Secure Image Message');
            setBody('This email contains a secure message hidden inside the attached image.\n\nTo view the secret:\n1. Download the attached image\n2. Go to the "Stego Vault"\n3. Use "Extract Message" with the downloaded image.');
        }
    }, [location.state]);

    const checkRouting = async (email) => {
        if (!email || !email.includes('@')) {
            setEncryptionStatus('idle');
            return;
        }
        setEncryptionStatus('checking');
        try {
            const res = await api.get(`/api/routing/${encodeURIComponent(email.trim().toLowerCase())}`);
            const mode = res.data.encryption;
            if (mode === 'e2e') setEncryptionStatus('secure');
            else if (mode === 'secure_link') {
                setEncryptionStatus('external');
                if (!sharedSecret) setSharedSecret(generateSharedSecret());
            } else if (res.data.type === 'local') setEncryptionStatus('insecure');
            else setEncryptionStatus('idle');
        } catch {
            setEncryptionStatus('insecure');
        }
    };

    const handleFileChange = (e) => {
        setAttachments([...attachments, ...Array.from(e.target.files)]);
    };

    const removeAttachment = (index) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setNotification({ type: 'info', message: 'Copied to clipboard' });
    };

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (encryptionStatus === 'external') {
                if (!sharedSecret.trim()) {
                    setNotification({ type: 'error', message: 'Set a shared secret for the recipient.' });
                    return;
                }
                const attachmentData = [];
                for (const file of attachments) {
                    const buf = await file.arrayBuffer();
                    attachmentData.push({
                        filename: file.name,
                        mime: file.type,
                        data: btoa(String.fromCharCode(...new Uint8Array(buf))),
                    });
                }
                const payload = JSON.stringify({ subject, body, attachments: attachmentData });
                const encrypted_payload = await encryptWithSecret(sharedSecret, payload);
                const res = await api.post('/api/external/send', {
                    to: to.trim().toLowerCase(),
                    encrypted_payload,
                    hint: secretHint,
                });
                setExternalResult(res.data);
                setSuccess(true);
                return;
            }

            let finalBody = body;
            let recipientPubKey = null;

            if (encryptionStatus === 'secure') {
                const res = await api.get(`/api/user/${to}/pubkey`);
                recipientPubKey = await importKey(res.data.public_key, 'public');
                const encrypted = await encryptMessage(recipientPubKey, body);
                finalBody = `---BEGIN ENCRYPTED MESSAGE---\n${encrypted}\n---END ENCRYPTED MESSAGE---`;
            }

            const sendRes = await api.post('/api/send', { to, subject, body: finalBody });
            const emailUuid = sendRes.data;

            for (const file of attachments) {
                const fileReader = new FileReader();
                const fileData = await new Promise((resolve) => {
                    fileReader.onload = (ev) => resolve(ev.target.result);
                    fileReader.readAsArrayBuffer(file);
                });

                let uploadFile = file;
                let encryptedKey = '';
                if (recipientPubKey) {
                    const aesKey = await generateFileKey();
                    const encryptedData = await encryptFile(aesKey, fileData);
                    encryptedKey = await exportFileKey(recipientPubKey, aesKey);
                    uploadFile = new File([encryptedData], file.name, { type: 'application/octet-stream' });
                }

                const formData = new FormData();
                formData.append('email_uuid', emailUuid);
                formData.append('encrypted_key', encryptedKey);
                formData.append('file', uploadFile);
                await api.post('/api/upload', formData);
            }

            setSuccess(true);
            setTimeout(() => navigate('/inbox'), 2000);
        } catch (err) {
            if (err.response?.status === 402) {
                setNotification({ type: 'error', message: 'Upgrade Required: Secure external delivery needs Pro/Enterprise.' });
                setTimeout(() => navigate('/upgrade'), 3000);
            } else {
                setNotification({ type: 'error', message: err.response?.data?.detail || 'Send failed' });
            }
        } finally {
            setLoading(false);
        }
    };

    if (success && externalResult) {
        return (
            <div className="max-w-xl mx-auto py-16 space-y-6">
                <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold">Secure Invite Sent</h2>
                    <p className="text-premium-secondary mt-2">Share the secret separately — it was never sent to our servers.</p>
                </div>
                <div className="glass-card p-6 space-y-4">
                    <div>
                        <p className="text-xs text-premium-secondary uppercase tracking-widest mb-1">Shared Secret (give to recipient)</p>
                        <div className="flex gap-2">
                            <code className="flex-1 bg-black/30 p-3 rounded-lg font-mono text-sm break-all">{sharedSecret}</code>
                            <button type="button" onClick={() => copyToClipboard(sharedSecret)} className="p-3 bg-white/5 rounded-lg hover:bg-white/10"><Copy size={16} /></button>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-premium-secondary uppercase tracking-widest mb-1">Viewer Link (emailed to recipient)</p>
                        <div className="flex gap-2">
                            <code className="flex-1 bg-black/30 p-3 rounded-lg font-mono text-xs break-all">{externalResult.viewer_url}</code>
                            <button type="button" onClick={() => copyToClipboard(externalResult.viewer_url)} className="p-3 bg-white/5 rounded-lg hover:bg-white/10"><Copy size={16} /></button>
                        </div>
                    </div>
                    <p className="text-xs text-premium-secondary">Expires: {new Date(externalResult.expires).toLocaleString()}</p>
                </div>
                <button onClick={() => navigate('/external-sent')} className="premium-btn w-full py-3">View Sent Secure Invites</button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <CheckCircle size={48} className="text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Message Sent Securely</h2>
                <p className="text-premium-secondary">Redirecting to inbox...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-20">
            <header className="mb-10">
                <h2 className="text-3xl font-bold tracking-tight">Compose Message</h2>
                <p className="text-premium-secondary mt-1">Internal E2E or secure external invites — zero-knowledge by default</p>
            </header>

            <AnimatePresence>
                {notification && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mb-4 p-4 rounded-xl bg-premium-accent/10 border border-premium-accent/20 text-sm flex justify-between items-center">
                        {notification.message}
                        <button onClick={() => setNotification(null)}><X size={16} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            <form onSubmit={handleSend} className="glass-card p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-premium-secondary flex items-center gap-2"><User size={16} /> Recipient</label>
                        <div className="relative">
                            <input type="email" required className="input-field pr-10" value={to} onChange={(e) => setTo(e.target.value)} onBlur={(e) => checkRouting(e.target.value)} placeholder="user@domain.com" />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {encryptionStatus === 'checking' && <Loader2 size={16} className="animate-spin" />}
                                {encryptionStatus === 'secure' && <ShieldCheck size={16} className="text-green-500" />}
                                {encryptionStatus === 'insecure' && <Lock size={16} className="text-yellow-500" />}
                                {encryptionStatus === 'external' && <Link2 size={16} className="text-blue-400" />}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-premium-secondary flex items-center gap-2"><Tag size={16} /> Subject</label>
                        <input type="text" required className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                </div>

                {encryptionStatus === 'external' && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-4">
                        <p className="text-xs text-blue-300 leading-relaxed">
                            <ShieldAlert size={14} className="inline mr-1" />
                            External secure delivery: message encrypted in your browser. Recipient gets a link + needs the shared secret you provide separately.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-premium-secondary flex items-center gap-1 mb-1"><Key size={12} /> Shared Secret</label>
                                <div className="flex gap-2">
                                    <input type="text" required className="input-field font-mono text-sm" value={sharedSecret} onChange={(e) => setSharedSecret(e.target.value)} />
                                    <button type="button" onClick={() => setSharedSecret(generateSharedSecret())} className="px-3 bg-white/5 rounded-lg text-xs">Generate</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-premium-secondary mb-1 block">Hint (optional, not the secret)</label>
                                <input type="text" className="input-field text-sm" value={secretHint} onChange={(e) => setSecretHint(e.target.value)} placeholder="e.g. project codename" />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium text-premium-secondary flex items-center gap-2"><FileText size={16} /> Message</label>
                    <textarea required className="input-field min-h-[220px] resize-none" value={body} onChange={(e) => setBody(e.target.value)} />
                </div>

                <div className="flex flex-wrap gap-3">
                    {attachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl text-xs">
                            <FileIcon size={14} /> {file.name}
                            <button type="button" onClick={() => removeAttachment(i)}><X size={14} /></button>
                        </div>
                    ))}
                    <label className="text-xs bg-white/5 px-3 py-2 rounded-lg cursor-pointer border border-white/5">
                        Add Files <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>
                </div>

                <div className="flex items-center justify-between pt-4">
                    <p className="text-[10px] text-premium-secondary">
                        {encryptionStatus === 'secure' && <span className="text-green-500 font-bold">E2E ACTIVE</span>}
                        {encryptionStatus === 'external' && <span className="text-blue-400 font-bold">SECURE LINK + PASSPHRASE</span>}
                        {encryptionStatus === 'insecure' && <span className="text-yellow-500 font-bold">IN-TRANSIT ONLY</span>}
                    </p>
                    {encryptionStatus === 'external' && user?.tier === 'Free' ? (
                        <button type="button" onClick={() => navigate('/upgrade')} className="premium-btn px-8 py-3 flex items-center gap-2"><Zap size={16} /> Upgrade to Send</button>
                    ) : (
                        <button type="submit" disabled={loading || (encryptionStatus === 'external' && user?.tier === 'Free')} className="premium-btn px-8 flex items-center gap-2">
                            {loading ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                            {encryptionStatus === 'external' ? 'Send Secure Invite' : 'Send Securely'}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default Compose;
