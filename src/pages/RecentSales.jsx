import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import './RecentSales.css';

const TIME_FILTERS = [
    { key: '1d', label: 'Last Day' },
    { key: '1w', label: 'Last Week' },
    { key: '1m', label: 'Last Month' },
    { key: '6m', label: 'Last 6 Months' },
    { key: '1y', label: 'Last Year' },
    { key: '5y', label: 'Last 5 Years' },
];

const formatProductId = (id) => {
    if (!id) return '';
    return String(id).toUpperCase();
};

const getDateThreshold = (key) => {
    const now = new Date();
    switch (key) {
        case '1d': return new Date(now - 1 * 24 * 60 * 60 * 1000);
        case '1w': return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case '1m': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case '5y': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        default: return new Date(0);
    }
};

const RecentSales = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('1m');

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/sales', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSales(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching sales:', err);
            setError('Failed to load sales data.');
        } finally {
            setLoading(false);
        }
    };

    const handleUndoSale = async (id) => {
        if (!window.confirm("Are you sure you want to undo this sale? This will restore the stock and clear associated debt and payments.")) return;
        try {
            const token = localStorage.getItem('inventory_token');
            await axios.delete(`/api/sales/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Sale Reversed Successfully!');
            fetchSales();
        } catch (err) {
            console.error('Error undoing sale:', err);
            alert('Failed to undo sale. Please try again.');
        }
    };

    const { filteredSales, totalRevenue, totalPaid, totalPending } = useMemo(() => {
        const threshold = getDateThreshold(activeFilter);
        
        const filtered = sales.filter(sale => {
            const saleDate = new Date(sale.purchase_date);
            const withinDate = saleDate >= threshold;
            const matchesSearch =
                (sale.products?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sale.buyers?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            return withinDate && matchesSearch;
        });

        const rev = filtered.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        const paid = filtered.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
        const pend = rev - paid;

        return {
            filteredSales: filtered,
            totalRevenue: rev,
            totalPaid: paid,
            totalPending: pend
        };
    }, [sales, searchQuery, activeFilter]);

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Recent Sales</h1>
                    <p className="page-subtitle">View and filter your sales history</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="sales-stats-grid">
                <div className="sales-stat-card glass-panel">
                    <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                        <DollarSign size={22} />
                    </div>
                    <div>
                        <p className="stat-label">TOTAL REVENUE</p>
                        <h3 className="stat-value" style={{ color: '#22c55e' }}>Rs. {totalRevenue.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="sales-stat-card glass-panel">
                    <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <p className="stat-label">TOTAL PAID</p>
                        <h3 className="stat-value" style={{ color: '#8b5cf6' }}>Rs. {totalPaid.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="sales-stat-card glass-panel">
                    <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                        <Calendar size={22} />
                    </div>
                    <div>
                        <p className="stat-label">PENDING (UDHAAR)</p>
                        <h3 className="stat-value" style={{ color: '#ef4444' }}>Rs. {totalPending.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="sales-stat-card glass-panel">
                    <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <p className="stat-label">TOTAL TRANSACTIONS</p>
                        <h3 className="stat-value" style={{ color: '#3b82f6' }}>{filteredSales.length}</h3>
                    </div>
                </div>
            </div>

            {/* Time Filter Tabs */}
            <div className="time-filter-bar glass-panel">
                {TIME_FILTERS.map(f => (
                    <button
                        key={f.key}
                        className={`time-filter-btn ${activeFilter === f.key ? 'active' : ''}`}
                        onClick={() => setActiveFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="controls-bar glass-panel">
                <div className="search-wrapper">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search by product or buyer name..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Table */}
            <div className="table-container glass-panel">
                {loading ? (
                    <div className="loading-state">Loading sales...</div>
                ) : filteredSales.length === 0 ? (
                    <div className="empty-state">
                        <TrendingUp size={48} className="empty-icon" />
                        <h3>No sales found</h3>
                        <p>No transactions in the selected period</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Invoice ID</th>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Price</th>
                                <th>Supplier</th>
                                <th>Buyer</th>
                                <th>Qty</th>
                                <th>Total Amount</th>
                                <th>Paid</th>
                                <th>Pending</th>
                                <th>Salesman</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.map((sale, idx) => {
                                const pending = Number(sale.total_amount || 0) - Number(sale.paid_amount || 0);
                                return (
                                    <tr key={sale.id} className="animate-fade-in">
                                        <td>{idx + 1}</td>
                                        <td style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontWeight: 600 }}>#{sale.id}</td>
                                        <td>{sale.purchase_date ? new Date(sale.purchase_date).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <div className="font-medium">{sale.products?.name || '-'}</div>
                                            <div style={{ fontSize: '0.7em', color: '#666', marginTop: '2px' }}>{formatProductId(sale.product_id)}</div>
                                        </td>
                                        <td>Rs. {Number(sale.products?.price || 0).toLocaleString()}</td>
                                        <td>{sale.products?.purchased_from || '-'}</td>
                                        <td>
                                            <div>{sale.buyers?.name || 'Cash Sale'}</div>
                                            {sale.buyers?.phone && <div style={{ fontSize: '0.8em', color: '#888', marginTop: '2px' }}>{sale.buyers.phone}</div>}
                                        </td>
                                        <td>{sale.quantity} {sale.products?.quantity_unit ? `\n(${sale.products.quantity_unit})` : ''}</td>
                                        <td>Rs. {Number(sale.total_amount).toLocaleString()}</td>
                                        <td style={{ color: '#22c55e' }}>Rs. {Number(sale.paid_amount).toLocaleString()}</td>
                                        <td style={{ color: pending > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                                            {pending > 0 ? `Rs. ${pending.toLocaleString()}` : '✓ Paid'}
                                        </td>
                                        <td>{sale.users?.name || '-'}</td>
                                        <td>
                                            <button 
                                                className="icon-btn-danger" 
                                                style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', gap: '4px', alignItems: 'center', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                onClick={() => handleUndoSale(sale.id)}
                                                title="Return items and clear debt"
                                            >
                                                Return
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default RecentSales;
