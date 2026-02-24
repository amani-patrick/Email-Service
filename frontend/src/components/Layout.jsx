import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ user, setToken, children }) => {
    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
    };

    return (
        <div className="flex min-h-screen bg-premium-bg">
            <Sidebar user={user} onLogout={handleLogout} />

            <main className="flex-1 ml-72 p-8 pt-10 relative">
                {/* Dashboard Ambient Glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-premium-accent/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
