import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-premium-bg text-premium-text">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-premium-accent/20 blur-3xl" />
                <div className="absolute -bottom-40 left-1/3 h-[450px] w-[700px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            </div>

            <header className="relative z-10">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                            <span className="text-lg font-semibold">S</span>
                        </div>
                        <span className="text-xl font-semibold tracking-tight">SecureMail</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="hidden rounded-lg px-3 py-2 text-sm text-premium-secondary hover:text-premium-text transition-colors sm:block"
                        >
                            Sign in
                        </Link>
                        <Link to="/login" className="premium-btn">Get started</Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-10 md:grid-cols-2 md:pt-16">
                    <div>
                        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                            A brand new way to
                            <span className="block bg-gradient-to-r from-white to-premium-accent bg-clip-text text-transparent">
                                verify secure email
                            </span>
                        </h1>

                        <p className="mt-5 max-w-xl text-base leading-relaxed text-premium-secondary">
                            End-to-end encrypted messaging for teams. Cryptographic identity, signed mail, and secure
                            attachments—built for enterprise trust.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Link to="/login" className="premium-btn px-6 py-3">
                                Get Started
                            </Link>
                            <Link
                                to="/learn"
                                className="rounded-lg px-6 py-3 text-sm font-semibold text-premium-text ring-1 ring-white/10 hover:bg-white/5 transition-colors"
                            >
                                Learn more
                            </Link>
                        </div>

                        <div className="mt-10 grid gap-4 sm:grid-cols-2">
                            <div className="glass-card p-5">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold">Security Encryption</div>
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-premium-secondary ring-1 ring-white/10">
                                        Verified
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-premium-secondary">
                                    Client-side encryption—your keys never leave your device.
                                </p>
                            </div>

                            <div className="glass-card p-5">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold">Privacy Protection</div>
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-premium-secondary ring-1 ring-white/10">
                                        Signed
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-premium-secondary">
                                    Signed messages and certificates prevent impersonation.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="glass-card relative overflow-hidden p-6 md:p-8">
                            <div className="absolute inset-0 bg-gradient-to-tr from-premium-accent/10 via-transparent to-white/5" />
                            <div className="relative">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-premium-secondary">SecureMail Card</div>
                                    <div className="h-8 w-8 rounded-lg bg-white/10 ring-1 ring-white/10" />
                                </div>

                                <div className="mt-6 grid gap-4">
                                    <div className="rounded-2xl bg-gradient-to-br from-white/10 to-premium-accent/20 p-6 ring-1 ring-white/10">
                                        <div className="text-lg font-semibold">Identity verified</div>
                                        <div className="mt-2 text-sm text-premium-secondary">
                                            Certificates and device keys power trusted communication.
                                        </div>
                                        <div className="mt-6 flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/10" />
                                            <div className="h-10 flex-1 rounded-xl bg-white/10 ring-1 ring-white/10" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                                            <div className="text-sm font-semibold">Encryption</div>
                                            <div className="mt-1 text-xs text-premium-secondary">Zero-knowledge</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                                            <div className="text-sm font-semibold">Attachments</div>
                                            <div className="mt-1 text-xs text-premium-secondary">E2E protected</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="relative z-10 border-t border-white/5">
                    <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 md:grid-cols-3">
                        <div className="glass-card p-6">
                            <div className="text-sm font-semibold">Zero-Knowledge</div>
                            <p className="mt-2 text-sm text-premium-secondary">
                                Messages are encrypted on-device; the server never sees plaintext.
                            </p>
                        </div>
                        <div className="glass-card p-6">
                            <div className="text-sm font-semibold">Digital Identity</div>
                            <p className="mt-2 text-sm text-premium-secondary">
                                Signed mail and certificates prove authenticity and prevent spoofing.
                            </p>
                        </div>
                        <div className="glass-card p-6">
                            <div className="text-sm font-semibold">Enterprise Controls</div>
                            <p className="mt-2 text-sm text-premium-secondary">
                                Admin licensing, audit logs, and tiered features for teams.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default LandingPage;
