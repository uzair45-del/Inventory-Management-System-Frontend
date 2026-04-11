import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Sidebar from './Sidebar';

const Layout = () => {
    const location = useLocation();
    
    useEffect(() => {
        const checkLowStock = async () => {
            try {
                const token = localStorage.getItem('inventory_token');
                if (!token) return;
                const { data } = await axios.get('/api/products', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                let lowCount = 0;
                data.forEach(p => {
                    const rem = Number(p.remaining_quantity || 0);
                    const thr = p.low_stock_threshold !== undefined && p.low_stock_threshold !== null ? p.low_stock_threshold : 10;
                    if (rem > 0 && rem <= thr) lowCount++;
                });
                if (lowCount > 0) {
                    toast(`⚠️ ${lowCount} item${lowCount > 1 ? 's are' : ' is'} running low on stock!`, {
                        duration: 5000,
                        icon: '⚠️',
                        style: {
                            borderRadius: '10px',
                            background: '#1e293b',
                            color: '#fbbf24',
                        },
                    });
                }
            } catch (err) {
                console.error("Failed to fetch initial low stock status", err);
            }
        };

        const checkOldDataForArchive = async () => {
            try {
                // Check once a month
                const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                const lastCheckMonth = localStorage.getItem('last_archive_check_month');
                if (lastCheckMonth === currentMonth) return;

                const token = localStorage.getItem('inventory_token');
                if (!token) return;
                
                const { data } = await axios.get('/api/export/check-old-data', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (data.hasOldData) {
                    toast('🕒 You have data older than 1 year! Please visit Database Management to archive it and free up space.', {
                        duration: 10000,
                        icon: '💾',
                        style: {
                            borderRadius: '10px',
                            background: '#1e293b',
                            color: '#38bdf8',
                            border: '1px solid #38bdf8'
                        },
                    });
                }
                localStorage.setItem('last_archive_check_month', currentMonth);
            } catch (err) {
                console.error("Failed to check old data for archiving", err);
            }
        };

        checkLowStock();
        checkOldDataForArchive();
    }, []);

    // Assume user is logged in for the Layout wrapper (Login is handled separately in App.jsx)

    return (
        <div className="layout-container animate-fade-in">
            <Sidebar />
            <main className="main-content">
                <div className="content-wrapper">
                    <Outlet />
                    
                    {/* Global Advertisement Footer */}
                    <div style={{ marginTop: 'auto', paddingTop: '40px', paddingBottom: '20px', textAlign: 'center' }}>
                        <div className="glass-panel" style={{ display: 'inline-block', padding: '16px 32px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)' }}>
                            <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>Software Developed by Hassan Ali Abrar</h4>
                            <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Instagram: <strong style={{ color: 'var(--info)' }}>hassan.secure</strong> <span style={{ margin: '0 8px', color: 'var(--glass-border)' }}>|</span> WhatsApp: <strong style={{ color: 'var(--success)' }}>+92 348 5055098</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contact for custom software development & business automation</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
