import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import api from './api';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Compose from './pages/Compose';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import EmailDetails from './pages/EmailDetails';

// Components
import Layout from './components/Layout';

const App = () => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            fetchUser();
        } else {
            localStorage.removeItem('token');
            setUser(null);
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const response = await api.get('/api/me');
            setUser(response.data);
        } catch (err) {
            console.error('Failed to fetch user', err);
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading && token) {
        return (
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    border: '4px solid #38bdf8',
                    borderTop: '4px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
            </div>
        );
    }

    return (
        <div>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LandingPage />} />
                <Route path="/login" element={token ? <Navigate to="/dashboard" /> : <Login setToken={setToken} />} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={
                    token ? <Layout user={user} setToken={setToken}><Dashboard user={user} /></Layout> : <Navigate to="/login" />
                } />
                <Route path="/inbox" element={
                    token ? <Layout user={user} setToken={setToken}><Inbox user={user} /></Layout> : <Navigate to="/login" />
                } />
                <Route path="/compose" element={
                    token ? <Layout user={user} setToken={setToken}><Compose user={user} /></Layout> : <Navigate to="/login" />
                } />
                <Route path="/settings" element={
                    token ? <Layout user={user} setToken={setToken}><Settings user={user} /></Layout> : <Navigate to="/login" />
                } />
                <Route path="/profile" element={
                    token ? <Layout user={user} setToken={setToken}><Profile user={user} /></Layout> : <Navigate to="/login" />
                } />
                <Route path="/email/:id" element={
                    token ? <Layout user={user} setToken={setToken}><EmailDetails user={user} /></Layout> : <Navigate to="/login" />
                } />
                <Route path="/admin" element={
                    token && user?.is_admin ? <Layout user={user} setToken={setToken}><Admin user={user} /></Layout> : <Navigate to="/dashboard" />
                } />

                {/* Fallback */}
                <Route path="*" element={<Navigate to={token ? "/dashboard" : "/"} />} />
            </Routes>
        </div>
    );
};

export default App;
