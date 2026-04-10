import { useState, useEffect, useMemo } from 'react';
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
    const [totalOutstanding, setTotalOutstanding] = useState(0);

    // Side List State
    const [isSideListOpen, setIsSideListOpen] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

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

    useEffect(() => {
        fetchBuyers();
        fetchProducts();
    }, []);

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
        const { txn } = row;
        setModalMode('edit');
        setFormData({
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            address: row.address || '',
            company_name: row.company_name || '',
            txn_id: txn ? txn.id : null,
            add_payment: '',
            remaining_amount: txn ? (Number(txn.total_amount || 0) - Number(txn.paid_amount || 0)) : 0,
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
            } else if (modalMode === 'edit' && formData.txn_id && formData.add_payment) {
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
                if (formData.txn_id && formData.add_payment && Number(formData.add_payment) > 0) {
                    if (Number(formData.add_payment) > Number(formData.remaining_amount)) {
                        notifyError("Cannot pay more than remaining credit amount.");
                        return;
                    }
                    // Update the transaction parallel to buyer update
                    await axios.put(`/api/sales/${formData.txn_id}`, {
                        add_payment: Number(formData.add_payment),
                        date: formData.payment_date,
                        payment_method: actualPaymentMethod,
                        cash_amount: splitCash,
                        online_amount: splitOnline
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
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

    const flattenedData = useMemo(() => {
        const filtered = buyers.filter(buyer =>
            buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (buyer.company_name && buyer.company_name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        const flattened = [];
        filtered.forEach(buyer => {
            if (buyer.buyer_transactions && buyer.buyer_transactions.length > 0) {
                buyer.buyer_transactions.forEach(txn => {
                    flattened.push({ ...buyer, txn });
                });
            } else {
                // Buyer with no transactions yet
                flattened.push({ ...buyer, txn: null });
            }
        });
        return flattened;
    }, [buyers, searchQuery]);

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
                <div className="table-header-controls">
                    <div className="search-wrapper">
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search customers by name or company..."
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                                    <th>Total Amt</th>
                                    <th>Paid Amt</th>
                                    <th>Method</th>
                                    <th>Remaining (Credit)</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flattenedData.map((row, idx) => {
                                    const { txn } = row;
                                    const remainingAmount = txn ? (Number(txn.total_amount || 0) - Number(txn.paid_amount || 0)) : 0;
                                    return (
                                        <tr key={txn ? `txn-${txn.id}` : `buyer-${row.id}`} className="animate-fade-in">
                                            <td>{row.id}</td>
                                            <td>
                                                <div className="buyer-name-cell">
                                                    <div className="buyer-avatar">
                                                        {row.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-primary">{row.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {row.company_name ? (
                                                    <span style={{ backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                        🏢 {row.company_name}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td><span className="text-secondary">{row.phone || '-'}</span></td>
                                            <td><span className="text-secondary">{row.address || '-'}</span></td>

                                            {txn ? (
                                                <>
                                                    <td><span className="font-medium">{txn.products?.name || `Product ID: ${txn.product_id}`}</span></td>
                                                    <td>{txn.quantity}</td>
                                                    <td>Rs. {txn.total_amount}</td>
                                                    <td>Rs. {txn.paid_amount}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ 
                                                                fontSize: '0.8em', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, width: 'fit-content',
                                                                background: txn.payment_method === 'Online' ? 'rgba(56,189,248,0.15)' : (txn.payment_method === 'Split' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)'),
                                                                color: txn.payment_method === 'Online' ? '#38bdf8' : (txn.payment_method === 'Split' ? '#facc15' : '#4ade80')
                                                            }}>{txn.payment_method || 'Cash'}</span>
                                                            {txn.payment_method === 'Split' && (
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(C:{txn.cash_amount} O:{txn.online_amount})</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`qty-badge ${remainingAmount > 0 ? 'low-stock' : 'in-stock'}`}>
                                                            Rs. {remainingAmount}
                                                        </span>
                                                    </td>
                                                </>
                                            ) : (
                                                <td colSpan="5" className="text-secondary text-center italic">No transactions</td>
                                            )}

                                            <td>
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
                                        </tr>
                                    );
                                })}

                                {flattenedData.length === 0 && (
                                    <tr>
                                        <td colSpan="11" className="text-center py-8 text-muted">
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

                            {/* Only show transaction fields for Add Mode */}
                            {modalMode === 'add' && (
                                <>
                                    <hr className="my-4 border-gray-700" />
                                    <h3 className="text-lg font-medium text-gray-200 mb-4">Credit / Credit Details (Optional)</h3>

                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Select Product</label>
                                            <div className="custom-searchable-dropdown">
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Search or enter product..."
                                                    value={productSearch}
                                                    onChange={(e) => {
                                                        setProductSearch(e.target.value);
                                                        setShowProductDropdown(true);
                                                    }}
                                                    onClick={() => setShowProductDropdown(true)}
                                                />
                                                {showProductDropdown && (
                                                    <div className="dropdown-options glass-panel">
                                                        {productsList
                                                            .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                                                            .map(p => (
                                                                <div
                                                                    key={p.id}
                                                                    className="dropdown-option"
                                                                    onClick={() => handleProductSelect(p)}
                                                                >
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
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="quantity"
                                                value={formData.quantity}
                                                onChange={handleFormChange}
                                                min="1"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Total Amount (Rs)</label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="total_amount"
                                                value={formData.total_amount}
                                                onChange={handleFormChange}
                                                min="0"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Paid Amount (Rs)</label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="paid_amount"
                                                value={formData.paid_amount}
                                                onChange={handleFormChange}
                                                min="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <CustomDatePicker
                                            value={formData.purchase_date}
                                            onChange={(value) => setFormData({ ...formData, purchase_date: value })}
                                            label="Purchase Date"
                                            className="purchase-date-picker"
                                        />
                                    </div>
                                </>
                            )}

                            {modalMode === 'edit' && formData.txn_id && (
                                <>
                                    <hr className="my-4 border-gray-700" />
                                    <h3 className="text-lg font-medium text-gray-200 mb-4">Update Payment</h3>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Remaining Amount (Rs)</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={formData.remaining_amount}
                                                disabled
                                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Add New Payment (Rs)</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    name="add_payment"
                                                    value={formData.add_payment}
                                                    onChange={handleFormChange}
                                                    min="0"
                                                    placeholder="Amount to pay..."
                                                />
                                                <CustomDatePicker
                                                    value={formData.payment_date}
                                                    onChange={(value) => setFormData({ ...formData, payment_date: value })}
                                                    label="Payment Date"
                                                    className="payment-date-picker"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {((modalMode === 'add' && formData.paid_amount > 0) || (modalMode === 'edit' && formData.add_payment > 0)) && (
                                <>
                                    <hr className="my-4 border-gray-700" />
                                    <h3 className="text-lg font-medium text-gray-200 mb-4">Payment Method</h3>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <CustomDropdown
                                                className="minimal-select"
                                                value={formData.payment_method}
                                                onChange={(e) => setFormData(prev => ({...prev, payment_method: e.target.value}))}
                                                options={[
                                                    { value: 'Cash', label: 'Cash' },
                                                    { value: 'Online', label: 'Online (Easypaisa/Jazzcash)' },
                                                    { value: 'Split', label: 'Split (Cash + Online)' }
                                                ]}
                                            />
                                        </div>
                                    </div>

                                    {formData.payment_method === 'Split' && (
                                        <div className="form-grid" style={{ marginTop: '16px', background: 'rgba(56, 189, 248, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                            <div className="input-group">
                                                <label>Cash Paid (Rs)</label>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    placeholder="Enter cash amount"
                                                    name="cash_amount"
                                                    min="0"
                                                    value={formData.cash_amount}
                                                    onChange={handleFormChange}
                                                />
                                            </div>
                                            <div className="input-group">
                                                <label>Online Paid (Rs)</label>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    placeholder="Enter online amount"
                                                    name="online_amount"
                                                    min="0"
                                                    value={formData.online_amount}
                                                    onChange={handleFormChange}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'Save Customer' : 'Update Customer'}
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
