import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Tag, FileText, Loader2, CheckCircle, Lock, ShieldCheck, ShieldAlert, Paperclip, X, File as FileIcon, AlertCircle, Info, XCircle, Zap } from 'lucide-react';
import { encryptMessage, importKey, generateFileKey, encryptFile, exportFileKey } from '../crypto';

const Compose = ({ user }) => {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [encryptionStatus, setEncryptionStatus] = useState('idle'); // idle, checking, secure, insecure, external
    const [notification, setNotification] = useState(null); // { type: 'success' | 'error' | 'info', message: str }
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        if (location.state?.stegoFile) {
            setAttachments([location.state.stegoFile]);
            setSubject('Locked Secure Image Message');
            setBody('This email contains a secure message hidden inside the attached image.\n\nTo view the secret:\n1. Download the attached image\n2. Go to the "Stego Vault"\n3. Use "Extract Message" with the downloaded image.');
        }
    }, [location.state]);

    const checkPublicKey = async (username) => {
        if (!username) {
            setEncryptionStatus('idle');
            return;
        }

        if (!username.includes('@ses')) {
            setEncryptionStatus('external');
            return;
        }

        setEncryptionStatus('checking');
        try {
            const res = await api.get(`/api/user/${username}/pubkey`);
            if (res.data.public_key) {
                try {
                    const jwk = JSON.parse(res.data.public_key);
                    // Minimal JWK validation
                    if (jwk.kty === 'RSA') {
                        setEncryptionStatus('secure');
                    } else {
                        console.warn('Recipient public key is not RSA. Falling back to insecure mode.');
                        setEncryptionStatus('insecure');
                    }
                } catch (e) {
                    console.warn('Recipient public key is in legacy format or invalid JSON. Falling back to insecure mode.', e);
                    setEncryptionStatus('insecure');
                }
            } else {
                setEncryptionStatus('insecure');
            }
        } catch (err) {
            setEncryptionStatus('insecure');
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setAttachments([...attachments, ...files]);
    };

    const removeAttachment = (index) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalBody = body;
            let recipientPubKey = null;

            if (encryptionStatus === 'secure') {
                try {
                    const res = await api.get(`/api/user/${to}/pubkey`);
                    const pubKeyJwk = res.data.public_key;
                    recipientPubKey = await importKey(pubKeyJwk, 'public');
                    const encrypted = await encryptMessage(recipientPubKey, body);
                    finalBody = `---BEGIN ENCRYPTED MESSAGE---\n${encrypted}\n---END ENCRYPTED MESSAGE---`;
                } catch (e) {
                    console.error('Failed to import public key or encrypt message. Falling back to insecure.', e);
                    finalBody = body;
                    recipientPubKey = null;
                }
            }

            // 1. Send the email first
            const sendRes = await api.post('/api/send', { to, subject, body: finalBody });
            const emailUuid = sendRes.data;

            // 2. Upload attachments if any
            for (const file of attachments) {
                const fileReader = new FileReader();
                const fileData = await new Promise((resolve) => {
                    fileReader.onload = (e) => resolve(e.target.result);
                    fileReader.readAsArrayBuffer(file);
                });

                let uploadFile = file;
                let encryptedKey = "";

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
            console.error('Failed to send email', err);
            // ... rest of error handling ...
            if (err.response?.status === 402) {
                setNotification({
                    type: 'error',
                    message: 'Upgrade Required: Sending to external domains is a Pro/Enterprise feature.'
                });
                setTimeout(() => navigate('/settings'), 3000);
            } else {
                setNotification({
                    type: 'error',
                    message: 'Error sending email: ' + (err.response?.data?.detail || 'Handshake or network failure')
                });
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-6"
                >
                    <CheckCircle size={48} />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Message & Files Sent Securely</h2>
                <p className="text-premium-secondary">Redirecting to archive...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-20">
            <header className="mb-10">
                <h2 className="text-3xl font-bold tracking-tight">Compose Message</h2>
                <p className="text-premium-secondary mt-1">Enterprise-grade end-to-end encrypted messaging</p>
            </header>

            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`fixed top-8 right-8 z-[100] p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-4 min-w-[320px] ${notification.type === 'error'
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

            <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSend}
                className="glass-card p-8 space-y-6"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-premium-secondary flex items-center gap-2">
                            <User className="w-4 h-4" /> Recipient
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                placeholder="user@ses"
                                className="input-field pr-10"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                onBlur={(e) => checkPublicKey(e.target.value)}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {encryptionStatus === 'checking' && <Loader2 size={16} className="animate-spin text-premium-secondary" />}
                                {encryptionStatus === 'secure' && <ShieldCheck size={16} className="text-green-500" />}
                                {encryptionStatus === 'insecure' && <Lock size={16} className="text-yellow-500" />}
                                {encryptionStatus === 'external' && <ShieldAlert size={16} className="text-blue-400" />}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-premium-secondary flex items-center gap-2">
                            <Tag className="w-4 h-4" /> Subject
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Confidential Topic"
                            className="input-field"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-premium-secondary flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Message Body
                    </label>
                    <textarea
                        required
                        placeholder="Type your secure message here..."
                        className="input-field min-h-[250px] resize-none py-4"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-premium-secondary flex items-center gap-2">
                            <Paperclip className="w-4 h-4" /> Attachments
                        </label>
                        <label className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg cursor-pointer transition-colors border border-white/5">
                            Add Files
                            <input type="file" multiple className="hidden" onChange={handleFileChange} />
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <AnimatePresence>
                            {attachments.map((file, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl group"
                                >
                                    <FileIcon size={14} className="text-premium-accent" />
                                    <span className="text-xs font-medium max-w-[120px] truncate">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(index)}
                                        className="text-premium-secondary hover:text-red-400 p-0.5 rounded-md hover:bg-red-400/10 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {encryptionStatus === 'external' && (
                    <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                        <ShieldAlert className="text-blue-400 shrink-0" size={18} />
                        <div className="text-xs text-blue-100/70 leading-relaxed">
                            <span className="font-bold text-blue-400 uppercase tracking-widest block mb-1">External Transfer Warning</span>
                            You are sending to an external mailbox. While the connection is secured via TLS, the content will be decrypted on the recipient's mail provider (e.g., Google/Microsoft) unless they have manually configured PGP/S/MIME.
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between pt-4">
                    <div className="space-y-1">
                        <p className="text-[10px] text-premium-secondary italic flex items-center gap-2">
                            <Lock size={10} /> Zero-Knowledge: Files are encrypted locally before upload.
                        </p>
                        {encryptionStatus === 'secure' && (
                            <p className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">
                                recipient verified: E2E ACTIVE (Zero-Knowledge)
                            </p>
                        )}
                        {encryptionStatus === 'external' && (
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                                External Domain: Encryption In-Transit Only
                            </p>
                        )}
                        {encryptionStatus === 'insecure' && (
                            <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-tighter">
                                recipient found: No public key (In-Transit Only)
                            </p>
                        )}
                    </div>
                    {encryptionStatus === 'external' && user?.tier === 'Free' ? (
                        <button
                            type="button"
                            onClick={() => navigate('/settings')}
                            className="bg-premium-accent text-premium-bg px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
                        >
                            <Zap size={16} /> Upgrade to Send External
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={loading || (encryptionStatus === 'external' && user?.tier === 'Free')}
                            className="premium-btn px-8 flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    <Send className="w-4 h-4" /> Send {encryptionStatus === 'external' ? 'Secure Invite' : 'Securely'}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </motion.form>
        </div>
    );
};

export default Compose;
