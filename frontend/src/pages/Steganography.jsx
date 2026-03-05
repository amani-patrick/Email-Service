import React, { useState } from 'react';
import { stegoHide, stegoExtract } from '../api';
import { Image as ImageIcon, Wand2, Search, Download, Shield, Eye, EyeOff } from 'lucide-react';

const Steganography = () => {
    const [hideImage, setHideImage] = useState(null);
    const [hideMessage, setHideMessage] = useState('');
    const [encodedImage, setEncodedImage] = useState(null);
    const [extractImage, setExtractImage] = useState(null);
    const [extractedMessage, setExtractedMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('hide');

    const handleHide = async (e) => {
        e.preventDefault();
        if (!hideImage || !hideMessage) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('image', hideImage);
            formData.append('message', hideMessage);
            const { data } = await stegoHide(formData);
            setEncodedImage(data.image);
        } catch (error) {
            alert('Failed to hide message. Ensure you are a Premium user.');
        } finally {
            setLoading(false);
        }
    };

    const handleExtract = async (e) => {
        e.preventDefault();
        if (!extractImage) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('image', extractImage);
            const { data } = await stegoExtract(formData);
            setExtractedMessage(data.message);
        } catch (error) {
            alert('Extraction failed.');
        } finally {
            setLoading(false);
        }
    };

    const downloadEncoded = () => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${encodedImage}`;
        link.download = 'secure_vault_image.png';
        link.click();
    };

    return (
        <div className="max-w-6xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-12">
                <h1 className="text-3xl font-black text-white tracking-tighter mb-2 italic">
                    STEGO <span className="text-premium-accent">VAULT</span>
                </h1>
                <p className="text-premium-secondary font-medium tracking-tight">The ultimate beast move: hide your secrets in plain sight.</p>
            </div>

            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setActiveTab('hide')}
                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'hide'
                            ? 'bg-premium-accent text-premium-bg shadow-xl shadow-premium-accent/20'
                            : 'bg-white/5 text-premium-secondary hover:bg-white/10'
                        }`}
                >
                    <EyeOff size={18} />
                    Hide Message
                </button>
                <button
                    onClick={() => setActiveTab('extract')}
                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'extract'
                            ? 'bg-premium-accent text-premium-bg shadow-xl shadow-premium-accent/20'
                            : 'bg-white/5 text-premium-secondary hover:bg-white/10'
                        }`}
                >
                    <Eye size={18} />
                    Extract Message
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {activeTab === 'hide' ? (
                    <>
                        <div className="glass-card p-8 border border-white/5">
                            <h3 className="text-white font-black tracking-tight mb-6 flex items-center gap-2">
                                <Wand2 size={18} className="text-premium-accent" />
                                EMBED SECRET
                            </h3>
                            <form onSubmit={handleHide} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-premium-secondary mb-2">Carrier Image</label>
                                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/10 rounded-xl hover:border-premium-accent/50 transition-colors cursor-pointer bg-white/5">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <ImageIcon size={32} className="text-premium-secondary mb-3 opacity-20" />
                                            <p className="text-xs text-premium-secondary font-bold uppercase tracking-widest">
                                                {hideImage ? hideImage.name : 'Select JPG or PNG'}
                                            </p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => setHideImage(e.target.files[0])} />
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-premium-secondary mb-2">Secret Message</label>
                                    <textarea
                                        value={hideMessage}
                                        onChange={(e) => setHideMessage(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-premium-accent outline-none h-32"
                                        placeholder="Enter your top-secret message here..."
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !hideImage || !hideMessage}
                                    className="w-full bg-premium-accent text-premium-bg py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform disabled:opacity-50"
                                >
                                    {loading ? 'PROCESSING...' : 'ENCODE INTO IMAGE'}
                                </button>
                            </form>
                        </div>

                        <div className="glass-card p-8 border border-premium-accent/20 flex flex-col items-center justify-center text-center">
                            {encodedImage ? (
                                <div className="space-y-6">
                                    <div className="relative group">
                                        <img
                                            src={`data:image/png;base64,${encodedImage}`}
                                            alt="Encoded"
                                            className="max-h-64 rounded-xl shadow-2xl"
                                        />
                                        <div className="absolute inset-0 bg-premium-bg/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                            <Shield size={32} className="text-premium-accent mb-2" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Message Encrypted</span>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white tracking-tight">Stego Packet Ready</h3>
                                    <button
                                        onClick={downloadEncoded}
                                        className="flex items-center gap-2 bg-white/10 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white/20 transition-colors mx-auto"
                                    >
                                        <Download size={18} />
                                        Download Protected Image
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Shield size={48} className="text-premium-secondary opacity-10 mb-4" />
                                    <p className="text-premium-secondary text-sm max-w-xs uppercase tracking-widest font-black opacity-30">
                                        Your encoded image will appear here
                                    </p>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="glass-card p-8 border border-white/5">
                            <h3 className="text-white font-black tracking-tight mb-6 flex items-center gap-2">
                                <Search size={18} className="text-premium-accent" />
                                SCAN IMAGE
                            </h3>
                            <form onSubmit={handleExtract} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-premium-secondary mb-2">Encrypted Image</label>
                                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/10 rounded-xl hover:border-premium-accent/50 transition-colors cursor-pointer bg-white/5">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Search size={32} className="text-premium-secondary mb-3 opacity-20" />
                                            <p className="text-xs text-premium-secondary font-bold uppercase tracking-widest">
                                                {extractImage ? extractImage.name : 'Select Encrypted PNG'}
                                            </p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/png" onChange={(e) => setExtractImage(e.target.files[0])} />
                                    </label>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !extractImage}
                                    className="w-full bg-premium-accent text-premium-bg py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform disabled:opacity-50"
                                >
                                    {loading ? 'SCANNING...' : 'EXTRACT HIDDEN DATA'}
                                </button>
                            </form>
                        </div>

                        <div className="glass-card p-8 border border-premium-accent/20">
                            <h3 className="text-white font-black tracking-tight mb-6 flex items-center gap-2">
                                <Search size={18} className="text-premium-accent" />
                                DECODED OUTPUT
                            </h3>
                            {extractedMessage ? (
                                <div className="bg-white/5 border border-premium-accent/50 rounded-xl p-6 relative">
                                    <div className="absolute -top-3 left-4 bg-premium-accent text-premium-bg px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
                                        Verified Secret
                                    </div>
                                    <p className="text-white font-medium text-sm leading-relaxed italic">"{extractedMessage}"</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 opacity-20">
                                    <Shield size={48} className="text-premium-secondary mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-premium-secondary">AWaiting decypher...</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Steganography;
