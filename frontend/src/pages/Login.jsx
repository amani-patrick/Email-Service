import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateKeyPair, exportKey, wrapPrivateKey } from '../crypto';

const Login = ({ setToken }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('user@ses');
    const [password, setPassword] = useState('289275a80f78b77f06e103f5b34fc60c');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const endpoint = isLogin ? '/api/login' : '/api/register';
            let payload = { username, password };

            if (!isLogin) {
                // Zero-Knowledge Key Generation
                const keyPair = await generateKeyPair();
                const pubKeyJwk = await exportKey(keyPair.publicKey);
                const privKeyJwk = await exportKey(keyPair.privateKey);

                // Wrap the private key with the user's password
                const wrappedPrivKey = await wrapPrivateKey(privKeyJwk, password);

                payload.public_key = pubKeyJwk;
                payload.encrypted_private_key = wrappedPrivKey;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                if (isLogin) {
                    localStorage.setItem('token', data.access_token);
                    if (setToken) setToken(data.access_token);
                    navigate('/dashboard');
                } else {
                    setSuccess('Account created! Please login.');
                    setIsLogin(true);
                }
            } else {
                setError(data.detail || 'An error occurred');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: '#1e293b',
                padding: '40px',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '400px'
            }}>
                <h2 style={{ fontSize: '32px', marginBottom: '8px', textAlign: 'center' }}>
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p style={{ color: '#94a3b8', marginBottom: '32px', textAlign: 'center' }}>
                    {isLogin ? 'Sign in to your secure account' : 'Start your secure journey'}
                </p>

                {error && (
                    <div style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#f8fafc',
                                fontSize: '16px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#f8fafc',
                                fontSize: '16px'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: loading ? '#64748b' : '#38bdf8',
                            color: '#0f172a',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginBottom: '16px'
                        }}
                    >
                        {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div style={{ textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
