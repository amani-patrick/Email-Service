import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FAQS = [
    {
        q: 'What does “zero-knowledge” mean in SecureMail?',
        a: 'Your message content is encrypted on your device. The service stores and transports encrypted data, but it cannot read your plaintext messages.'
    },
    {
        q: 'How do signatures prevent spoofing?',
        a: 'Messages can be cryptographically signed using your identity certificate, allowing recipients to verify authenticity and integrity.'
    },
    {
        q: 'Can I use SecureMail for external domains?',
        a: 'Yes. Higher tiers can support external secure invites and enterprise routing policies, depending on your deployment settings.'
    },
    {
        q: 'Where are attachments stored?',
        a: 'Attachments are stored encrypted-at-rest. Access is enforced by your account permissions and (where configured) end-to-end encryption keys.'
    }
];

const LearnMore = () => {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <div className="min-h-screen bg-premium-bg text-premium-text">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-premium-accent/15 blur-3xl" />
                <div className="absolute -bottom-40 left-1/3 h-[450px] w-[700px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            </div>

            <header className="relative z-10 border-b border-white/5">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                            <span className="text-lg font-semibold">S</span>
                        </div>
                        <span className="text-xl font-semibold tracking-tight">SecureMail</span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="rounded-lg px-3 py-2 text-sm text-premium-secondary hover:text-premium-text transition-colors"
                        >
                            Sign in
                        </Link>
                        <Link to="/login" className="premium-btn">Get started</Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                <section className="mx-auto max-w-6xl px-6 py-14">
                    <div className="grid gap-10 md:grid-cols-2 md:items-start">
                        <div>
                            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Learn more</h1>
                            <p className="mt-4 text-premium-secondary leading-relaxed">
                                SecureMail is a secure email service focused on cryptographic identity, privacy-first
                                workflows, and enterprise controls. Here’s how it works and what you can expect.
                            </p>

                            <div className="mt-8 grid gap-4">
                                <div className="glass-card p-6">
                                    <div className="text-sm font-semibold">Quick start</div>
                                    <p className="mt-2 text-sm text-premium-secondary">
                                        Create an account, generate your device keys, then start sending signed and encrypted
                                        messages from your inbox.
                                    </p>
                                </div>
                                <div className="glass-card p-6">
                                    <div className="text-sm font-semibold">Security model</div>
                                    <p className="mt-2 text-sm text-premium-secondary">
                                        Encryption on the client + signed mail + tiered enterprise controls. Your data is
                                        protected in transit and at rest.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-6 md:p-8">
                            <h2 className="text-xl font-semibold">Q & A</h2>
                            <p className="mt-2 text-sm text-premium-secondary">
                                Common questions about encryption, identities, and features.
                            </p>

                            <div className="mt-6 space-y-3">
                                {FAQS.map((item, idx) => {
                                    const isOpen = idx === openIndex;
                                    return (
                                        <button
                                            key={item.q}
                                            type="button"
                                            onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/[0.07] transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="font-semibold">{item.q}</div>
                                                <div className="mt-0.5 text-premium-secondary">{isOpen ? '−' : '+'}</div>
                                            </div>
                                            {isOpen && (
                                                <div className="mt-3 text-sm leading-relaxed text-premium-secondary">
                                                    {item.a}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-t border-white/5">
                    <div className="mx-auto max-w-6xl px-6 py-14">
                        <div className="grid gap-8 md:grid-cols-3 md:items-start">
                            <div className="md:col-span-1">
                                <h2 className="text-2xl font-semibold">About us</h2>
                                <p className="mt-3 text-sm leading-relaxed text-premium-secondary">
                                    SecureMail is built to make enterprise-grade secure communication accessible. We focus on
                                    practical cryptography, clean UX, and reliable operations.
                                </p>
                            </div>

                            <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
                                <div className="glass-card p-6">
                                    <div className="text-sm font-semibold">Mission</div>
                                    <p className="mt-2 text-sm text-premium-secondary">
                                        Reduce trust assumptions by pushing encryption and identity verification to the edge.
                                    </p>
                                </div>
                                <div className="glass-card p-6">
                                    <div className="text-sm font-semibold">Principles</div>
                                    <p className="mt-2 text-sm text-premium-secondary">
                                        Privacy-first defaults, strong authentication, and auditable admin controls.
                                    </p>
                                </div>
                                <div className="glass-card p-6">
                                    <div className="text-sm font-semibold">For teams</div>
                                    <p className="mt-2 text-sm text-premium-secondary">
                                        Tiered plans support organizations from pilots to enterprise deployments.
                                    </p>
                                </div>
                                <div className="glass-card p-6">
                                    <div className="text-sm font-semibold">Support</div>
                                    <p className="mt-2 text-sm text-premium-secondary">
                                        Contact your admin account inside the app for help and operational guidance.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 flex flex-wrap items-center gap-4">
                            <Link to="/" className="rounded-lg px-6 py-3 text-sm font-semibold text-premium-text ring-1 ring-white/10 hover:bg-white/5 transition-colors">
                                Back to home
                            </Link>
                            <Link to="/login" className="premium-btn px-6 py-3">
                                Go to sign in
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default LearnMore;
