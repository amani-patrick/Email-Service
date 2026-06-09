import React, { useState, useEffect } from 'react';
import api from '../api';
import { motion } from 'framer-motion';
import { Users, Server, HardDrive, ShieldAlert, CheckCircle2, XCircle, Key, Calendar, Upload, AlertTriangle, FileText, Globe, Clock } from 'lucide-react';
import { clsx } from 'clsx';

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [license, setLicense] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [domains, setDomains] = useState([]);
    const [smtpStatus, setSmtpStatus] = useState(null);
    const [newDomain, setNewDomain] = useState('');
    const [activeTab, setActiveTab] = useState('users');

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                const [usersRes, licenseRes, auditRes, domainsRes, smtpRes] = await Promise.all([
                    api.get('/api/admin/users'),
                    api.get('/api/admin/license/status'),
                    api.get('/api/admin/audit-logs?limit=50'),
                    api.get('/api/domains'),
                    api.get('/api/smtp/status'),
                ]);
                setUsers(usersRes.data);
                setLicense(licenseRes.data);
                setAuditLogs(auditRes.data);
                setDomains(domainsRes.data);
                setSmtpStatus(smtpRes.data);
            } catch (err) {
                console.error('Failed to fetch admin data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAdminData();
    }, []);

    const handleLicenseUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const res = await api.post('/api/admin/license/upload', formData);
            setLicense(res.data);
        } catch (err) {
            alert('Failed to update license: ' + (err.response?.data?.detail || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleAddDomain = async (e) => {
        e.preventDefault();
        if (!newDomain.trim()) return;
        try {
            await api.post('/api/domains', newDomain.trim());
            const res = await api.get('/api/domains');
            setDomains(res.data);
            setNewDomain('');
        } catch (err) {
            alert('Failed to add domain: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleVerifyDomain = async (domainId) => {
        try {
            const res = await api.post(`/api/domains/${domainId}/verify`);
            alert(`Verification: MX=${res.data.mx}, SPF=${res.data.spf}, Verified=${res.data.verified}`);
            const list = await api.get('/api/domains');
            setDomains(list.data);
        } catch (err) {
            alert('Verification failed: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleShowDns = async (domainId) => {
        try {
            const res = await api.get(`/api/domains/${domainId}/dns-records`);
            alert(JSON.stringify(res.data.records, null, 2));
        } catch (err) {
            alert('Failed to fetch DNS records: ' + (err.response?.data?.detail || err.message));
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-8">
            <header className="pb-4 border-b border-white/5">
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <ShieldAlert className="text-red-500" /> Enterprise Management
                </h2>
                <p className="text-premium-secondary mt-1">System-wide overview and user management</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex flex-col gap-2">
                    <Users className="text-premium-accent w-6 h-6 mb-2" />
                    <p className="text-4xl font-bold">{users.length}</p>
                    <p className="text-premium-secondary text-sm">Total Registrations</p>
                </div>
                <div className="glass-card p-6 flex flex-col gap-2">
                    <Server className="text-purple-500 w-6 h-6 mb-2" />
                    <p className="text-4xl font-bold">1</p>
                    <p className="text-premium-secondary text-sm">Active Instances</p>
                </div>
                <div className="glass-card p-6 flex flex-col gap-2">
                    <HardDrive className="text-green-500 w-6 h-6 mb-2" />
                    <p className="text-4xl font-bold truncate">
                        {formatSize(users.reduce((acc, u) => acc + u.storage_used, 0))}
                    </p>
                    <p className="text-premium-secondary text-sm">Collective Storage Usage</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Key size={80} />
                    </div>
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Key className="text-premium-accent" /> Licensing Infrastructure
                    </h3>

                    {license && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-premium-secondary text-xs uppercase tracking-widest font-bold">Status</span>
                                <span className={clsx(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                                    license.status === 'Valid' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                )}>
                                    {license.status}
                                </span>
                            </div>

                            {license.data && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-premium-secondary text-sm">Customer</span>
                                        <span className="font-bold">{license.data.customer}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-premium-secondary text-sm">Provisioned Seats</span>
                                        <span className="font-bold">{license.data.seats} Identities</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-premium-secondary text-sm text-red-400">Expiration</span>
                                        <span className="font-mono text-xs">{new Date(license.data.expiry).toLocaleDateString()}</span>
                                    </div>
                                </>
                            )}

                            {license.error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs">
                                    <AlertTriangle size={16} />
                                    <span>{license.error}</span>
                                </div>
                            )}

                            <div className="pt-4">
                                <label className="premium-btn w-full flex items-center justify-center gap-2 cursor-pointer h-12 text-sm">
                                    <Upload size={16} />
                                    {uploading ? 'Processing Architecture...' : 'Upload Offline License'}
                                    <input type="file" className="hidden" onChange={handleLicenseUpload} accept=".lic" />
                                </label>
                                <p className="text-[10px] text-premium-secondary mt-3 text-center italic">
                                    Air-Gapped environments require manual cryptographic renewal.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="glass-card p-8">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Calendar className="text-purple-500" /> System Uptime
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-premium-secondary text-sm">API Node Status</span>
                            <span className="text-green-500 font-bold flex items-center gap-1.5"><CheckCircle2 size={14} /> Operational</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-premium-secondary text-sm">E2E Module</span>
                            <span className="text-green-500 font-bold flex items-center gap-1.5"><CheckCircle2 size={14} /> Encrypted</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-premium-secondary text-sm">SMTP Inbound</span>
                            <span className="text-green-500 font-bold flex items-center gap-1.5">
                                <CheckCircle2 size={14} /> Port {smtpStatus?.inbound_port || '2525'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-premium-secondary text-sm">Local Domains</span>
                            <span className="font-mono text-xs">{(smtpStatus?.local_domains || []).join(', ')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-premium-secondary text-sm">Outbound Relay</span>
                            <span className="font-mono text-xs">{smtpStatus?.relay_host || 'Direct MX'}</span>
                        </div>
                        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[11px] text-premium-secondary leading-relaxed">
                            <span className="text-blue-400 font-bold uppercase block mb-1">Compliance Note</span>
                            This instance is running in <strong>B2B/Gov Air-Gap Mode</strong>. Archive and disaster recovery rights are provisioned per SECTION 4 of the EULA.
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Domains */}
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/5 font-bold uppercase text-xs tracking-widest text-premium-secondary flex items-center gap-2">
                    <Globe size={16} /> Custom Domains (SMTP Phase 1)
                </div>
                <div className="p-6 space-y-4">
                    <form onSubmit={handleAddDomain} className="flex gap-3">
                        <input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="mail.example.gov"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                        <button type="submit" className="premium-btn px-6 py-2 text-sm">Add Domain</button>
                    </form>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-xs text-premium-secondary uppercase border-b border-white/5">
                                    <th className="py-3 pr-4">Domain</th>
                                    <th className="py-3 pr-4">Owner</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {domains.map((d) => (
                                    <tr key={d.id} className="border-b border-white/5">
                                        <td className="py-3 pr-4 font-mono">{d.domain}</td>
                                        <td className="py-3 pr-4 text-premium-secondary">{d.owner_username}</td>
                                        <td className="py-3 pr-4">
                                            {d.verified ? (
                                                <span className="text-green-400 text-xs font-bold">VERIFIED</span>
                                            ) : (
                                                <span className="text-amber-400 text-xs font-bold">PENDING DNS</span>
                                            )}
                                        </td>
                                        <td className="py-3 flex gap-2">
                                            <button onClick={() => handleShowDns(d.id)} className="text-xs text-premium-accent hover:underline">DNS Records</button>
                                            <button onClick={() => handleVerifyDomain(d.id)} className="text-xs text-green-400 hover:underline">Verify</button>
                                        </td>
                                    </tr>
                                ))}
                                {domains.length === 0 && (
                                    <tr><td colSpan={4} className="py-6 text-center text-premium-secondary">No custom domains configured</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/5 font-bold uppercase text-xs tracking-widest text-premium-secondary">
                    User Database
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs text-premium-secondary uppercase border-b border-white/5">
                                <th className="px-6 py-4">User Identity</th>
                                <th className="px-6 py-4">Subscription</th>
                                <th className="px-6 py-4">Storage Metrics</th>
                                <th className="px-6 py-4">Access Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium">{user.username}</td>
                                    <td className="px-6 py-4">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                            user.tier === 'Pro' ? "bg-premium-accent/20 text-premium-accent" : "bg-white/10 text-premium-secondary"
                                        )}>
                                            {user.tier}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                                            <div
                                                className="h-full bg-premium-accent"
                                                style={{ width: `${Math.min((user.storage_used / user.storage_limit) * 100, 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-premium-secondary">
                                            {formatSize(user.storage_used)} of {formatSize(user.storage_limit)}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.is_admin ? (
                                            <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold uppercase">
                                                <ShieldAlert size={14} /> Global Administrator
                                            </span>
                                        ) : (
                                            <span className="text-premium-secondary text-xs uppercase">Standard User</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audit Logs Section */}
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/5 font-bold uppercase text-xs tracking-widest text-premium-secondary flex items-center gap-2">
                    <FileText size={16} /> Audit Logs
                </div>
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs text-premium-secondary uppercase border-b border-white/5 sticky top-0 bg-premium-bg">
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Actor</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Target</th>
                                <th className="px-6 py-4">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLogs.map((log) => (
                                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-sm">
                                    <td className="px-6 py-3 font-mono text-xs">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3">{log.actor_username}</td>
                                    <td className="px-6 py-3">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                            log.action.includes('revoked') || log.action.includes('deleted') 
                                                ? "bg-red-500/20 text-red-400"
                                                : log.action.includes('created') || log.action.includes('registered')
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-blue-500/20 text-blue-400"
                                        )}>
                                            {log.action.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-premium-secondary">{log.target || '-'}</td>
                                    <td className="px-6 py-3 text-premium-secondary font-mono text-xs">{log.ip_address || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );


export default AdminDashboard;
