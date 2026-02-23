import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Compose from './pages/Compose';
import EmailDetails from './pages/EmailDetails';

const App = () => {
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }, [token]);

    return (
        <Router>
            <div className="min-h-screen bg-premium-bg overflow-hidden">
                <Routes>
                    <Route path="/login" element={!token ? <Login setToken={setToken} /> : <Navigate to="/" />} />
                    <Route
                        path="/*"
                        element={token ? <Dashboard token={token} setToken={setToken} /> : <Navigate to="/login" />}
                    >
                        <Route index element={<Inbox token={token} />} />
                        <Route path="inbox" element={<Inbox token={token} />} />
                        <Route path="compose" element={<Compose token={token} />} />
                        <Route path="email/:id" element={<EmailDetails token={token} />} />
                    </Route>
                </Routes>
            </div>
        </Router>
    );
};

export default App;
