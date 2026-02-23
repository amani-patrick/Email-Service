import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from './api';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Compose from './pages/Compose';
import EmailDetails from './pages/EmailDetails';
import AdminDashboard from './pages/Admin';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import PaymentSuccess from './pages/PaymentSuccess';

const App = () => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUser();
        } else {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const res = await api.get('/api/user/me');
            setUser(res.data);
        } catch (err) {
            console.error('Failed to fetch user', err);
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading && token) {
        return (
            <div className="min-h-screen bg-premium-bg flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-premium-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-premium-bg text-premium-text">
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LandingPage />} />
                <Route path="/login" element={!token ? <Login setToken={setToken} /> : <Navigate to="/dashboard" />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />

                {/* Dashboard & Protected Routes */}
                <Route
                    path="/*"
                    element={token ? <Dashboard user={user} setToken={setToken} /> : <Navigate to="/" />}
                >
                    <Route index element={<Navigate to="inbox" />} />
                    <Route path="dashboard" element={<Navigate to="/inbox" />} />
                    <Route path="inbox" element={<Inbox token={token} />} />
                    <Route path="compose" element={<Compose token={token} />} />
                    <Route path="email/:id" element={<EmailDetails user={user} token={token} />} />
                    <Route path="settings" element={<Settings user={user} />} />
                    <Route path="profile" element={<Profile user={user} />} />
                    <Route path="admin" element={user?.is_admin ? <AdminDashboard token={token} /> : <Navigate to="/" />} />
                </Route>
            </Routes>
        </div>
    );
};

export default App;
