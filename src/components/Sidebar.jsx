import { LayoutDashboard, Users, Truck, FileText, Package, BarChart3, LogOut, Receipt, CalendarDays } from 'lucide-react';
import { useState, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = useState({ name: 'Salesman', email: 'user@example.com' });

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

    const handleLogout = () => {
        localStorage.removeItem('inventory_token');
        localStorage.removeItem('inventory_user');
        navigate('/login', { replace: true });
    };

    const navItems = [
        { path: '/products', name: 'Products', icon: <Package size={20} /> },
        { path: '/buyers', name: 'Buyers (Udhaar)', icon: <Users size={20} /> },
        { path: '/suppliers', name: 'Suppliers', icon: <Truck size={20} /> },
        { path: '/billing', name: 'Billing', icon: <FileText size={20} /> },
        { path: '/sales', name: 'Recent Sales', icon: <BarChart3 size={20} /> },
        { path: '/expenses', name: 'Expenses', icon: <Receipt size={20} /> },
        { path: '/monthly-report', name: 'Monthly Report', icon: <CalendarDays size={20} /> },
    ];

    return (
        <aside className="sidebar glass-panel">
            <div className="sidebar-header">
                <div className="logo-icon">
                    <LayoutDashboard size={28} color="var(--accent-primary)" />
                </div>
                <h2 className="logo-text text-gradient">Inventory<br /><span className="text-gradient-accent">Pro</span></h2>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <div className={`nav-icon ${location.pathname.startsWith(item.path) ? 'active-icon' : ''}`}>
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
                        padding: '10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                    title="Logout"
                >
                    <LogOut size={18} />
                    <span className="logout-btn-text">Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
