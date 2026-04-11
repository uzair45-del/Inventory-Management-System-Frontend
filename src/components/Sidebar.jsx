import { LayoutDashboard, Users, Truck, FileText, Package, BarChart3, LogOut, Receipt, CalendarDays, Building2, ClipboardList, Menu, X, Database, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import './Sidebar.css';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = useState({ name: 'Salesman', email: 'user@example.com' });
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('inventory_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Error parsing user data");
            }
        }
    }, []);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('inventory_token');
        localStorage.removeItem('inventory_user');
        navigate('/login', { replace: true });
    };

    const navItems = [
        { path: '/products', name: 'Products', icon: <Package size={20} /> },
        { path: '/buyers', name: 'Customers (Credit)', icon: <Users size={20} /> },
        { path: '/companies', name: 'Companies Ledger', icon: <Building2 size={20} /> },
        { path: '/suppliers', name: 'Suppliers', icon: <Truck size={20} /> },
        { path: '/billing', name: 'Billing', icon: <FileText size={20} /> },
        { path: '/sales', name: 'Recent Sales', icon: <BarChart3 size={20} /> },
        { path: '/expenses', name: 'Expenses', icon: <Receipt size={20} /> },
        { path: '/daily-report', name: 'Daily Report', icon: <ClipboardList size={20} /> },
        { path: '/monthly-report', name: 'Monthly Report', icon: <CalendarDays size={20} /> },
        { path: '/database-export', name: 'Database Export', icon: <Database size={20} />, danger: true },
        { path: '/settings', name: 'Shop Settings', icon: <Settings size={20} /> },
    ];

    return (
        <>
            {/* ── Hamburger button (mobile only) ── */}
            <button
                className="sidebar-hamburger"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
            >
                <Menu size={22} />
            </button>

            {/* ── Backdrop (mobile only, when drawer is open) ── */}
            {mobileOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Sidebar / Drawer ── */}
            <aside className={`sidebar glass-panel${mobileOpen ? ' sidebar-open' : ''}`}>
                {/* Close button inside drawer (mobile only) */}
                <button
                    className="sidebar-close-btn"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                >
                    <X size={20} />
                </button>

                <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '24px 0 16px' }}>
                    <div className="logo-icon">
                        <LayoutDashboard size={28} color="var(--accent-primary)" />
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${item.danger ? 'danger-link' : ''}`}
                        >
                            <div className={`nav-icon ${location.pathname.startsWith(item.path) ? 'active-icon' : ''} ${item.danger ? 'danger-icon' : ''}`}>
                                {item.icon}
                            </div>
                            <span className="nav-text">{item.name}</span>
                            {location.pathname.startsWith(item.path) && <div className="active-indicator" />}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile">
                        <div className="avatar">{user.name ? user.name.substring(0, 2).toUpperCase() : 'US'}</div>
                        <div className="user-info">
                            <p className="user-name" style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={user.name}>{user.name}</p>
                            <p className="user-role" style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={user.email}>{user.email}</p>
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto', marginBottom: '8px', width: '100%' }}>
                        <ThemeToggle />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="logout-btn"
                        style={{
                            marginTop: '1rem',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            color: 'var(--danger)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '30px',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: 'var(--shadow-sm)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = 'var(--danger)';
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.borderColor = 'var(--danger)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                            e.currentTarget.style.color = 'var(--danger)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        }}
                        title="Logout"
                    >
                        <LogOut size={18} />
                        <span className="logout-btn-text" style={{ fontWeight: 600 }}>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
