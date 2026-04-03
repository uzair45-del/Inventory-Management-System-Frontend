import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Building2, CreditCard, ChevronDown, ChevronUp, X } from 'lucide-react';
import { notifySuccess, notifyError } from '../utils/notifications';
import ScrollableTable from '../components/ScrollableTable';
import './Companies.css';

const Companies = () => {
    const [buyers, setBuyers] = useState([]);
    const [allSales, setAllSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [payModal, setPayModal] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [paying, setPaying] = useState(false);

    useEffect(() => { fetchBuyers(); fetchSales(); }, []);

    const fetchBuyers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            const res = await axios.get('/api/buyers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBuyers(res.data);
        } catch (err) {
            console.error('Failed to fetch buyers:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSales = async () => {
        try {
            const token = localStorage.getItem('inventory_token');
            const res = await axios.get('/api/sales', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllSales(res.data);
        } catch (err) {
            console.error('Failed to fetch sales:', err);
        }
    };

    // Build companyMap from BOTH buyers (credit) AND direct buyer_transactions (original bills)
    const { companyList, grandTotals, companyMap } = useMemo(() => {
        const cMap = {};
        
        buyers.forEach(buyer => {
            const company = buyer.company_name?.trim();
            if (!company) return;
            if (!cMap[company]) cMap[company] = { buyers: [], txns: [] };
            cMap[company].buyers.push(buyer);
            (buyer.buyer_transactions || []).forEach(txn => {
                cMap[company].txns.push({
                    ...txn,
                    buyerName: buyer.name,
                    buyerPhone: buyer.phone
                });
            });
        });

        allSales.forEach(sale => {
            const company = sale.company_name?.trim();
            if (!company) return;
            const alreadyAdded = cMap[company]?.txns.some(t => t.id === sale.id);
            if (!cMap[company]) cMap[company] = { buyers: [], txns: [] };
            if (!alreadyAdded) {
                cMap[company].txns.push({
                    ...sale,
                    products: sale.products,
                    buyerName: sale.buyers?.name || sale.buyer_name || '—',
                    buyerPhone: sale.buyers?.phone || '—'
                });
            }
        });

        const list = Object.entries(cMap)
            .filter(([name]) => name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort(([a, aData], [b, bData]) => {
                // Calculate remaining amounts for both companies
                const aTotals = aData.txns.reduce((acc, txn) => {
                    acc.total += Number(txn.total_amount || 0);
                    acc.paid += Number(txn.paid_amount || 0);
                    return acc;
                }, { total: 0, paid: 0 });
                
                const bTotals = bData.txns.reduce((acc, txn) => {
                    acc.total += Number(txn.total_amount || 0);
                    acc.paid += Number(txn.paid_amount || 0);
                    return acc;
                }, { total: 0, paid: 0 });
                
                const aRemaining = aTotals.total - aTotals.paid;
                const bRemaining = bTotals.total - bTotals.paid;
                
                // If one has outstanding and other doesn't, outstanding comes first
                if (aRemaining > 0 && bRemaining <= 0) return -1;
                if (aRemaining <= 0 && bRemaining > 0) return 1;
                
                // If both have outstanding, sort by higher outstanding amount
                if (aRemaining > 0 && bRemaining > 0) return bRemaining - aRemaining;
                
                // If both are cleared, sort alphabetically
                return a.localeCompare(b);
            });

        let gTotal = 0, gPaid = 0;
        Object.values(cMap).forEach(({ txns }) => {
            txns.forEach(txn => {
                gTotal += Number(txn.total_amount || 0);
                gPaid += Number(txn.paid_amount || 0);
            });
        });

        return {
            companyMap: cMap,
            companyList: list,
            grandTotals: { total: gTotal, paid: gPaid, remaining: gTotal - gPaid }
        };
    }, [buyers, allSales, searchQuery]);

    // Totals for a company (from its unified txns list)
    const getCompanyTotals = (txns) => {
        let total = 0, paid = 0;
        txns.forEach(txn => {
            total += Number(txn.total_amount || 0);
            paid += Number(txn.paid_amount || 0);
        });
        return { total, paid, remaining: total - paid };
    };

    const openPayModal = (companyName, companyData) => {
        setPayAmount('');
        setPayModal({ companyName, companyData, isCompanyPayment: true });
    };

    const handlePay = async () => {
        const amt = Number(payAmount);
        if (!amt || amt <= 0) { 
            notifyError('Payment amount must be greater than 0'); 
            return; 
        }
        
        if (amt > payModal.companyData.total_remaining) { 
            notifyError(`Payment amount cannot exceed outstanding amount: Rs. ${payModal.companyData.total_remaining.toLocaleString()}`); 
            return; 
        }
        
        const confirmMessage = `Receive payment of Rs. ${amt} from ${payModal.companyName}? This will be distributed across all ${payModal.companyData.buyers.length} customers in this company.`;
        
        if (!window.confirm(confirmMessage)) return;
        
        try {
            setPaying(true);
            const token = localStorage.getItem('inventory_token');
            await axios.post('/api/buyers/company-payment', {
                company_name: payModal.companyName,
                payment_amount: amt,
                date: new Date().toISOString().split('T')[0]
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            notifySuccess(`Company payment of Rs. ${amt} received and distributed across ${payModal.companyData.buyers.length} customers!`);
            setPayModal(null);
            fetchBuyers();
            fetchSales();
        } catch (err) {
            notifyError(err.response?.data?.error || 'Company payment failed.');
        } finally {
            setPaying(false);
        }
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Companies Ledger</h1>
                    <p className="page-subtitle">Track customer payments (company-wise credit)</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="companies-stats-row">
                <div className="stat-card glass-panel">
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(56,189,248,0.1)' }}>
                        <Building2 size={24} color="#38bdf8" />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Companies</p>
                        <h2 className="stat-value">{Object.keys(companyMap).length}</h2>
                    </div>
                </div>
                <div className="stat-card glass-panel">
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <CreditCard size={24} color="#ef4444" />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Outstanding (All Companies)</p>
                        <h2 className="stat-value" style={{ color: grandTotals.remaining > 0 ? '#ef4444' : '#4ade80' }}>
                            Rs. {grandTotals.remaining.toLocaleString()}
                        </h2>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="table-container glass-panel">
                <div className="table-header-controls">
                    <div className="search-wrapper">
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search companies..."
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state text-center py-8">Loading companies...</div>
                ) : companyList.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        No companies found. Add a company name when creating a bill.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                        {companyList.map(([companyName, companyData]) => {
                            const { txns } = companyData;
                            const totals = getCompanyTotals(txns);
                            const isOpen = selectedCompany === companyName;
                            const uniqueCustomers = new Set(txns.map(t => t.buyerName).filter(Boolean)).size;

                            return (
                                <div key={companyName} className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                                    {/* Company Header Row */}
                                    <div
                                        className="company-row-header"
                                        onClick={() => setSelectedCompany(isOpen ? null : companyName)}
                                        style={{ background: isOpen ? 'rgba(56,189,248,0.08)' : 'transparent' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: 34, height: 34, borderRadius: '8px',
                                                background: 'rgba(56,189,248,0.15)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Building2 size={18} color="#38bdf8" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                                    {companyName}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {uniqueCustomers} customer{uniqueCustomers !== 1 ? 's' : ''} · {txns.length} transaction{txns.length !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="company-row-right">
                                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    className="btn-primary"
                                                    style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#22c55e', borderColor: '#22c55e' }}
                                                    onClick={() => openPayModal(companyName, { 
                                                        buyers: companyData.buyers || [], 
                                                        total_remaining: totals.remaining 
                                                    })}
                                                    title="Receive Company Payment"
                                                >
                                                    💰 Pay Company
                                                </button>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding</div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: totals.remaining > 0 ? '#ef4444' : '#4ade80' }}>
                                                        Rs. {totals.remaining.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                            {isOpen ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                                        </div>
                                    </div>

                                    {/* Expanded: transactions table */}
                                    {isOpen && (
                                        <div style={{ borderTop: '1px solid var(--border-color)', padding: '0 4px 8px' }}>
                                            {/* Summary bar */}
                                            <div className="company-summary-bar">
                                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                    Total Billed: <strong style={{ color: 'var(--text-primary)', marginLeft: '6px' }}>Rs. {totals.total.toLocaleString()}</strong>
                                                </span>
                                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                    Total Paid: <strong style={{ color: 'var(--success)', marginLeft: '6px' }}>Rs. {totals.paid.toLocaleString()}</strong>
                                                </span>
                                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                    Remaining: <strong style={{ color: totals.remaining > 0 ? 'var(--danger)' : 'var(--success)', marginLeft: '6px' }}>Rs. {totals.remaining.toLocaleString()}</strong>
                                                </span>
                                            </div>

                                            {txns.length === 0 ? (
                                                <div className="text-center py-4 text-muted">No transactions recorded for this company.</div>
                                            ) : (
                                                <ScrollableTable className="table-container glass-panel" style={{ padding: '8px' }}>
                                                    <table className="data-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Customer</th>
                                                                <th>Phone</th>
                                                                <th>Product</th>
                                                                <th>Qty</th>
                                                                <th>Total</th>
                                                                <th>Paid</th>
                                                                <th>Method</th>
                                                                <th>Remaining</th>
                                                                <th>Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {txns.map(txn => {
                                                                const rem = Number(txn.total_amount || 0) - Number(txn.paid_amount || 0);
                                                                return (
                                                                    <tr key={txn.id} className="animate-fade-in">
                                                                        <td>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <div style={{
                                                                                    width: 28, height: 28, borderRadius: '50%',
                                                                                    background: 'rgba(139,92,246,0.2)',
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                    fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa'
                                                                                }}>
                                                                                    {txn.buyerName?.charAt(0).toUpperCase()}
                                                                                </div>
                                                                                <span style={{ fontWeight: 500 }}>{txn.buyerName}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{txn.buyerPhone || '-'}</td>
                                                                        <td style={{ fontWeight: 500 }}>{txn.products?.name || `Product #${txn.product_id}`}</td>
                                                                        <td>{txn.quantity}</td>
                                                                        <td>Rs. {Number(txn.total_amount).toLocaleString()}</td>
                                                                        <td style={{ color: '#4ade80' }}>Rs. {Number(txn.paid_amount).toLocaleString()}</td>
                                                                        <td>
                                                                            <span style={{ 
                                                                                fontSize: '0.75em', padding: '2px 5px', borderRadius: '4px', fontWeight: 600,
                                                                                background: txn.payment_method === 'Online' ? 'rgba(56,189,248,0.2)' : (txn.payment_method === 'Split' ? 'rgba(234,179,8,0.2)' : 'rgba(74,222,128,0.2)'),
                                                                                color: txn.payment_method === 'Online' ? '#38bdf8' : (txn.payment_method === 'Split' ? '#facc15' : '#4ade80')
                                                                            }}>{txn.payment_method || 'Cash'}</span>
                                                                        </td>
                                                                        <td>
                                                                            <span className={`qty-badge ${rem > 0 ? 'low-stock' : 'in-stock'}`}>
                                                                                Rs. {rem.toLocaleString()}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                                                            {txn.purchase_date ? new Date(txn.purchase_date).toLocaleDateString() : '-'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </ScrollableTable>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {payModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2>Receive Company Payment</h2>
                            <button className="icon-btn-small" onClick={() => setPayModal(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {/* Company Payment Info */}
                            <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px', fontSize: '1rem' }}>
                                    🏢 <strong>{payModal.companyName}</strong>
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
                                    Company Representative Payment
                                </p>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Total Customers: <strong style={{ color: 'var(--text-primary)' }}>{payModal.companyData.buyers.length}</strong>
                                    </span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Total Outstanding: <strong style={{ color: '#ef4444' }}>Rs. {payModal.companyData.total_remaining.toLocaleString()}</strong>
                                    </span>
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '12px', fontStyle: 'italic' }}>
                                    💡 Payment will be distributed proportionally across all customers in this company
                                </p>
                            </div>
                            
                            <div className="input-group">
                                <label>Payment Amount (Rs) *</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="Enter amount received..."
                                    min="1"
                                    max={payModal.companyData.total_remaining}
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                    Maximum amount: Rs. {payModal.companyData.total_remaining.toLocaleString()}
                                </small>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
                            <button
                                className="btn-primary"
                                style={{ background: '#22c55e', borderColor: '#22c55e' }}
                                onClick={handlePay}
                                disabled={paying}
                            >
                                {paying ? 'Processing...' : 'Receive Company Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Companies;
