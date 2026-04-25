import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Building2, CreditCard, ChevronDown, ChevronUp, X } from 'lucide-react';
import { notifySuccess, notifyError } from '../utils/notifications';
import ScrollableTable from '../components/ScrollableTable';
import CustomDropdown from '../components/CustomDropdown';
import './Companies.css';

const Companies = () => {
    const [buyers, setBuyers] = useState([]);
    const [allSales, setAllSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('name_asc');
    const [filterOption, setFilterOption] = useState('all');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [payModal, setPayModal] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Company Payment');
    const [cashAmount, setCashAmount] = useState('');
    const [onlineAmount, setOnlineAmount] = useState('');
    const [paying, setPaying] = useState(false);
    const [showPhones, setShowPhones] = useState({});

    useEffect(() => { fetchBuyers(); fetchSales(); }, []);

    const togglePhone = (id, e) => {
        e.stopPropagation();
        setShowPhones(prev => ({ ...prev, [id]: !prev[id] }));
    };

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
                    buyer_id: buyer.id,
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
            .filter(([name, data]) => {
                if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                if (filterOption === 'all') return true;

                const totals = data.txns.reduce((acc, txn) => {
                    acc.total += Number(txn.total_amount || 0);
                    acc.paid += Number(txn.paid_amount || 0);
                    return acc;
                }, { total: 0, paid: 0 });
                const remaining = totals.total - totals.paid;

                if (filterOption === 'pending_udhar') return remaining > 0;
                if (filterOption === 'cleared') return remaining <= 0;
                return true;
            })
            .sort(([a, aData], [b, bData]) => {
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

                if (sortOption === 'name_asc') return a.localeCompare(b);
                if (sortOption === 'name_desc') return b.localeCompare(a);
                if (sortOption === 'udhar_desc') return bRemaining - aRemaining;
                if (sortOption === 'udhar_asc') return aRemaining - bRemaining;

                if (aRemaining > 0 && bRemaining <= 0) return -1;
                if (aRemaining <= 0 && bRemaining > 0) return 1;
                if (aRemaining > 0 && bRemaining > 0) return bRemaining - aRemaining;
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
    }, [buyers, allSales, searchQuery, sortOption, filterOption]);

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
        setPaymentMethod('Company Payment');
        setCashAmount('');
        setOnlineAmount('');
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

        if (paymentMethod === 'Split') {
            const splitCash = Number(cashAmount || 0);
            const splitOnline = Number(onlineAmount || 0);
            if (splitCash < 0 || splitOnline < 0) {
                notifyError('Split amounts cannot be negative.');
                return;
            }
            if (Math.abs((splitCash + splitOnline) - amt) > 0.01) {
                notifyError(`Split amounts (${splitCash} + ${splitOnline}) must equal the paid amount (${amt}).`);
                return;
            }
        }

        try {
            setPaying(true);
            const token = localStorage.getItem('inventory_token');
            await axios.post('/api/buyers/company-payment', {
                company_name: payModal.companyName,
                payment_amount: amt,
                date: new Date().toISOString().split('T')[0],
                payment_method: paymentMethod,
                cash_amount: Number(cashAmount || 0),
                online_amount: Number(onlineAmount || 0)
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
                <div className="table-header-controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-wrapper" style={{ flex: '1', minWidth: '300px' }}>
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search companies..."
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
                                { value: "all", label: "All Companies" },
                                { value: "pending_udhar", label: "Pending Outstanding" },
                                { value: "cleared", label: "Cleared" }
                            ]}
                        />
                        <CustomDropdown
                            className="minimal-select"
                            style={{ minWidth: '150px' }}
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            options={[
                                { value: "name_asc", label: "Name (A-Z)" },
                                { value: "name_desc", label: "Name (Z-A)" },
                                { value: "udhar_desc", label: "Highest Outstanding" },
                                { value: "udhar_asc", label: "Lowest Outstanding" }
                            ]}
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

                            // Group txns by customer
                            const customerMap = {};
                            txns.forEach(txn => {
                                const key = txn.buyer_id || txn.buyerName || 'unknown';
                                if (!customerMap[key]) {
                                    customerMap[key] = {
                                        id: txn.buyer_id ? txn.buyer_id : 'Guest',
                                        name: txn.buyerName || '—',
                                        phone: txn.buyerPhone || '—',
                                        txns: []
                                    };
                                }
                                customerMap[key].txns.push(txn);
                            });

                            const groupedCustomers = Object.values(customerMap).map(customer => {
                                let totalAmount = 0;
                                let paidAmount = 0;
                                let totalCash = 0;
                                let totalOnline = 0;
                                const methods = new Set();

                                customer.txns.forEach(t => {
                                    totalAmount += Number(t.total_amount || 0);
                                    paidAmount += Number(t.paid_amount || 0);
                                    if (t.payment_method) methods.add(t.payment_method);

                                    if (t.payment_method === 'Split') {
                                        totalCash += Number(t.cash_amount || 0);
                                        totalOnline += Number(t.online_amount || 0);
                                    } else if (t.payment_method === 'Online') {
                                        totalOnline += Number(t.paid_amount || 0);
                                    } else if (t.payment_method === 'Company Payment') {
                                        // Usually company payment is bulk cash or check, we map it to Cash bucket for simplicity
                                        totalCash += Number(t.paid_amount || 0);
                                    } else {
                                        totalCash += Number(t.paid_amount || 0);
                                    }
                                });

                                let mergedMethod = 'Cash';
                                if (methods.has('Split') || (methods.has('Cash') && methods.has('Online'))) {
                                    mergedMethod = 'Split';
                                } else if (methods.has('Online')) {
                                    mergedMethod = 'Online';
                                } else if (methods.has('Company Payment')) {
                                    mergedMethod = 'Company Payment';
                                }

                                return {
                                    ...customer,
                                    totalAmount,
                                    paidAmount,
                                    remainingAmount: totalAmount - paidAmount,
                                    mergedMethod,
                                    totalCash,
                                    totalOnline
                                };
                            });

                            const uniqueCustomers = groupedCustomers.length;

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
                                                                <th>Id</th>
                                                                <th>Name</th>
                                                                <th>Phone</th>
                                                                <th>Date</th>
                                                                <th>Product</th>
                                                                <th>Price</th>
                                                                <th>Qty</th>
                                                                <th>Total Amount</th>
                                                                <th>Paid Amount</th>
                                                                <th>Method</th>
                                                                <th>Remaining</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {groupedCustomers.map(customer => {
                                                                const txnsArray = customer.txns.length > 0 ? customer.txns : [null];
                                                                const rowSpan = txnsArray.length;

                                                                return txnsArray.map((txn, tIdx) => {
                                                                    const rowStyle = tIdx === rowSpan - 1 ? { borderBottom: '3px solid var(--border-color)' } : {};

                                                                    // Check for date change to add a separator border
                                                                    let dateChanged = false;
                                                                    if (tIdx > 0 && txn && txnsArray[tIdx - 1]) {
                                                                        const prevDate = new Date(txnsArray[tIdx - 1].purchase_date).toLocaleDateString();
                                                                        const currDate = new Date(txn.purchase_date).toLocaleDateString();
                                                                        if (prevDate !== currDate) dateChanged = true;
                                                                    }

                                                                    const dateSeparatorStyle = dateChanged ? { borderTop: '2px solid rgba(56, 189, 248, 0.4)' } : {};

                                                                    return (
                                                                        <tr key={`${customer.id}-${txn ? txn.id : 'empty'}-${tIdx}`} className="animate-fade-in" style={rowStyle}>
                                                                            {tIdx === 0 && (
                                                                                <>
                                                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--border-color)' }}>
                                                                                        <span className="font-bold text-accent">{customer.id}</span>
                                                                                    </td>
                                                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa' }}>
                                                                                                {customer.name?.charAt(0).toUpperCase()}
                                                                                            </div>
                                                                                            <span className="font-medium text-primary">{customer.name}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td rowSpan={rowSpan} onClick={(e) => togglePhone(customer.id, e)} style={{ cursor: 'pointer', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)' }}>
                                                                                        <span className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                            {customer.phone
                                                                                                ? (showPhones[customer.id] ? customer.phone : customer.phone.replace(/./g, '*'))
                                                                                                : '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                </>
                                                                            )}

                                                                            {/* Transaction specific columns */}
                                                                            {txn ? (
                                                                                <>
                                                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', ...dateSeparatorStyle }}>
                                                                                        {txn.purchase_date ? new Date(txn.purchase_date).toLocaleDateString() : '-'}
                                                                                    </td>
                                                                                    <td style={dateSeparatorStyle}><span className="font-medium">{txn.products?.name || `Product ID: ${txn.product_id}`}</span></td>
                                                                                    <td style={dateSeparatorStyle}>Rs. {Number(txn.total_amount).toLocaleString()}</td>
                                                                                    <td style={{ borderRight: '1px solid var(--border-color)', ...dateSeparatorStyle }}>{txn.quantity}</td>
                                                                                </>
                                                                            ) : (
                                                                                <td colSpan="4" className="text-secondary text-center italic" style={{ borderRight: '1px solid var(--border-color)' }}>No transactions</td>
                                                                            )}

                                                                            {tIdx === 0 && (
                                                                                <>
                                                                                    {customer.totalAmount > 0 ? (
                                                                                        <>
                                                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                                                                                    Rs. {customer.totalAmount.toLocaleString()}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                                                                                    Rs. {customer.paidAmount.toLocaleString()}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                                                                    <span style={{
                                                                                                        fontSize: '0.8em', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, width: 'fit-content',
                                                                                                        background: customer.mergedMethod === 'Online' ? 'rgba(56,189,248,0.15)' : (customer.mergedMethod === 'Split' ? 'rgba(234,179,8,0.15)' : (customer.mergedMethod === 'Company Payment' ? 'rgba(168,85,247,0.15)' : 'rgba(34,197,94,0.15)')),
                                                                                                        color: customer.mergedMethod === 'Online' ? '#38bdf8' : (customer.mergedMethod === 'Split' ? '#facc15' : (customer.mergedMethod === 'Company Payment' ? '#a855f7' : '#4ade80'))
                                                                                                    }}>{customer.mergedMethod}</span>
                                                                                                    {customer.mergedMethod === 'Split' && (
                                                                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(C:{customer.totalCash} O:{customer.totalOnline})</span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                                                <span style={{
                                                                                                    padding: '6px 10px',
                                                                                                    borderRadius: '6px',
                                                                                                    fontSize: '0.9em',
                                                                                                    fontWeight: 'bold',
                                                                                                    display: 'inline-flex',
                                                                                                    alignItems: 'center',
                                                                                                    gap: '4px',
                                                                                                    backgroundColor: customer.remainingAmount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                                                                                                    color: customer.remainingAmount > 0 ? '#ef4444' : '#22c55e',
                                                                                                    border: `1px solid ${customer.remainingAmount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                                                                                                }}>
                                                                                                    {customer.remainingAmount > 0 ? `⚠️ Rs. ${customer.remainingAmount.toLocaleString()}` : '✅ Cleared'}
                                                                                                </span>
                                                                                            </td>
                                                                                        </>
                                                                                    ) : (
                                                                                        <td colSpan="4" rowSpan={rowSpan} className="text-secondary text-center italic" style={{ verticalAlign: 'middle' }}>No transactions</td>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </tr>
                                                                    );
                                                                });
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

                            <div className="input-group" style={{ marginTop: '16px' }}>
                                <label>Payment Method</label>
                                <CustomDropdown
                                    className="minimal-select"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    options={[
                                        { value: 'Company Payment', label: 'Company Payment (Default)' },
                                        { value: 'Cash', label: 'Cash' },
                                        { value: 'Online', label: 'Online (Easypaisa/Jazzcash)' },
                                        { value: 'Split', label: 'Split (Cash + Online)' }
                                    ]}
                                />
                            </div>

                            {paymentMethod === 'Split' && (
                                <div className="form-grid" style={{ marginTop: '16px', background: 'rgba(56, 189, 248, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                    <div className="input-group">
                                        <label>Cash Paid (Rs)</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="Enter cash amount"
                                            min="0"
                                            value={cashAmount}
                                            onChange={(e) => setCashAmount(e.target.value)}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Online Paid (Rs)</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="Enter online amount"
                                            min="0"
                                            value={onlineAmount}
                                            onChange={(e) => setOnlineAmount(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
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
