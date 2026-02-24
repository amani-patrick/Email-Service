import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
    console.log('LandingPage component rendering');
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '20px' }}>
            <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>SecureMail Enterprise</h1>
            <p style={{ fontSize: '18px', marginBottom: '40px' }}>Zero-Knowledge Security for Enterprise</p>
            
            <div style={{ marginBottom: '40px' }}>
                <Link 
                    to="/login" 
                    style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        backgroundColor: '#38bdf8',
                        color: '#0f172a',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        marginRight: '20px'
                    }}
                >
                    Get Started Now
                </Link>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' }}>
                    <h3>Zero-Knowledge</h3>
                    <p>Encryption happens entirely on your device. We never hold your keys.</p>
                </div>
                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' }}>
                    <h3>Digital Identity</h3>
                    <p>Cryptographic signatures ensure every communication is authentic.</p>
                </div>
                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' }}>
                    <h3>Secure Drive</h3>
                    <p>Enterprise-grade file storage with end-to-end encryption.</p>
                </div>
                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' }}>
                    <h3>Global Resilience</h3>
                    <p>Distributed architecture ensures accessibility from anywhere.</p>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
