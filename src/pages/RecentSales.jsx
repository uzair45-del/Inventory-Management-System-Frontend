import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, TrendingUp, Calendar, DollarSign, Download } from 'lucide-react';
import { downloadSalesAnalyticsPdf } from '../utils/salesAnalyticsPdf';
import { notifySuccess, notifyError, confirmAction } from '../utils/notifications';
import Swal from 'sweetalert2';
import ScrollableTable from '../components/ScrollableTable';
import CustomDropdown from '../components/CustomDropdown';
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
    const [sortOption, setSortOption] = useState('date_desc');
    const [filterOption, setFilterOption] = useState('all');
    const [activeFilter, setActiveFilter] = useState('1m');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 30;

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

    const handleReturnSale = async (sale) => {
        const max = Number(sale.quantity);
        const { value: qtyStr, isDismissed } = await Swal.fire({
            title: 'Return quantity',
            text: `(Max ${max}. Full line = clears this line's credit. Partial qty = partial credit.)`,
            input: 'number',
            inputValue: max,
            showCancelButton: true,
            confirmButtonText: 'Confirm Return',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            customClass: { popup: 'glass-panel', confirmButton: 'btn-primary', cancelButton: 'btn-danger' }
        });
        
        if (isDismissed || qtyStr === undefined) return;
        const q = String(qtyStr).trim() === '' ? max : Number(qtyStr);
        if (!Number.isFinite(q) || q <= 0 || q > max) {
            notifyError('Invalid quantity.');
            return;
        }
        try {
            const token = localStorage.getItem('inventory_token');
            if (q >= max) {
                const confirmed = await confirmAction('Full sale return?', 'Stock will be returned and credit cleared.');
                if (!confirmed) return;
                await axios.delete(`/api/sales/${sale.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(
                    `/api/sales/${sale.id}/return`,
                    { quantity: q },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            notifySuccess('Return saved successfully.');
            fetchSales();
        } catch (err) {
            console.error('Return failed:', err);
            notifyError(err.response?.data?.error || 'Return failed.');
        }
    };

    const periodLabel = useMemo(
        () => TIME_FILTERS.find((f) => f.key === activeFilter)?.label || activeFilter,
        [activeFilter]
    );

    const { filteredGroups, filteredSales, totalRevenue, totalPaid, totalPending } = useMemo(() => {
        const threshold = getDateThreshold(activeFilter);
        
        let filtered = sales.filter(sale => {
            const saleDate = new Date(sale.purchase_date);
            const withinDate = saleDate >= threshold;
            const matchesSearch =
                (sale.products?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sale.buyers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sale.product_id && String(sale.product_id).toLowerCase().includes(searchQuery.toLowerCase())) ||
                (sale.id && String(sale.id).toLowerCase().includes(searchQuery.toLowerCase())) ||
                (sale.invoice_id && String(sale.invoice_id).toLowerCase().includes(searchQuery.toLowerCase()));
            
            if (!(withinDate && matchesSearch)) return false;

            const pending = Number(sale.total_amount || 0) - Number(sale.paid_amount || 0);

            if (filterOption === 'credit_sales') return pending > 0;
            if (filterOption === 'fully_paid') return pending <= 0;
            if (filterOption === 'method_cash') return sale.payment_method === 'Cash';
            if (filterOption === 'method_online') return sale.payment_method === 'Online';
            if (filterOption === 'method_split') return sale.payment_method === 'Split';
            
            return true;
        });

        // 1. Sort strictly by date descending (fallback to ID descending)
        filtered.sort((a, b) => {
            const diff = new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
            if (diff === 0) return b.id - a.id;
            return diff;
        });

        // 2. Group by invoice_id (Map-based — handles non-adjacent rows with same invoice_id)
        //    For legacy records without invoice_id, fall back to 2-minute + same buyer/salesman heuristic.
        const groupMap = new Map();   // invoice_id  → group object
        const groupOrder = [];        // preserves first-seen order for sorting

        filtered.forEach(sale => {
            const saleTime = new Date(sale.purchase_date).getTime();
            const buyerName = sale.buyers?.name || 'Cash Sale';
            const salesman = sale.users?.name || '-';
            const phone = sale.buyers?.phone || '';

            if (sale.invoice_id) {
                // ── Keyed path: always group by invoice_id ──
                if (groupMap.has(sale.invoice_id)) {
                    const grp = groupMap.get(sale.invoice_id);
                    grp.items.push(sale);
                    grp.totalAmount += Number(sale.total_amount || 0);
                    // Keep the earliest time so sorting stays stable
                    if (saleTime > grp.time) grp.time = saleTime;
                } else {
                    const grp = {
                        id: sale.invoice_id,
                        invoice_id: sale.invoice_id,
                        buyerName,
                        phone,
                        salesman,
                        time: saleTime,
                        date: sale.purchase_date,
                        totalAmount: Number(sale.total_amount || 0),
                        items: [sale]
                    };
                    groupMap.set(sale.invoice_id, grp);
                    groupOrder.push(grp);
                }
            } else {
                // ── Heuristic path for legacy records (no invoice_id) ──
                // Try to attach to the last heuristic group within 2 minutes
                const lastHeuristic = groupOrder.length > 0 ? groupOrder[groupOrder.length - 1] : null;
                const timeDiff = lastHeuristic ? Math.abs(lastHeuristic.time - saleTime) : Infinity;
                const isSameBuyer = lastHeuristic?.buyerName === buyerName;
                const isSameSalesman = lastHeuristic?.salesman === salesman;
                const isHeuristic = !lastHeuristic?.invoice_id;

                if (lastHeuristic && isHeuristic && isSameBuyer && isSameSalesman && timeDiff <= 120000) {
                    lastHeuristic.items.push(sale);
                    lastHeuristic.totalAmount += Number(sale.total_amount || 0);
                    if (sale.id < lastHeuristic.id) lastHeuristic.id = sale.id;
                } else {
                    const grp = {
                        id: sale.id,
                        invoice_id: null,
                        buyerName,
                        phone,
                        salesman,
                        time: saleTime,
                        date: sale.purchase_date,
                        totalAmount: Number(sale.total_amount || 0),
                        items: [sale]
                    };
                    groupOrder.push(grp);
                }
            }
        });

        const groups = groupOrder;

        // 3. Apply user sort option to the GROUPS
        groups.sort((a, b) => {
            if (sortOption === 'date_desc') {
                if (b.time === a.time) {
                    if (typeof b.id === 'string' && typeof a.id === 'string') return b.id.localeCompare(a.id);
                    return b.id - a.id;
                }
                return b.time - a.time;
            }
            if (sortOption === 'date_asc') {
                if (a.time === b.time) {
                    if (typeof a.id === 'string' && typeof b.id === 'string') return a.id.localeCompare(b.id);
                    return a.id - b.id;
                }
                return a.time - b.time;
            }
            if (sortOption === 'amount_desc') return b.totalAmount - a.totalAmount;
            if (sortOption === 'amount_asc') return a.totalAmount - b.totalAmount;
            return 0;
        });

        const rev = filtered.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        const paid = filtered.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
        const pend = rev - paid;

        return {
            filteredGroups: groups,
            filteredSales: filtered,
            totalRevenue: rev,
            totalPaid: paid,
            totalPending: pend
        };
    }, [sales, searchQuery, activeFilter, sortOption, filterOption]);

    // Reset pagination to page 1 whenever filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeFilter, sortOption, filterOption]);

    const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
    const paginatedGroups = filteredGroups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="page-container recent-sales-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Recent Sales</h1>
                    <p className="page-subtitle">View and filter your sales history</p>
                </div>
                <button
                    type="button"
                    className="btn-primary flex items-center gap-2"
                    style={{ alignSelf: 'flex-start' }}
                    disabled={loading || filteredSales.length === 0}
                    onClick={async () => {
                        try {
                            await downloadSalesAnalyticsPdf(filteredSales, periodLabel, activeFilter);
                        } catch (e) {
                            console.error(e);
                            notifyError('Could not generate PDF. Try again.');
                        }
                    }}
                >
                    <Download size={20} />
                    <span>Download PDF report</span>
                </button>
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
                        <p className="stat-label">PENDING (CREDIT)</p>
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
            <div className="controls-bar glass-panel" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 50 }}>
                <div className="search-wrapper" style={{ flex: '1', minWidth: '300px' }}>
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search by invoice ID, product or customer..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="filter-sort-wrapper" style={{ display: 'flex', gap: '10px' }}>
                    <CustomDropdown 
                        className="minimal-select" 
                        style={{ minWidth: '150px' }}
                        value={filterOption} 
                        onChange={(e) => setFilterOption(e.target.value)}
                        options={[
                            { value: "all", label: "All Sales" },
                            { value: "credit_sales", label: "Credit Sales (Udhar)" },
                            { value: "fully_paid", label: "Fully Paid (Cash Bill)" },
                            { value: "method_cash", label: "Paid in Cash" },
                            { value: "method_online", label: "Paid in Online" },
                            { value: "method_split", label: "Split Payment" }
                        ]}
                    />
                    <CustomDropdown 
                        className="minimal-select" 
                        style={{ minWidth: '150px' }}
                        value={sortOption} 
                        onChange={(e) => setSortOption(e.target.value)}
                        options={[
                            { value: "date_desc", label: "Newest First" },
                            { value: "date_asc", label: "Oldest First" },
                            { value: "amount_desc", label: "Highest Amount First" },
                            { value: "amount_asc", label: "Lowest Amount First" }
                        ]}
                    />
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Table */}
            <ScrollableTable className="table-container glass-panel">
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
                                <th>Invoice ID</th>
                                <th>Customer</th>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Price</th>
                                <th>Qty</th>
                                <th>Total Amount</th>
                                <th>Paid</th>
                                <th>Method</th>
                                <th>Pending</th>
                                <th>Action</th>
                                <th>Salesman</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedGroups.map((group) => {
                                const rowSpan = group.items.length;
                                const groupTotalAmount = group.items.reduce((s, item) => s + Number(item.total_amount || 0), 0);
                                const groupPaidAmount = group.items.reduce((s, item) => s + Number(item.paid_amount || 0), 0);
                                const groupPending = groupTotalAmount - groupPaidAmount;
                                const groupMethod = group.items[0]?.payment_method || 'Cash';
                                // Sum cash/online across items — each item stores its own allocated portion
                                // These are correct proportional splits so summing gives invoice-level totals
                                const groupCash = group.items.reduce((s, item) => s + Number(item.cash_amount || 0), 0);
                                const groupOnline = group.items.reduce((s, item) => s + Number(item.online_amount || 0), 0);
                                // Sanity-check: if C+O exceeds groupPaidAmount, data was stored redundantly → fallback to first item
                                const splitTotal = groupCash + groupOnline;
                                const displayCash   = splitTotal > groupPaidAmount + 1 ? Number(group.items[0]?.cash_amount   || 0) : groupCash;
                                const displayOnline = splitTotal > groupPaidAmount + 1 ? Number(group.items[0]?.online_amount || 0) : groupOnline;


                                return group.items.map((sale, tIdx) => {
                                    const rowStyle = tIdx === rowSpan - 1 ? { borderBottom: '3px solid var(--border-color)' } : { borderBottom: '1px solid rgba(255,255,255,0.05)' };
                                    
                                    return (
                                        <tr key={sale.id} className="animate-fade-in" style={rowStyle}>
                                            {tIdx === 0 && (
                                                <>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)' }}>
                                                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontWeight: 600 }}>#{group.id}</span>
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)' }}>
                                                        <div className="font-medium">{group.buyerName}</div>
                                                        {group.phone && <div style={{ fontSize: '0.8em', color: '#888', marginTop: '2px' }}>{group.phone}</div>}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)' }}>
                                                        {group.date ? new Date(group.date).toLocaleDateString() : '-'}
                                                    </td>
                                                </>
                                            )}
                                            
                                            <td style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div className="font-medium">{sale.products?.name || '-'}</div>
                                                <div style={{ fontFamily: 'monospace', fontSize: '0.75em', color: 'var(--text-muted)' }}>ID: {formatProductId(sale.product_id) || '-'}</div>
                                            </td>
                                            <td style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>Rs. {Number(sale.products?.price || 0).toLocaleString()}</td>
                                            <td style={{ borderRight: '1px solid var(--border-color)' }}>{sale.quantity} {sale.products?.quantity_unit ? `\n(${sale.products.quantity_unit})` : ''}</td>
                                            
                                            {tIdx === 0 && (
                                                <>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)' }}>
                                                        Rs. {groupTotalAmount.toLocaleString()}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', color: '#22c55e', borderRight: '1px solid var(--border-color)' }}>
                                                        Rs. {groupPaidAmount.toLocaleString()}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)' }}>
                                                        <span style={{ 
                                                            fontSize: '0.75em', padding: '3px 6px', borderRadius: '4px', fontWeight: 600,
                                                            background: groupMethod === 'Online' ? '#e0f2fe' : (groupMethod === 'Split' ? '#fef08a' : '#dcfce3'),
                                                            color: groupMethod === 'Online' ? '#0369a1' : (groupMethod === 'Split' ? '#854d0e' : '#166534')
                                                        }}>{groupMethod}</span>
                                                        {groupMethod === 'Split' && (
                                                            <div style={{ fontSize: '0.65em', color: '#666', marginTop: '4px' }}>
                                                                C: {displayCash.toLocaleString()} | O: {displayOnline.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', color: groupPending > 0 ? '#ef4444' : '#22c55e', fontWeight: 600, borderRight: '1px solid var(--border-color)' }}>
                                                        {groupPending > 0 ? `Rs. ${groupPending.toLocaleString()}` : '✓ Paid'}
                                                    </td>
                                                </>
                                            )}
                                            <td style={{ borderRight: '1px solid var(--border-color)' }}>
                                                <button 
                                                    className="icon-btn-danger" 
                                                    style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', gap: '4px', alignItems: 'center', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                    onClick={() => handleReturnSale(sale)}
                                                    title="Full or partial return; credit sirf is line ke hisaab se"
                                                >
                                                    Return
                                                </button>
                                            </td>

                                            {tIdx === 0 && (
                                                <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                    {group.salesman}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                });
                            })}
                        </tbody>
                    </table>
                )}

                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                    <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredGroups.length)} of {filteredGroups.length} invoices
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                className="btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    // Show first, last, and current ± 1
                                    if (
                                        pageNum === 1 || 
                                        pageNum === totalPages || 
                                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                    ) {
                                        return (
                                            <button 
                                                key={pageNum}
                                                className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                                                style={{ 
                                                    width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                                    background: currentPage === pageNum ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                    color: currentPage === pageNum ? '#fff' : 'var(--text-primary)',
                                                    fontWeight: currentPage === pageNum ? 'bold' : 'normal',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setCurrentPage(pageNum)}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    } else if (
                                        pageNum === currentPage - 2 || 
                                        pageNum === currentPage + 2
                                    ) {
                                        return <span key={pageNum} style={{ color: 'var(--text-secondary)' }}>...</span>;
                                    }
                                    return null;
                                })}
                            </div>
                            <button 
                                className="btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </ScrollableTable>
        </div>
    );
};

export default RecentSales;
