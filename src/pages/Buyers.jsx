import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Plus, MoreVertical, CreditCard, Edit, Trash2, X } from 'lucide-react';
import ProductSideList from '../components/ProductSideList';
import CustomDatePicker from '../components/CustomDatePicker';
import CustomDropdown from '../components/CustomDropdown';
import { notifySuccess, notifyError, confirmAction } from '../utils/notifications';
import ScrollableTable from '../components/ScrollableTable';
import './Buyers.css';

const Buyers = () => {
    const [buyers, setBuyers] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('date_desc');
    const [filterOption, setFilterOption] = useState('all');
    const [totalOutstanding, setTotalOutstanding] = useState(0);

    // Side List State
    const [isSideListOpen, setIsSideListOpen] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    
    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        phone: '',
        address: '',
        company_name: '',
        product_id: '',
        product_name: '',
        quantity: '',
        total_amount: '',
        paid_amount: '',
        purchase_date: new Date().toISOString().split('T')[0],
        txn_id: null,
        add_payment: '',
        remaining_amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        cash_amount: '',
        online_amount: ''
    });

    const [showPhones, setShowPhones] = useState({});
    
    useEffect(() => {
        fetchBuyers();
        fetchProducts();
    }, []);

    const togglePhone = (id, e) => {
        e.stopPropagation();
        setShowPhones(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/products', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProductsList(response.data);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    };

    const fetchBuyers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/buyers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data;
            setBuyers(data);

            // Calculate total outstanding
            let outstanding = 0;
            data.forEach(buyer => {
                if (buyer.buyer_transactions && buyer.buyer_transactions.length > 0) {
                    buyer.buyer_transactions.forEach(txn => {
                        outstanding += (Number(txn.total_amount || 0) - Number(txn.paid_amount || 0));
                    });
                }
            });
            setTotalOutstanding(outstanding);

            setError(null);
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError('Failed to load customers. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const buyer = buyers.find(b => b.id === id);
        if (!buyer) return;
        
        // Check if customer is already in pending list
        if (isCustomerIdInPendingList(id)) {
            notifyError('This customer is already in the pending list.');
            return;
        }
        
        const confirmed = await confirmAction('Pending Deletion', `Add "${buyer.name}" to pending deletions?`);
        if (!confirmed) return;

        // Add to pending list instead of direct deletion
        const newItem = {
            action: 'delete',
            name: buyer.name,
            data: buyer
        };
        
        setPendingItems(prev => [...prev, newItem]);
        setIsSideListOpen(true);
    };

    const openAddModal = () => {
        setModalMode('add');
        setProductSearch('');
        setShowProductDropdown(false);
        setFormData({
            id: null,
            name: '',
            phone: '',
            address: '',
            company_name: '',
            product_id: '',
            product_name: '',
            quantity: '',
            total_amount: '',
            paid_amount: '0',
            purchase_date: new Date().toISOString().split('T')[0],
            txn_id: null,
            add_payment: '',
            remaining_amount: 0,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'Cash',
            cash_amount: '',
            online_amount: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (row) => {
        setModalMode('edit');
        setFormData({
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            address: row.address || '',
            company_name: row.company_name || '',
            txn_id: null,
            add_payment: '',
            remaining_amount: row.remainingAmount || 0,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'Cash',
            cash_amount: '',
            online_amount: ''
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setShowProductDropdown(false);
    };

    const handleProductSelect = (product) => {
        setProductSearch(product.name);
        setFormData(prev => ({
            ...prev,
            product_id: product.id,
            product_name: product.name,
        }));
        setShowProductDropdown(false);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (modalMode === 'add') {
            // Check if customer with same name already exists in pending list
            if (isCustomerIdInPendingList(formData.name)) {
                notifyError('This customer is already in the pending list.');
                return;
            }
            
            // For new customers, add to pending list instead of direct save
            let splitCash = 0;
            let splitOnline = 0;
            let actualPaymentMethod = formData.payment_method || 'Cash';
            let targetAmountForSplitValidation = Number(formData.paid_amount || 0);
            const finalProductName = formData.product_name || productSearch;

            if (actualPaymentMethod === 'Split' && targetAmountForSplitValidation > 0) {
                splitCash = Number(formData.cash_amount || 0);
                splitOnline = Number(formData.online_amount || 0);
                if (splitCash < 0 || splitOnline < 0) {
                    notifyError('Split amounts cannot be negative.');
                    return;
                }
                if (Math.abs((splitCash + splitOnline) - targetAmountForSplitValidation) > 0.01) {
                    notifyError(`Split amounts (${splitCash} + ${splitOnline}) must equal the paid amount (${targetAmountForSplitValidation}).`);
                    return;
                }
            }

            const payload = {
                name: formData.name,
                phone: formData.phone,
                address: formData.address,
                company_name: formData.company_name || null
            };
            
            const salePayload = (formData.product_id || finalProductName) && Number(formData.quantity) > 0 ? {
                product_id: formData.product_id || null,
                product_name: finalProductName,
                quantity: Number(formData.quantity),
                total_amount: Number(formData.total_amount),
                paid_amount: Number(formData.paid_amount || 0),
                bill_type: 'CREDIT',
                payment_method: actualPaymentMethod,
                cash_amount: splitCash,
                online_amount: splitOnline
            } : null;

            const newItem = {
                action: 'add',
                name: formData.name,
                data: payload,
                salePayload
            };
            
            setPendingItems(prev => [...prev, newItem]);
            setIsSideListOpen(true);
            closeModal();
            return;
        }
        
        // For existing customers (edit mode), keep the original logic
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('inventory_token');
            const payload = {
                name: formData.name,
                phone: formData.phone,
                address: formData.address,
                company_name: formData.company_name || null
            };

            let splitCash = 0;
            let splitOnline = 0;
            let actualPaymentMethod = formData.payment_method || 'Cash';
            let targetAmountForSplitValidation = 0;

            const finalProductName = formData.product_name || productSearch;

            if (modalMode === 'add' && (formData.product_id || finalProductName)) {
                targetAmountForSplitValidation = Number(formData.paid_amount || 0);
            } else if (modalMode === 'edit' && formData.add_payment) {
                targetAmountForSplitValidation = Number(formData.add_payment);
            }

            if (actualPaymentMethod === 'Split' && targetAmountForSplitValidation > 0) {
                splitCash = Number(formData.cash_amount || 0);
                splitOnline = Number(formData.online_amount || 0);
                if (splitCash < 0 || splitOnline < 0) {
                    notifyError('Split amounts cannot be negative.');
                    return;
                }
                if (Math.abs((splitCash + splitOnline) - targetAmountForSplitValidation) > 0.01) {
                    notifyError(`Split amounts (${splitCash} + ${splitOnline}) must equal the paid amount (${targetAmountForSplitValidation}).`);
                    return;
                }
            }

            if (modalMode === 'edit') {
                if (formData.add_payment && Number(formData.add_payment) > 0) {
                    if (Number(formData.add_payment) > Number(formData.remaining_amount)) {
                        notifyError("Cannot pay more than remaining credit amount.");
                        return;
                    }
                    // The backend `updateBuyer` handles the payment FIFO logic automatically
                    payload.payment_amount = Number(formData.add_payment);
                    payload.date = formData.payment_date;
                    payload.payment_method = actualPaymentMethod;
                    payload.cash_amount = splitCash;
                    payload.online_amount = splitOnline;
                }

                await axios.put(`/api/buyers/${formData.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            fetchBuyers();
            closeModal();
        } catch (err) {
            console.error('Error saving customer:', err);
            notifyError(err.response?.data?.error || 'Failed to save customer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Check if customer ID already exists in pending list
    const isCustomerIdInPendingList = (customerId) => {
        return pendingItems.some(item => {
            if (item.action === 'add') {
                // For new items, check by name
                return item.name.toLowerCase().trim() === customerId.toLowerCase().trim();
            } else if (item.action === 'delete') {
                // For deletions, check by actual ID
                return item.data.id === customerId;
            }
            return false;
        });
    };

    // Side List Handlers
    const handleRemovePendingItem = (index) => {
        setPendingItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleClearAllPending = async () => {
        const confirmed = await confirmAction('Clear Pending', 'Clear all pending changes?');
        if (confirmed) {
            setPendingItems([]);
        }
    };

    const handleProcessPendingItems = async () => {
        if (pendingItems.length === 0) return;
        
        const confirmed = await confirmAction('Process Changes', `Process ${pendingItems.length} pending changes? This cannot be undone.`);
        if (!confirmed) {
            return;
        }

        setIsProcessing(true);
        const token = localStorage.getItem('inventory_token');
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        try {
            // Process items in order
            for (const item of pendingItems) {
                try {
                    if (item.action === 'add') {
                        const buyerRes = await axios.post('/api/buyers', item.data, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const newBuyer = buyerRes.data.data?.[0];
                        if (newBuyer && item.salePayload) {
                            await axios.post('/api/sales', { ...item.salePayload, buyer_id: newBuyer.id }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                        }
                        successCount++;
                    } else if (item.action === 'delete') {
                        await axios.delete(`/api/buyers/${item.data.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        successCount++;
                    }
                } catch (err) {
                    errorCount++;
                    errors.push(`${item.action === 'add' ? 'Adding' : 'Deleting'} "${item.name}": ${err.response?.data?.error || err.message}`);
                }
            }

            // Show results
            if (errorCount > 0) {
                notifyError(`Processed ${successCount} items. ${errorCount} items failed:\n\n${errors.join('\n')}`);
            } else {
                notifySuccess(`Successfully processed ${successCount} items!`);
            }

            // Clear pending items and refresh buyers
            setPendingItems([]);
            setIsSideListOpen(false);
            fetchBuyers();
        } catch (err) {
            console.error('Error processing pending items:', err);
            notifyError('An unexpected error occurred while processing items.');
        } finally {
            setIsProcessing(false);
        }
    };

    const groupedData = useMemo(() => {
        let filtered = buyers.filter(buyer =>
            buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (buyer.company_name && buyer.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            String(buyer.id).includes(searchQuery)
        );

        let enhancedBuyers = filtered.map(buyer => {
            const txns = buyer.buyer_transactions || [];
            const totalAmount = txns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
            const paidAmount = txns.reduce((sum, t) => sum + Number(t.paid_amount || 0), 0);
            const remainingAmount = Math.max(0, totalAmount - paidAmount);
            
            const methods = new Set(txns.map(t => t.payment_method).filter(Boolean));
            let mergedMethod = 'Cash';
            if (methods.has('Split') || (methods.has('Cash') && methods.has('Online'))) {
                mergedMethod = 'Split';
            } else if (methods.has('Online')) {
                mergedMethod = 'Online';
            }

            let totalCash = 0;
            let totalOnline = 0;
            txns.forEach(t => {
                if (t.payment_method === 'Split') {
                    totalCash += Number(t.cash_amount || 0);
                    totalOnline += Number(t.online_amount || 0);
                } else if (t.payment_method === 'Online') {
                    totalOnline += Number(t.paid_amount || 0);
                } else {
                    totalCash += Number(t.paid_amount || 0);
                }
            });

            return {
                ...buyer,
                totalAmount,
                paidAmount,
                remainingAmount,
                mergedMethod,
                totalCash,
                totalOnline
            };
        });

        // Apply Category/Filter
        if (filterOption !== 'all') {
            enhancedBuyers = enhancedBuyers.filter(row => {
                if (filterOption === 'pending_udhar') return row.remainingAmount > 0;
                if (filterOption === 'cleared') return row.remainingAmount <= 0 && row.totalAmount > 0;
                if (filterOption === 'method_cash') return row.mergedMethod === 'Cash' && row.totalAmount > 0;
                if (filterOption === 'method_online') return row.mergedMethod === 'Online' && row.totalAmount > 0;
                if (filterOption === 'method_split') return row.mergedMethod === 'Split' && row.totalAmount > 0;
                return true;
            });
        }

        // Apply Sort
        enhancedBuyers.sort((a, b) => {
            if (sortOption === 'name_asc') return a.name.localeCompare(b.name);
            if (sortOption === 'name_desc') return b.name.localeCompare(a.name);
            if (sortOption === 'udhar_desc') return b.remainingAmount - a.remainingAmount;
            if (sortOption === 'udhar_asc') return a.remainingAmount - b.remainingAmount;
            if (sortOption === 'date_asc') return a.id - b.id;
            if (sortOption === 'date_desc') return b.id - a.id;
            return 0;
        });

        return enhancedBuyers;
    }, [buyers, searchQuery, filterOption, sortOption]);

    return (
        <>
            <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Customers Directory</h1>
                    <p className="page-subtitle">Track credit sales (Credit) and collections</p>
                </div>
                <button className="btn-primary flex items-center gap-2" onClick={openAddModal}>
                    <Plus size={20} />
                    <span>Add Customer</span>
                </button>
            </div>

            <div className="stats-row">
                <div className="stat-card glass-panel flex-1">
                    <div className="stat-icon-wrapper">
                        <CreditCard size={24} className="stat-icon" />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Outstanding (Credit)</p>
                        <h2 className="stat-value">Rs. {totalOutstanding.toLocaleString()}</h2>
                    </div>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <ScrollableTable className="table-container glass-panel">
                <div className="table-header-controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-wrapper" style={{ flex: '1', minWidth: '300px' }}>
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search customers by ID, name or company..."
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
                                { value: "all", label: "All Customers" },
                                { value: "pending_udhar", label: "Pending Udhar" },
                                { value: "cleared", label: "Cleared" },
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
                                { value: "name_asc", label: "Name (A-Z)" },
                                { value: "name_desc", label: "Name (Z-A)" },
                                { value: "udhar_desc", label: "Highest Udhar First" },
                                { value: "udhar_asc", label: "Lowest Udhar First" }
                            ]}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state text-center py-8">Loading customers...</div>
                ) : (
                    <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Customer Name</th>
                                    <th>Company</th>
                                    <th>Contact</th>
                                    <th>Address</th>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total Amount</th>
                                    <th>Paid Amt</th>
                                    <th>Method</th>
                                    <th>Remaining</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedData.map((row, idx) => {
                                    const txns = row.buyer_transactions && row.buyer_transactions.length > 0 
                                                 ? row.buyer_transactions 
                                                 : [null];
                                    const rowSpan = txns.length;

                                    return (
                                        <React.Fragment key={`buyer-${row.id}`}>
                                            {txns.map((txn, tIdx) => (
                                                <tr key={`buyer-${row.id}-txn-${tIdx}`} className="animate-fade-in" style={{ borderBottom: tIdx === txns.length - 1 ? '3px solid var(--border-color)' : '1px solid var(--border-color)' }}>
                                                    {tIdx === 0 && (
                                                        <>
                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>{row.id}</td>
                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                <div className="buyer-name-cell">
                                                                    <div className="buyer-avatar">
                                                                        {row.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <span className="font-medium text-primary">{row.name}</span>
                                                                </div>
                                                            </td>
                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                {row.company_name ? (
                                                                    <span style={{ backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                                        🏢 {row.company_name}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td rowSpan={rowSpan} onClick={(e) => togglePhone(row.id, e)} style={{ cursor: 'pointer', verticalAlign: 'middle' }}>
                                                                <span className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    {row.phone 
                                                                        ? (showPhones[row.id] ? row.phone : row.phone.replace(/./g, '*')) 
                                                                        : '-'}
                                                                </span>
                                                            </td>
                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}><span className="text-secondary">{row.address || '-'}</span></td>
                                                        </>
                                                    )}

                                                    {/* Transaction specific columns */}
                                                    {txn ? (
                                                        <>
                                                            <td><span className="font-medium">{txn.products?.name || `Product ID: ${txn.product_id}`}</span></td>
                                                            <td>{txn.quantity}</td>
                                                            <td style={{ borderRight: '1px solid var(--border-color)' }}>Rs. {txn.total_amount}</td>
                                                        </>
                                                    ) : (
                                                        <td colSpan="3" className="text-secondary text-center italic" style={{ borderRight: '1px solid var(--border-color)' }}>No transactions</td>
                                                    )}

                                                    {tIdx === 0 && (
                                                        <>
                                                            {row.totalAmount > 0 ? (
                                                                <>
                                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                                                            Rs. {row.totalAmount.toLocaleString()}
                                                                        </span>
                                                                    </td>
                                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                                                            Rs. {row.paidAmount.toLocaleString()}
                                                                        </span>
                                                                    </td>
                                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                                            <span style={{ 
                                                                                fontSize: '0.8em', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, width: 'fit-content',
                                                                                background: row.mergedMethod === 'Online' ? 'rgba(56,189,248,0.15)' : (row.mergedMethod === 'Split' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)'),
                                                                                color: row.mergedMethod === 'Online' ? '#38bdf8' : (row.mergedMethod === 'Split' ? '#facc15' : '#4ade80')
                                                                            }}>{row.mergedMethod}</span>
                                                                            {row.mergedMethod === 'Split' && (
                                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(C:{row.totalCash} O:{row.totalOnline})</span>
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
                                                                            backgroundColor: row.remainingAmount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                                                                            color: row.remainingAmount > 0 ? '#ef4444' : '#22c55e',
                                                                            border: `1px solid ${row.remainingAmount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                                                                        }}>
                                                                            {row.remainingAmount > 0 ? `⚠️ Rs. ${row.remainingAmount.toLocaleString()}` : '✅ Cleared'}
                                                                        </span>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <td colSpan="4" rowSpan={rowSpan} className="text-secondary text-center italic" style={{ verticalAlign: 'middle' }}>No transactions</td>
                                                            )}

                                                            <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                <div className="action-buttons flex gap-2">
                                                                    <button
                                                                        className="icon-btn-small text-accent"
                                                                        title="Edit / Add Payment"
                                                                        onClick={() => openEditModal(row)}
                                                                    >
                                                                        <Edit size={16} />
                                                                    </button>
                                                                    <button
                                                                        className="icon-btn-small text-danger"
                                                                        title="Delete Customer"
                                                                        onClick={() => handleDelete(row.id)}
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}

                                {groupedData.length === 0 && (
                                    <tr>
                                        <td colSpan="12" className="text-center py-8 text-muted">
                                            No customers or Credit records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
            </ScrollableTable>

            {/* Modal for Add / Edit */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel animate-fade-in">
                        <div className="modal-header">
                            <h2>{modalMode === 'add' ? 'Add New Customer' : 'Edit Customer'}</h2>
                            <button className="icon-btn-small" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="modal-body">
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleFormChange}
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Company Name</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        name="company_name"
                                        value={formData.company_name}
                                        onChange={handleFormChange}
                                        placeholder="e.g. ABC Construction Ltd"
                                    />
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Phone / Contact</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleFormChange}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Address</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleFormChange}
                                    />
                                </div>
                            </div>

                            {/* Add Mode: Optional credit transaction */}
                            {modalMode === 'add' && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                        🛒 Credit Details (Optional)
                                    </label>
                                    <div className="form-grid" style={{ marginTop: '8px' }}>
                                        <div className="input-group">
                                            <label>Product</label>
                                            <div className="custom-searchable-dropdown">
                                                <input type="text" className="input-field" placeholder="Search or enter product..." value={productSearch}
                                                    onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                                                    onClick={() => setShowProductDropdown(true)} />
                                                {showProductDropdown && (
                                                    <div className="dropdown-options glass-panel">
                                                        {productsList.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                                            <div key={p.id} className="dropdown-option" onClick={() => handleProductSelect(p)}>
                                                                {p.name} <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>(Qty: {p.remaining_quantity})</span>
                                                            </div>
                                                        ))}
                                                        {productsList.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                                            <div className="dropdown-option text-muted">No products found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Quantity</label>
                                            <input type="number" className="input-field" name="quantity" value={formData.quantity} onChange={handleFormChange} min="1" />
                                        </div>
                                    </div>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Total Amount (Rs)</label>
                                            <input type="number" className="input-field" name="total_amount" value={formData.total_amount} onChange={handleFormChange} min="0" />
                                        </div>
                                        <div className="input-group">
                                            <label>Paid Amount (Rs)</label>
                                            <input type="number" className="input-field" name="paid_amount" value={formData.paid_amount} onChange={handleFormChange} min="0" />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <CustomDatePicker value={formData.purchase_date} onChange={(value) => setFormData({ ...formData, purchase_date: value })} label="Purchase Date" className="purchase-date-picker" />
                                    </div>
                                </div>
                            )}

                            {/* Edit Mode: Update payment */}
                            {modalMode === 'edit' && formData.remaining_amount > 0 && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                        💳 Make Payment — Due: Rs. {Number(formData.remaining_amount || 0).toLocaleString()}
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <input type="number" className="input-field" style={{ flex: 1 }} name="add_payment"
                                            value={formData.add_payment} onChange={handleFormChange} min="0"
                                            placeholder={`Max: Rs. ${formData.remaining_amount}`} />
                                        <CustomDatePicker value={formData.payment_date} onChange={(value) => setFormData({ ...formData, payment_date: value })} label="Date" className="payment-date-picker" />
                                    </div>
                                </div>
                            )}

                            {/* Payment Method pills — shown when there's a payment amount */}
                            {((modalMode === 'add' && Number(formData.paid_amount) > 0) || (modalMode === 'edit' && Number(formData.add_payment) > 0)) && (
                                <div style={{ marginTop: '10px' }}>
                                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Method</label>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                        {['Cash', 'Online', 'Split'].map(pm => (
                                            <button key={pm} type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, payment_method: pm, cash_amount: '', online_amount: '' }))}
                                                style={{
                                                    flex: 1, padding: '7px 0', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                                    background: formData.payment_method === pm ? (pm === 'Cash' ? 'rgba(74,222,128,0.15)' : pm === 'Online' ? 'rgba(56,189,248,0.15)' : 'rgba(251,191,36,0.15)') : 'var(--bg-secondary)',
                                                    color: formData.payment_method === pm ? (pm === 'Cash' ? '#4ade80' : pm === 'Online' ? '#38bdf8' : '#fbbf24') : 'var(--text-secondary)',
                                                    border: `1px solid ${formData.payment_method === pm ? (pm === 'Cash' ? 'rgba(74,222,128,0.4)' : pm === 'Online' ? 'rgba(56,189,248,0.4)' : 'rgba(251,191,36,0.4)') : 'var(--border-color)'}`
                                                }}
                                            >
                                                {pm === 'Cash' ? '💵 Cash' : pm === 'Online' ? '📱 Online' : '🔀 Split'}
                                            </button>
                                        ))}
                                    </div>
                                    {formData.payment_method === 'Split' && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                                <label>Cash (Rs)</label>
                                                <input type="number" className="input-field" name="cash_amount" min="0" value={formData.cash_amount} onChange={handleFormChange} placeholder="0" />
                                            </div>
                                            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                                <label>Online (Rs)</label>
                                                <input type="number" className="input-field" name="online_amount" min="0" value={formData.online_amount} onChange={handleFormChange} placeholder="0" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                                    {isSubmitting ? '⏳ Saving...' : (modalMode === 'add' ? 'Save Customer' : 'Update Customer')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>

            {/* Customer Side List */}
        <ProductSideList
            isOpen={isSideListOpen}
            onClose={() => setIsSideListOpen(false)}
            onToggle={() => setIsSideListOpen(!isSideListOpen)}
            pendingItems={pendingItems}
            onRemoveItem={handleRemovePendingItem}
            onClearAll={handleClearAllPending}
            onProcessItems={handleProcessPendingItems}
            isProcessing={isProcessing}
            entityType="customer"
        />
        </>
    );
};

export default Buyers;
