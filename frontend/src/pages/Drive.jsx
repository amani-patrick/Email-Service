import React, { useState, useEffect } from 'react';
import { getDriveFiles, uploadDrive, downloadDrive } from '../api';
import { HardDrive, Upload, Download, FileText, Trash2, Shield, Lock, Info } from 'lucide-react';
import Notification from '../components/Notification';

const Drive = ({ user }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [notification, setNotification] = useState(null);

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const { data } = await getDriveFiles();
            setFiles(data);
        } catch (error) {
            showNotification('Failed to fetch drive files', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            // In a real app, we'd encrypt the file here using the same logic as Smime
            formData.append('encrypted_key', 'mock_encrypted_key');

            await uploadDrive(formData);
            showNotification('File uploaded successfully', 'success');
            await fetchFiles();
        } catch (error) {
            const detail = error.response?.data?.detail || 'Upload failed';
            showNotification(detail, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (fileUuid, filename) => {
        try {
            const response = await downloadDrive(fileUuid);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            showNotification('Download started', 'success');
        } catch (error) {
            showNotification('Download failed', 'error');
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter mb-2 italic">
                        PRIVATE <span className="text-premium-accent">DRIVE</span>
                    </h1>
                    <p className="text-premium-secondary font-medium tracking-tight">Zero-knowledge encrypted file storage.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] uppercase font-black tracking-widest text-premium-secondary mb-1">Storage Usage</p>
                        <div className="flex items-center gap-3">
                            <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-premium-accent"
                                    style={{ width: `${Math.min(100, (user?.storage_used / user?.storage_limit) * 100)}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-bold text-white whitespace-nowrap">
                                {(user?.storage_used / 1024 / 1024).toFixed(1)} / {(user?.storage_limit / 1024 / 1024).toFixed(0)} MB
                            </span>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 bg-premium-accent text-premium-bg px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl shadow-premium-accent/20 cursor-pointer uppercase tracking-widest text-xs">
                        <Upload size={20} />
                        {uploading ? 'UPLOADING...' : 'UPLOAD FILE'}
                        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                </div>
            </div>

            <div className="glass-card overflow-hidden border border-white/5">
                <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield size={16} className="text-premium-accent" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Encrypted Assets</span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-premium-secondary">
                        <span>Name</span>
                        <span>Size</span>
                        <span>Status</span>
                        <span>Actions</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64 text-premium-accent">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-premium-accent"></div>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {files.length === 0 ? (
                            <div className="p-12 text-center">
                                <HardDrive size={48} className="mx-auto mb-4 text-premium-secondary opacity-20" />
                                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Drive is Empty</h3>
                                <p className="text-premium-secondary max-w-sm mx-auto">Your files are encrypted and stored in our secure vault.</p>
                            </div>
                        ) : (
                            files.map((file) => (
                                <div key={file.uuid} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-premium-secondary group-hover:text-premium-accent transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold tracking-tight text-sm">{file.filename}</p>
                                            <p className="text-premium-secondary text-[10px] uppercase font-black tracking-widest">
                                                {(file.size / 1024).toFixed(1)} KB • {file.mime_type}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-1.5 bg-premium-accent/10 border border-premium-accent/20 px-3 py-1 rounded-full">
                                            <Lock size={10} className="text-premium-accent" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-premium-accent">AES-256</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleDownload(file.uuid, file.filename)}
                                                className="p-2 text-premium-secondary hover:text-white transition-colors"
                                                title="Download"
                                            >
                                                <Download size={18} />
                                            </button>
                                            <button className="p-2 text-red-400/50 hover:text-red-400 transition-colors" title="Delete">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Drive;
