import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, MoreVertical, Truck, Edit, Trash2, X } from 'lucide-react';
import { notifySuccess, notifyError, confirmAction } from '../utils/notifications';
import ScrollableTable from '../components/ScrollableTable';
import ProductSideList from '../components/ProductSideList';
import './Suppliers.css';

const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPayables, setTotalPayables] = useState(0);

    // Side List State
    const [isSideListOpen, setIsSideListOpen] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        phone: '',
        company_name: '',
        payment_amount: '',
        txn_due: 0,
        product_id: '',
        product_name: '',
        quantity: '',
        total_amount: '',
        paid_amount: '',
        purchase_date: new Date().toISOString().split('T')[0],
        txn_id: null,
        add_payment: '',
        new_total_amount: '',
        remaining_amount: 0,
        txn_paid_amount: 0,
        txn_total_amount: 0,
        unit_price: '',
        payment_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchSuppliers();
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

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/suppliers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data;
            setSuppliers(data);

            // Calculate total payables
            let payables = 0;
            data.forEach(supplier => {
                if (supplier.supplier_transactions && supplier.supplier_transactions.length > 0) {
                    supplier.supplier_transactions.forEach(txn => {
                        payables += (Number(txn.total_amount || 0) - Number(txn.paid_amount || 0));
                    });
                }
            });
            setTotalPayables(payables);

            setError(null);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
            setError('Failed to load suppliers. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (supplier.company_name && supplier.company_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleDelete = async (id) => {
        const supplier = suppliers.find(s => s.id === id);
        if (!supplier) return;
        
        // Check if supplier is already in pending list
        if (isSupplierIdInPendingList(id)) {
            notifyError('This supplier is already in the pending list.');
            return;
        }
        
        const confirmed = await confirmAction('Pending Deletion', `Add "${supplier.name}" to pending deletions?`);
        if (!confirmed) return;

        // Add to pending list instead of direct deletion
        const newItem = {
            action: 'delete',
            name: supplier.name,
            data: supplier
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
            company_name: '',
            payment_amount: '',
            txn_due: 0,
            product_id: '',
            product_name: '',
            quantity: '',
            total_amount: '',
            paid_amount: '0',
            purchase_date: new Date().toISOString().split('T')[0],
            txn_id: null,
            add_payment: '',
            new_total_amount: '',
            remaining_amount: 0,
            txn_paid_amount: 0,
            txn_total_amount: 0,
            unit_price: '',
            payment_date: new Date().toISOString().split('T')[0]
        });
        setIsModalOpen(true);
    };

    const openEditModal = (row) => {
        const { txn } = row;
        // If txn is null, they have no transactions yet. We'll show the add fields for them
        // by pretending it's an edit but with empty transaction fields so they can add one.
        setModalMode('edit');
        setProductSearch('');
        setShowProductDropdown(false);
        const txnDue = (row.supplier_transactions || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);
        setFormData({
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            company_name: row.company_name || '',
            payment_amount: '',
            txn_due: txnDue,

            // For adding new txn if none existed
            product_id: '',
            product_name: '',
            quantity: '',
            total_amount: '',
            paid_amount: '0',
            purchase_date: new Date().toISOString().split('T')[0],
            unit_price: '',

            // For editing existing txn
            txn_id: txn ? txn.id : null,
            add_payment: '',
            new_total_amount: txn ? txn.total_amount : '',
            remaining_amount: txn ? (Number(txn.total_amount || 0) - Number(txn.paid_amount || 0)) : 0,
            txn_paid_amount: txn ? (Number(txn.paid_amount || 0)) : 0,
            txn_total_amount: txn ? (Number(txn.total_amount || 0)) : 0,
            payment_date: new Date().toISOString().split('T')[0]
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setShowProductDropdown(false);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-calculate total_amount = unit_price × quantity
            // This applies to both 'add' and 'edit' (when adding a new transaction)
            if (name === 'quantity' || name === 'unit_price') {
                const qty = parseInt(newData.quantity);
                const price = Number(newData.unit_price);
                if (qty > 0 && price > 0) {
                    newData.total_amount = price * qty;
                } else {
                    newData.total_amount = '';
                }
            }

            return newData;
        });
    };

    const handleProductSelect = (product) => {
        setProductSearch(product.name);
        setFormData(prev => {
            const newData = {
                ...prev,
                product_id: product.id,
                product_name: product.name,
                unit_price: prev.unit_price || product.price
            };

            const qty = parseInt(newData.quantity);
            const price = Number(newData.unit_price);
            if (qty > 0 && price > 0) {
                newData.total_amount = price * qty;
            }
            return newData;
        });
        setShowProductDropdown(false);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (modalMode === 'add') {
            // Check if supplier with same name already exists in pending list
            if (isSupplierIdInPendingList(formData.name)) {
                notifyError('This supplier is already in the pending list.');
                return;
            }
            
            // For new suppliers, add to pending list instead of direct save
            const payload = {
                name: formData.name,
                phone: formData.phone,
                company_name: formData.company_name
            };

            const newItem = {
                action: 'add',
                name: formData.name,
                data: payload
            };
            
            setPendingItems(prev => [...prev, newItem]);
            setIsSideListOpen(true);
            closeModal();
            return;
        }
        
        // For existing suppliers (edit mode), keep the original logic
        try {
            const token = localStorage.getItem('inventory_token');
            const payload = {
                name: formData.name,
                phone: formData.phone,
                company_name: formData.company_name
            };

            if (formData.id && formData.payment_amount) {
                const payAmt = Number(formData.payment_amount);
                if (payAmt > formData.txn_due) {
                    notifyError(`Payment cannot exceed remaining total due: Rs. ${formData.txn_due}`);
                    return;
                }
                if (payAmt < 0) {
                    notifyError('Payment cannot be negative.');
                    return;
                }
                payload.payment_amount = payAmt;
                payload.date = formData.payment_date;
            }

            const finalProductName = formData.product_name || productSearch;

            if (modalMode === 'add') {
                if ((formData.product_id || finalProductName) && Number(formData.quantity) > 0) {
                    if (Number(formData.paid_amount || 0) > Number(formData.total_amount)) {
                        notifyError("Paid amount cannot exceed total amount.");
                        return;
                    }
                    if (Number(formData.paid_amount || 0) < 0 || Number(formData.total_amount) < 0 || Number(formData.quantity) <= 0) {
                        notifyError("Amounts and quantity must be valid positive numbers.");
                        return;
                    }
                }
                const supplierRes = await axios.post('/api/suppliers', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const newSupplier = supplierRes.data.data?.[0];

                if (newSupplier && (formData.product_id || finalProductName) && Number(formData.quantity) > 0) {
                    const purchasePayload = {
                        supplier_id: newSupplier.id,
                        product_id: formData.product_id || null,
                        product_name: finalProductName,
                        quantity: Number(formData.quantity),
                        total_amount: Number(formData.total_amount),
                        paid_amount: Number(formData.paid_amount || 0),
                        purchase_date: formData.purchase_date
                    };

                    await axios.post('/api/purchases', purchasePayload, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            } else {
                // UPDATE EXSITING SUPPLIER
                // First update supplier basic info
                await axios.put(`/api/suppliers/${formData.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (formData.txn_id) {
                    // Updating an existing transaction payment
                    let final_paid_amount = Number(formData.txn_paid_amount || 0);
                    let final_total_amount = Number(formData.txn_total_amount || 0);

                    if (formData.add_payment && Number(formData.add_payment) > 0) {
                        final_paid_amount += Number(formData.add_payment);
                    }
                    if (formData.new_total_amount !== '' && Number(formData.new_total_amount) >= 0) {
                        final_total_amount = Number(formData.new_total_amount);
                    }

                    if (final_paid_amount > final_total_amount) {
                        notifyError("Total paid amount cannot exceed the total amount payable.");
                        return;
                    }
                    if (final_paid_amount < 0 || final_total_amount < 0) {
                        notifyError("Amounts cannot be negative.");
                        return;
                    }

                    const updatePayload = {};
                    if (formData.add_payment && Number(formData.add_payment) > 0) {
                        updatePayload.add_payment = Number(formData.add_payment);
                    }
                    if (formData.new_total_amount && Number(formData.new_total_amount) >= 0) {
                        updatePayload.new_total_amount = Number(formData.new_total_amount);
                    }

                    if (Object.keys(updatePayload).length > 0) {
                        updatePayload.date = formData.payment_date;
                        await axios.put(`/api/purchases/${formData.txn_id}`, updatePayload, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    }
                } else if ((formData.product_id || finalProductName) && Number(formData.quantity) > 0) {
                    // User is adding their first transaction via the Edit modal
                    if (Number(formData.paid_amount || 0) > Number(formData.total_amount)) {
                        notifyError("Paid amount cannot exceed total amount.");
                        return;
                    }
                    if (Number(formData.paid_amount || 0) < 0 || Number(formData.total_amount) < 0 || Number(formData.quantity) <= 0) {
                        notifyError("Amounts and quantity must be valid positive numbers.");
                        return;
                    }

                    const purchasePayload = {
                        supplier_id: formData.id,
                        product_id: formData.product_id || null,
                        product_name: finalProductName,
                        quantity: Number(formData.quantity),
                        total_amount: Number(formData.total_amount),
                        paid_amount: Number(formData.paid_amount || 0),
                        purchase_date: formData.purchase_date
                    };

                    await axios.post('/api/purchases', purchasePayload, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }
            fetchSuppliers();
            closeModal();
        } catch (err) {
            console.error('Error saving supplier:', err);
            notifyError(err.response?.data?.error || 'Failed to save supplier.');
        }
    };

    // Check if supplier ID already exists in pending list
    const isSupplierIdInPendingList = (supplierId) => {
        return pendingItems.some(item => {
            if (item.action === 'add') {
                // For new items, check by name
                return item.name.toLowerCase().trim() === supplierId.toLowerCase().trim();
            } else if (item.action === 'delete') {
                // For deletions, check by actual ID
                return item.data.id === supplierId;
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
                        await axios.post('/api/suppliers', item.data, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        successCount++;
                    } else if (item.action === 'delete') {
                        await axios.delete(`/api/suppliers/${item.data.id}`, {
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

            // Clear pending items and refresh suppliers
            setPendingItems([]);
            setIsSideListOpen(false);
            fetchSuppliers();
        } catch (err) {
            console.error('Error processing pending items:', err);
            notifyError('An unexpected error occurred while processing items.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Build a quick product id → name lookup to use as fallback
    const productMap = {};
    productsList.forEach(p => { productMap[p.id] = p.name; });

    const flattenedData = [];
    filteredSuppliers.forEach(supplier => {
        if (supplier.supplier_transactions && supplier.supplier_transactions.length > 0) {
            supplier.supplier_transactions.forEach(txn => {
                flattenedData.push({ ...supplier, txn });
            });
        } else {
            flattenedData.push({ ...supplier, txn: null });
        }
    });
    return (
        <>
            <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Suppliers Directory</h1>
                    <p className="page-subtitle">Manage distributors and pending payables</p>
                </div>
                <button className="btn-primary flex items-center gap-2" onClick={openAddModal}>
                    <Plus size={20} />
                    <span>Add Supplier</span>
                </button>
            </div>

            <div className="stats-row">
                <div className="stat-card glass-panel flex-1">
                    <div className="stat-icon-wrapper danger-glow">
                        <Truck size={24} className="stat-icon-danger" />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Pending Payables</p>
                        <h2 className="stat-value text-danger">Rs. {totalPayables.toLocaleString()}</h2>
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
                            placeholder="Search suppliers..."
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state text-center py-8">Loading suppliers...</div>
                ) : (
                    <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Supplier / Company</th>
                                    <th>Contact</th>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Purchase Rate</th>
                                    <th>Total Amt</th>
                                    <th>Paid Amt</th>
                                    <th>Remaining (Payable)</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flattenedData.map((row, idx) => {
                                    const { txn } = row;
                                    const remainingPayable = txn ? (Number(txn.total_amount || 0) - Number(txn.paid_amount || 0)) : 0;
                                    return (
                                        <tr key={txn ? `txn-${txn.id}` : `supplier-${row.id}`} className="animate-fade-in">
                                            <td>{row.id}</td>
                                            <td>
                                                <div className="supplier-name-cell">
                                                    <div className="supplier-avatar">
                                                        <Truck size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-primary">{row.name}</div>
                                                        {row.company_name && (
                                                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>
                                                                {row.company_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className="text-secondary">{row.phone || '-'}</span></td>

                                            {txn ? (
                                                <>
                                                    <td><span className="font-medium">{txn.products?.name || productMap[txn.product_id] || `Product #${txn.product_id}`}</span></td>
                                                    <td>{txn.quantity}</td>
                                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                        {txn.quantity && txn.total_amount
                                                            ? `Rs. ${(Number(txn.total_amount) / Number(txn.quantity)).toFixed(0)}`
                                                            : '-'}
                                                    </td>
                                                    <td>Rs. {txn.total_amount}</td>
                                                    <td>Rs. {txn.paid_amount}</td>
                                                    <td>
                                                        <span className={`qty-badge ${remainingPayable > 0 ? 'low-stock text-danger' : 'in-stock'}`}>
                                                            Rs. {remainingPayable}
                                                        </span>
                                                    </td>
                                                </>
                                            ) : (
                                                <td colSpan="6" className="text-secondary text-center italic">No transactions</td>
                                            )}

                                            <td>
                                                <div className="action-buttons flex gap-2">
                                                    <button
                                                        className="icon-btn-small text-accent"
                                                        title="Edit / Update Payment"
                                                        onClick={() => openEditModal(row)}
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        className="icon-btn-small text-danger"
                                                        title="Delete Supplier"
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
                                        <td colSpan="9" className="text-center py-8 text-muted">
                                            No suppliers or payable records found matching your search.
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
                            <h2>{modalMode === 'add' ? 'Add New Supplier' : 'Edit Supplier'}</h2>
                            <button className="icon-btn-small" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="modal-body">
                            <div className="input-group">
                                <label>Contact Person Name</label>
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
                                <label>Company Name (Optional)</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    name="company_name"
                                    value={formData.company_name}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="input-group">
                                <label>Phone / Contact</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            
                            {/* Generic Supplier Payment logic */}
                            {modalMode === 'edit' && formData.txn_due > 0 && (
                                <>
                                    <hr className="my-4 border-gray-700" />
                                    <div className="input-group">
                                        <label style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Make Payment (Rs) <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(max: Rs. {formData.txn_due})</span></label>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Pay off the oldest outstanding bills alphabetically.</p>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="number"
                                                className="input-field"
                                                style={{ flex: 1 }}
                                                name="payment_amount"
                                                value={formData.payment_amount}
                                                onChange={handleFormChange}
                                                placeholder="Enter generic payment..."
                                            />
                                            <input
                                                type="date"
                                                className="input-field"
                                                style={{ width: '140px' }}
                                                name="payment_date"
                                                value={formData.payment_date}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Show transaction fields for Add Mode OR Edit Mode when no previous transaction exists */}
                            {(modalMode === 'add' || (modalMode === 'edit' && !formData.txn_id)) && (
                                <>
                                    <hr className="my-4 border-gray-700" />
                                    <h3 className="text-lg font-medium text-gray-200 mb-4">
                                        {modalMode === 'add' ? 'Purchase / Payables Details (Optional)' : 'Add First Purchase Transaction'}
                                    </h3>

                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Select Product</label>
                                            <div className="custom-searchable-dropdown">
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Search or select product..."
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
                                                                    {p.name}
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
                                            <label>Purchase Quantity</label>
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
                                            <label>Unit Price (Rs)</label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="unit_price"
                                                value={formData.unit_price}
                                                onChange={handleFormChange}
                                                min="0"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Total Amount (Rs)</label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="total_amount"
                                                value={formData.total_amount}
                                                readOnly
                                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-grid">
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
                                        <div className="input-group">
                                            <label>Purchase Date</label>
                                            <input
                                                type="date"
                                                className="input-field"
                                                name="purchase_date"
                                                value={formData.purchase_date}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {modalMode === 'edit' && formData.txn_id && (
                                <>
                                    <hr className="my-4 border-gray-700" />
                                    <h3 className="text-lg font-medium text-gray-200 mb-4">Update Payment / Total</h3>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Remaining Payable (Rs)</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={`Rs. ${formData.remaining_amount}`}
                                                disabled
                                                style={{ backgroundColor: 'var(--bg-secondary)', color: formData.remaining_amount > 0 ? '#f87171' : '#4ade80', fontWeight: 'bold' }}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Update Total Amount (Rs)</label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="new_total_amount"
                                                value={formData.new_total_amount}
                                                onChange={handleFormChange}
                                                min="0"
                                                placeholder="New Total Amount..."
                                            />
                                        </div>
                                    </div>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Add New Payment (Rs) <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(max: {formData.remaining_amount})</span></label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    style={{ flex: 1 }}
                                                    name="add_payment"
                                                    value={formData.add_payment}
                                                    onChange={handleFormChange}
                                                    min="0"
                                                    max={formData.remaining_amount}
                                                    placeholder="Amount to pay..."
                                                />
                                                <input
                                                    type="date"
                                                    className="input-field"
                                                    style={{ width: '140px' }}
                                                    name="payment_date"
                                                    value={formData.payment_date}
                                                    onChange={handleFormChange}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'Save Supplier' : 'Update Supplier'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>

            {/* Supplier Side List */}
        <ProductSideList
            isOpen={isSideListOpen}
            onClose={() => setIsSideListOpen(false)}
            onToggle={() => setIsSideListOpen(!isSideListOpen)}
            pendingItems={pendingItems}
            onRemoveItem={handleRemovePendingItem}
            onClearAll={handleClearAllPending}
            onProcessItems={handleProcessPendingItems}
            isProcessing={isProcessing}
            entityType="supplier"
        />
        </>
    );
};

export default Suppliers;
