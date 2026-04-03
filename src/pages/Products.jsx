import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Plus, Package, SlidersHorizontal, Edit, Trash2, X } from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';
import CustomDatePicker from '../components/CustomDatePicker';
import ProductSideList from '../components/ProductSideList';
import { notifySuccess, notifyError, confirmAction } from '../utils/notifications';
import './Products.css';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [suppliersList, setSuppliersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [sortBy, setSortBy] = useState('default');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [supplierTxnInfo, setSupplierTxnInfo] = useState(null); // { txn_id, total_amount, paid_amount, remaining }
    const [addPaymentAmount, setAddPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [showPurchaseRates, setShowPurchaseRates] = useState({});

    // Side List State
    const [isSideListOpen, setIsSideListOpen] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const formatProductId = (id) => {
        if (!id) return '';
        return String(id).toUpperCase();
    };
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        category: '',
        price: '',
        purchase_rate: '',
        color: '',
        purchased_from: '',
        purchase_date: '',
        total_quantity: '',
        remaining_display: '',
        add_quantity: '',
        restock_paid_amount: '',
        restock_purchase_date: '',
        quantity_unit: 'Piece',
        low_stock_threshold: '10',
        paid_amount: '',
        supplier_phone: '',
        supplier_company_name: ''
    });

    useEffect(() => {
        fetchProducts();
        fetchSuppliers();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/products', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching products:', err);
            setError('Failed to load products. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/suppliers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliersList(response.data);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
        }
    };

    const handleDelete = async (id) => {
        const product = products.find(p => p.id === id);
        if (!product) return;

        // Check if product is already in pending list
        if (isProductIdInPendingList(id)) {
            notifyError('This product is already in the pending list.');
            return;
        }

        const confirmed = await confirmAction('Pending Deletion', `Add "${product.name}" to pending deletions?`);
        if (!confirmed) return;

        // Add to pending list instead of direct deletion
        const newItem = {
            action: 'delete',
            name: product.name,
            data: product
        };

        setPendingItems(prev => [...prev, newItem]);
        setIsSideListOpen(true);
    };

    const openAddModal = () => {
        setModalMode('add');
        setSupplierSearch('');
        setShowSupplierDropdown(false);
        setFormData({
            id: null,
            name: '',
            category: '',
            price: '',
            purchase_rate: '',
            color: '',
            purchased_from: '',
            purchase_date: new Date().toISOString().split('T')[0],
            total_quantity: '',
            remaining_display: '',
            add_quantity: '',
            restock_paid_amount: '',
            restock_purchase_date: new Date().toISOString().split('T')[0],
            quantity_unit: 'Piece',
            low_stock_threshold: '10',
            paid_amount: '',
            supplier_phone: '',
            supplier_company_name: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = async (product) => {
        setModalMode('edit');
        setSupplierSearch(product.purchased_from || '');
        setShowSupplierDropdown(false);
        setAddPaymentAmount('');
        setFormData({
            id: product.id,
            name: product.name,
            category: product.category || '',
            price: product.price,
            purchase_rate: product.purchase_rate || '',
            color: product.color || '',
            purchased_from: product.purchased_from || '',
            purchase_date: product.purchase_date ? new Date(product.purchase_date).toISOString().split('T')[0] : '',
            total_quantity: product.total_quantity,
            remaining_display: String(product.remaining_quantity ?? ''),
            add_quantity: '',
            restock_paid_amount: '',
            restock_purchase_date: new Date().toISOString().split('T')[0],
            quantity_unit: product.quantity_unit || 'Piece',
            low_stock_threshold: product.low_stock_threshold !== undefined && product.low_stock_threshold !== null ? String(product.low_stock_threshold) : '10',
            paid_amount: '',
            supplier_phone: '',
            supplier_company_name: ''
        });

        // Fetch supplier transactions for this product
        try {
            const token = localStorage.getItem('inventory_token');
            const txnRes = await axios.get('/api/purchases', { headers: { Authorization: `Bearer ${token}` } });
            const productTxns = txnRes.data.filter(t => t.product_id === product.id);
            if (productTxns.length > 0) {
                const totalOwed = productTxns.reduce((s, t) => s + Number(t.total_amount || 0), 0);
                const totalPaid = productTxns.reduce((s, t) => s + Number(t.paid_amount || 0), 0);
                // Use the most recent transaction to update payments
                const latestTxn = productTxns.sort((a, b) => b.id - a.id)[0];
                setSupplierTxnInfo({
                    txn_id: latestTxn.id,
                    total_amount: totalOwed,
                    paid_amount: totalPaid,
                    remaining: totalOwed - totalPaid
                });
            } else {
                setSupplierTxnInfo(null);
            }
        } catch (err) {
            setSupplierTxnInfo(null);
        }

        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setShowSupplierDropdown(false);
        setSupplierTxnInfo(null);
        setAddPaymentAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
    };

    const handleSupplierSelect = (supplierName) => {
        setSupplierSearch(supplierName);
        setFormData(prev => ({ ...prev, purchased_from: supplierName }));
        setShowSupplierDropdown(false);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const totalToPaySupplier = useMemo(() => {
        const rate = parseFloat(formData.purchase_rate);
        const qty = parseInt(formData.total_quantity, 10);
        if (!isNaN(rate) && rate > 0 && !isNaN(qty) && qty > 0) return rate * qty;
        return null;
    }, [formData.purchase_rate, formData.total_quantity]);

    const restockBatch = useMemo(() => {
        if (modalMode !== 'edit') return null;
        const rate = parseFloat(formData.purchase_rate);
        const q = parseInt(formData.add_quantity, 10);
        if (isNaN(q) || q <= 0) return null;
        const rateNum = isNaN(rate) ? 0 : rate;
        const supplierDue = rateNum * q;
        const paidRawNum = parseFloat(formData.restock_paid_amount || 0);
        const paidClamped = Math.min(Math.max(0, isNaN(paidRawNum) ? 0 : paidRawNum), supplierDue);
        const balance = Math.max(0, supplierDue - paidClamped);
        return { q, rate: rateNum, supplierDue, paidRaw: isNaN(paidRawNum) ? 0 : paidRawNum, balance };
    }, [modalMode, formData.purchase_rate, formData.add_quantity, formData.restock_paid_amount]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (formData.purchase_rate !== '' && formData.purchase_rate !== null) {
            const pr = parseFloat(formData.purchase_rate);
            const sp = parseFloat(formData.price);
            if (pr < 0) {
                notifyError('Purchase rate cannot be negative.');
                return;
            }
            if (pr > sp) {
                notifyError('Purchase rate cannot be greater than sale price.');
                return;
            }
        }

        if (modalMode === 'add') {
            // Check if product with same name already exists in pending list
            if (isProductIdInPendingList(formData.name.trim())) {
                notifyError('This product is already in the pending list.');
                return;
            }

            // Validate required fields
            if (!formData.name.trim() || !formData.price || !formData.total_quantity) {
                notifyError('Please fill in all required fields.');
                return;
            }

            // Add to pending list instead of direct database operation
            const dataToSubmit = {
                name: formData.name.trim(),
                category: formData.category,
                price: parseFloat(formData.price),
                purchase_rate: formData.purchase_rate ? parseFloat(formData.purchase_rate) : null,
                color: formData.color || null,
                purchased_from: formData.purchased_from?.trim() || '',
                purchase_date: formData.purchase_date,
                total_quantity: parseInt(formData.total_quantity, 10),
                quantity_unit: formData.quantity_unit,
                paid_amount: formData.paid_amount ? parseFloat(formData.paid_amount) : 0,
                supplier_phone: formData.supplier_phone,
                supplier_company_name: formData.supplier_company_name
            };

            const newItem = {
                action: 'add',
                name: formData.name.trim(),
                data: dataToSubmit
            };

            setPendingItems(prev => [...prev, newItem]);
            setIsSideListOpen(true);
            closeModal();
        } else {
            // Edit mode remains the same (direct database operation)
            try {
                const token = localStorage.getItem('inventory_token');
                const addQ = formData.add_quantity !== '' && formData.add_quantity != null
                    ? parseInt(formData.add_quantity, 10)
                    : 0;
                const hasRestock = !isNaN(addQ) && addQ > 0;

                if (hasRestock) {
                    if (!formData.purchased_from?.trim()) {
                        notifyError('Supplier is required when adding stock.');
                        return;
                    }
                    const rate = parseFloat(formData.purchase_rate || 0);
                    const batchTotal = rate * addQ;
                    const paidRestock = parseFloat(formData.restock_paid_amount || 0);
                    if (paidRestock < 0 || paidRestock > batchTotal) {
                        notifyError(`Payment cannot exceed this batch total (Rs. ${batchTotal.toLocaleString()}).`);
                        return;
                    }
                }

                const dataToSubmit = {
                    name: formData.name.trim(),
                    category: formData.category,
                    price: parseFloat(formData.price),
                    purchase_rate: formData.purchase_rate ? parseFloat(formData.purchase_rate) : null,
                    color: formData.color || null,
                    purchased_from: formData.purchased_from?.trim() || '',
                    purchase_date: formData.purchase_date,
                    quantity_unit: formData.quantity_unit,
                    low_stock_threshold: formData.low_stock_threshold ? Number(formData.low_stock_threshold) : 10,
                    supplier_phone: formData.supplier_phone,
                    supplier_company_name: formData.supplier_company_name,
                    set_total_quantity: formData.total_quantity !== '' ? parseInt(formData.total_quantity, 10) : undefined,
                    set_remaining_quantity: formData.remaining_display !== '' ? parseInt(formData.remaining_display, 10) : undefined
                };
                if (hasRestock) {
                    dataToSubmit.add_quantity = addQ;
                    dataToSubmit.restock_paid_amount = parseFloat(formData.restock_paid_amount || 0);
                    dataToSubmit.restock_purchase_date =
                        formData.restock_purchase_date || new Date().toISOString().split('T')[0];
                }

                await axios.put(`/api/products/${formData.id}`, dataToSubmit, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (addPaymentAmount && Number(addPaymentAmount) > 0 && supplierTxnInfo?.txn_id) {
                    if (Number(addPaymentAmount) > supplierTxnInfo.remaining) {
                        notifyError('Payment cannot exceed remaining amount: Rs. ' + supplierTxnInfo.remaining);
                        return;
                    }
                    await axios.put(`/api/purchases/${supplierTxnInfo.txn_id}`, {
                        add_payment: Number(addPaymentAmount),
                        date: paymentDate
                    }, { headers: { Authorization: `Bearer ${token}` } });
                }

                fetchProducts();
                closeModal();
            } catch (err) {
                console.error('Error saving product:', err);
                notifyError(err.response?.data?.error || 'Failed to save product.');
            }
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = product.name.toLowerCase().includes(query) ||
                String(product.id).includes(query) ||
                formatProductId(product.id).toLowerCase().includes(query);

            let matchesCategory = true;
            const remaining = Number(product.remaining_quantity || 0);
            const threshold = product.low_stock_threshold !== undefined && product.low_stock_threshold !== null ? product.low_stock_threshold : 10;

            if (activeCategory === 'Low Stock') {
                matchesCategory = remaining > 0 && remaining <= threshold;
            } else if (activeCategory === 'Out of Stock') {
                matchesCategory = remaining === 0;
            } else if (activeCategory !== 'All') {
                matchesCategory = product.category === activeCategory;
            }

            return matchesSearch && matchesCategory;
        }).sort((a, b) => {
            if (sortBy === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'priceAsc') return parseFloat(a.price || 0) - parseFloat(b.price || 0);
            if (sortBy === 'stockAsc') return parseInt(a.remaining_quantity || 0) - parseInt(b.remaining_quantity || 0);
            return 0;
        });
    }, [products, searchQuery, activeCategory, sortBy]);

    const togglePurchaseRate = (id) => {
        setShowPurchaseRates(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
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

    // Check if product ID already exists in pending list
    const isProductIdInPendingList = (productId) => {
        return pendingItems.some(item => {
            if (item.action === 'add') {
                // For new items, we don't have an ID yet, so check by name
                return item.name.toLowerCase().trim() === productId.toLowerCase().trim();
            } else if (item.action === 'delete') {
                // For deletions, check by actual ID
                return item.data.id === productId;
            }
            return false;
        });
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
                        await axios.post('/api/products', item.data, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        successCount++;
                    } else if (item.action === 'delete') {
                        await axios.delete(`/api/products/${item.data.id}`, {
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

            // Clear pending items and refresh products
            setPendingItems([]);
            setIsSideListOpen(false);
            fetchProducts();
        } catch (err) {
            console.error('Error processing pending items:', err);
            notifyError('An unexpected error occurred while processing items.');
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleSideList = () => {
        setIsSideListOpen(!isSideListOpen);
    };

    const categories = ['All', 'Paint', 'Electric', 'Hardware', 'Low Stock', 'Out of Stock'];

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Products Inventory</h1>
                    <p className="page-subtitle">Manage and track your supplies</p>
                </div>
                <button className="btn-primary flex items-center gap-2" onClick={openAddModal}>
                    <Plus size={20} />
                    <span>Add Product</span>
                </button>
            </div>

            <div className="controls-bar glass-panel" style={{ position: 'relative', zIndex: 10 }}>
                <div className="search-wrapper">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="category-tabs flex-1" style={{ display: 'flex', gap: '10px', marginLeft: '20px' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '20px',
                                border: 'none',
                                backgroundColor: activeCategory === cat ? 'var(--text-primary)' : 'transparent',
                                color: activeCategory === cat ? 'var(--bg-primary)' : 'var(--text-muted)',
                                boxShadow: activeCategory === cat ? 'var(--shadow-sm)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: activeCategory === cat ? '600' : '500'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>Arrange by:</span>
                    <CustomDropdown
                        className="minimal-select"
                        style={{ minWidth: '150px' }}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        options={[
                            { value: 'default', label: 'Default' },
                            { value: 'nameAsc', label: 'Name (A-Z)' },
                            { value: 'priceAsc', label: 'Price (Low to High)' },
                            { value: 'stockAsc', label: 'Stock (Low to High)' }
                        ]}
                    />
                </div>

                <button className="icon-btn" title="Filter options" style={{ marginLeft: '10px' }}>
                    <SlidersHorizontal size={20} />
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="table-container glass-panel">
                {loading ? (
                    <div className="loading-state">Loading products...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="empty-state">
                        <Package size={48} className="empty-icon" />
                        <h3>No products found</h3>
                        <p>Try adjusting your search or add a new product</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Sale Price</th>
                                <th>Purchase Rate</th>
                                <th>Color</th>
                                <th>Unit</th>
                                <th>Purchased From</th>
                                <th>Purchase Date</th>
                                <th>Total Qty</th>
                                <th>Remaining Qty</th>
                                <th>Alert Limit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(product => {
                                const remaining = Number(product.remaining_quantity || 0);
                                const threshold = product.low_stock_threshold !== undefined && product.low_stock_threshold !== null ? product.low_stock_threshold : 10;
                                let rowStyle = {};
                                if (remaining === 0) {
                                    rowStyle = { borderLeft: '4px solid #ef4444' };
                                } else if (remaining <= threshold) {
                                    rowStyle = { borderLeft: '4px solid #eab308' };
                                }

                                return (
                                    <tr key={product.id} className="animate-fade-in" style={rowStyle}>
                                        <td className="font-bold text-accent">{formatProductId(product.id)}</td>
                                        <td className="font-medium">{product.name}</td>
                                        <td>
                                            <span className="badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {product.category || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td>Rs. {product.price}</td>
                                        <td
                                            onClick={() => togglePurchaseRate(product.id)}
                                            style={{ cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold' }}
                                            title="Click to toggle visibility"
                                        >
                                            {product.purchase_rate
                                                ? (showPurchaseRates[product.id] ? `Rs. ${product.purchase_rate}` : '***')
                                                : '-'}
                                        </td>
                                        <td>
                                            {product.color ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: product.color, border: '2px solid rgba(255,255,255,0.2)', display: 'inline-block' }}></span>
                                                    <span style={{ fontSize: '0.8rem' }}>{product.color}</span>
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <span className="badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {product.quantity_unit || 'Piece'}
                                            </span>
                                        </td>
                                        <td>{product.purchased_from || '-'}</td>
                                        <td>{product.purchase_date ? new Date(product.purchase_date).toLocaleDateString() : '-'}</td>
                                        <td>{product.total_quantity}</td>
                                        <td>
                                            <span className="qty-badge" style={{ backgroundColor: remaining === 0 ? 'rgba(239, 68, 68, 0.1)' : (remaining <= threshold ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)'), color: remaining === 0 ? '#ef4444' : (remaining <= threshold ? '#ca8a04' : '#22c55e'), padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                {remaining} {remaining === 0 ? '(Out of Stock)' : (remaining <= threshold ? `(Low Stock)` : '')}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {threshold}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="icon-btn-small text-accent"
                                                    title="Update"
                                                    onClick={() => openEditModal(product)}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="icon-btn-small text-danger"
                                                    title="Delete"
                                                    onClick={() => handleDelete(product.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal for Add / Edit */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel animate-fade-in">
                        <div className="modal-header">
                            <h2>{modalMode === 'add' ? 'Add New Product' : 'Update Product'}</h2>
                            <button className="icon-btn-small" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="modal-body">
                            <div className="input-group">
                                <label>Product Name <span style={{ color: 'var(--danger-color, #ef4444)' }}>*</span></label>
                                <input
                                    type="text"
                                    className="input-field"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    placeholder="Enter product name"
                                    required
                                />
                            </div>

                            {modalMode === 'add' && (
                                <>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Sale Price (Rs) <span style={{ color: 'var(--danger-color, #ef4444)' }}>*</span></label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleFormChange}
                                                min="0"
                                                placeholder="0"
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Purchase Price (Rs)</label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="purchase_rate"
                                                value={formData.purchase_rate}
                                                onChange={handleFormChange}
                                                min="0"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Total Qty (Stock) <span style={{ color: 'var(--danger-color, #ef4444)' }}>*</span></label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="total_quantity"
                                                value={formData.total_quantity}
                                                onChange={handleFormChange}
                                                min="0"
                                                placeholder="0"
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Unit</label>
                                            <CustomDropdown
                                                className="minimal-select"
                                                name="quantity_unit"
                                                value={formData.quantity_unit}
                                                onChange={handleFormChange}
                                                options={[
                                                    { value: 'Piece', label: 'Piece' },
                                                    { value: 'Dozen', label: 'Dozen' },
                                                    { value: 'Box', label: 'Box' },
                                                    { value: 'Ft', label: 'Ft' },
                                                    { value: 'Meter', label: 'Meter' },
                                                    { value: 'Liter', label: 'Liter' },
                                                    { value: 'Gallon', label: 'Gallon' },
                                                    { value: 'Bucket', label: 'Bucket / Balti' },
                                                    { value: '250 Gram', label: '250 Gram' },
                                                    { value: 'Kg', label: 'Kg' },
                                                    { value: 'Gram', label: 'Gram' },
                                                    { value: 'Inch', label: 'Inch' },
                                                    { value: 'Millimeter', label: 'Millimeter' },
                                                    { value: 'Pair', label: 'Pair' },
                                                    { value: 'Set', label: 'Set' },
                                                    { value: 'Strip', label: 'Strip' },
                                                    { value: 'Roll', label: 'Roll' },
                                                    { value: 'Bag', label: 'Bag' },
                                                    { value: 'Coil', label: 'Coil' }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                    {totalToPaySupplier !== null && (
                                        <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supplier due</span>
                                            <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1rem' }}>Rs. {totalToPaySupplier.toLocaleString()}</span>
                                        </div>
                                    )}
                                </>
                            )}

                            {modalMode === 'edit' && (
                                <>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Total qty <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Edit to adjust)</span></label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="total_quantity"
                                                value={formData.total_quantity}
                                                onChange={handleFormChange}
                                                min="0"
                                                style={{ borderColor: 'rgba(99,102,241,0.4)' }}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Remaining <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Edit to adjust)</span></label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                name="remaining_display"
                                                value={formData.remaining_display}
                                                onChange={handleFormChange}
                                                min="0"
                                                style={{ borderColor: 'rgba(99,102,241,0.4)' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label>Unit</label>
                                        <CustomDropdown
                                            className="minimal-select"
                                            name="quantity_unit"
                                            value={formData.quantity_unit}
                                            onChange={handleFormChange}
                                            options={[
                                                { value: 'Piece', label: 'Piece' },
                                                { value: 'Dozen', label: 'Dozen' },
                                                { value: 'Box', label: 'Box' },
                                                { value: 'Ft', label: 'Ft' },
                                                { value: 'Meter', label: 'Meter' },
                                                { value: 'Liter', label: 'Liter' },
                                                { value: 'Gallon', label: 'Gallon' },
                                                { value: 'Bucket', label: 'Bucket / Balti' },
                                                { value: '250 Gram', label: '250 Gram' },
                                                { value: 'Kg', label: 'Kg' },
                                                { value: 'Gram', label: 'Gram' },
                                                { value: 'Inch', label: 'Inch' },
                                                { value: 'Millimeter', label: 'Millimeter' },
                                                { value: 'Pair', label: 'Pair' },
                                                { value: 'Set', label: 'Set' },
                                                { value: 'Strip', label: 'Strip' },
                                                { value: 'Roll', label: 'Roll' },
                                                { value: 'Bag', label: 'Bag' },
                                                { value: 'Coil', label: 'Coil' }
                                            ]}
                                        />
                                    </div>
                                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', marginBottom: '16px', backgroundColor: 'var(--bg-secondary)' }}>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>Restock</label>
                                        <div className="form-grid">
                                            <div className="input-group">
                                                <label>Sale price (Rs) <span style={{ color: 'var(--danger-color, #ef4444)' }}>*</span></label>
                                                <input type="number" className="input-field" name="price" value={formData.price} onChange={handleFormChange} min="0" required />
                                            </div>
                                            <div className="input-group">
                                                <label>Purchase rate (Rs)</label>
                                                <input type="number" className="input-field" name="purchase_rate" value={formData.purchase_rate} onChange={handleFormChange} min="0" placeholder="0" />
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Add qty</label>
                                            <input type="number" className="input-field" name="add_quantity" value={formData.add_quantity} onChange={handleFormChange} min="0" placeholder="0" />
                                        </div>
                                        {restockBatch && (
                                            <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Supplier due</span>
                                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Rs. {restockBatch.supplierDue.toLocaleString()}</span>
                                                </div>
                                                {restockBatch.rate > 0 ? (
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>{restockBatch.q} × Rs. {restockBatch.rate} purchase rate</p>
                                                ) : (
                                                    <p style={{ fontSize: '0.8rem', color: '#ca8a04', margin: '8px 0 0 0' }}>Enter purchase rate</p>
                                                )}
                                                {restockBatch.supplierDue > 0 && restockBatch.paidRaw > 0 && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.85rem' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>Balance</span>
                                                        <span style={{ fontWeight: 'bold', color: restockBatch.balance > 0 ? '#ef4444' : '#22c55e' }}>Rs. {restockBatch.balance.toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="form-grid">
                                            <div className="input-group">
                                                <label>Paid (Rs)</label>
                                                <input type="number" className="input-field" name="restock_paid_amount" value={formData.restock_paid_amount} onChange={handleFormChange} min="0" placeholder="0" />
                                            </div>
                                            <div className="input-group">
                                                <CustomDatePicker
                                                    value={formData.restock_purchase_date}
                                                    onChange={(value) => setFormData(prev => ({ ...prev, restock_purchase_date: value }))}
                                                    label="Batch date"
                                                    className="batch-date-picker"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Category</label>
                                    <CustomDropdown
                                        className="minimal-select"
                                        name="category"
                                        value={formData.category}
                                        onChange={handleFormChange}
                                        placeholder="-- Select Category --"
                                        options={[
                                            { value: '', label: '-- Select Category --' },
                                            { value: 'Paint', label: 'Paint' },
                                            { value: 'Electric', label: 'Electric' },
                                            { value: 'Hardware', label: 'Hardware' }
                                        ]}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Low Stock Threshold</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        name="low_stock_threshold"
                                        value={formData.low_stock_threshold}
                                        onChange={handleFormChange}
                                        min="0"
                                        placeholder="10"
                                    />
                                </div>
                            </div>
                            <div className="input-group">
                                <label>Purchased From (Supplier)</label>
                                <div className="custom-searchable-dropdown">
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Search or enter supplier name..."
                                        name="purchased_from"
                                        value={supplierSearch}
                                        onChange={(e) => {
                                            setSupplierSearch(e.target.value);
                                            setFormData(prev => ({ ...prev, purchased_from: e.target.value }));
                                            setShowSupplierDropdown(true);
                                        }}
                                        onClick={() => setShowSupplierDropdown(true)}
                                    />
                                    {showSupplierDropdown && (
                                        <div className="dropdown-options glass-panel">
                                            {suppliersList
                                                .filter(s => (s.name + (s.company_name ? ` ${s.company_name}` : '')).toLowerCase().includes(supplierSearch.toLowerCase()))
                                                .map(s => (
                                                    <div
                                                        key={s.id}
                                                        className="dropdown-option"
                                                        onClick={() => handleSupplierSelect(s.name)}
                                                    >
                                                        {s.name} {s.company_name ? `(${s.company_name})` : ''}
                                                    </div>
                                                ))}
                                            {suppliersList.filter(s => (s.name + (s.company_name ? ` ${s.company_name}` : '')).toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                                                <div className="dropdown-option text-muted">Press enter to use "{supplierSearch}"</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {formData.purchased_from && !suppliersList.some(s => s.name.toLowerCase() === formData.purchased_from.toLowerCase()) && (
                                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', padding: '12px', borderRadius: '10px', marginTop: '16px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                    <label style={{ color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>✨ Auto-Create New Supplier</label>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Phone Number</label>
                                            <input
                                                type="tel"
                                                className="input-field"
                                                name="supplier_phone"
                                                value={formData.supplier_phone}
                                                onChange={handleFormChange}
                                                placeholder="Enter phone number"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Company Name (Optional)</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                name="supplier_company_name"
                                                value={formData.supplier_company_name}
                                                onChange={handleFormChange}
                                                placeholder="Enter company name"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="form-grid" style={{ marginTop: '16px' }}>
                                <div className="input-group">
                                    <label>Product Color</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="color"
                                            name="color"
                                            value={formData.color || '#6366f1'}
                                            onChange={handleFormChange}
                                            style={{ width: '44px', height: '38px', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer' }}
                                        />
                                        <input
                                            type="text"
                                            className="input-field"
                                            name="color"
                                            value={formData.color || ''}
                                            onChange={handleFormChange}
                                            placeholder="e.g. #ff0000 or Red"
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                </div>
                                {modalMode === 'add' && (
                                    <div className="input-group">
                                        <label>Paid Amount (Rs) <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(0 = credit)</span></label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            name="paid_amount"
                                            value={formData.paid_amount}
                                            onChange={handleFormChange}
                                            min="0"
                                            placeholder="Paid down"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="input-group" style={{ marginBottom: '16px' }}>
                                <label>Purchase Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    name="purchase_date"
                                    value={formData.purchase_date}
                                    onChange={handleFormChange}
                                />
                            </div>

                            {/* Supplier Payment Panel — Edit mode only */}
                            {modalMode === 'edit' && supplierTxnInfo && (
                                <>
                                    <hr style={{ margin: '16px 0', borderColor: 'var(--border-color)' }} />
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
                                        Supplier balance
                                    </h3>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Total Owed to Supplier (Rs)</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={`Rs. ${supplierTxnInfo.total_amount.toLocaleString()}`}
                                                readOnly
                                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Total Paid (Rs)</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={`Rs. ${supplierTxnInfo.paid_amount.toLocaleString()}`}
                                                readOnly
                                                style={{ backgroundColor: 'var(--bg-secondary)', color: '#4ade80' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Remaining owed (Rs)</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={`Rs. ${supplierTxnInfo.remaining.toLocaleString()}`}
                                                readOnly
                                                style={{ backgroundColor: 'var(--bg-secondary)', color: supplierTxnInfo.remaining > 0 ? '#f87171' : '#4ade80', fontWeight: 'bold' }}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Add New Payment (Rs) <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(max: {supplierTxnInfo.remaining})</span></label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    style={{ flex: 1 }}
                                                    value={addPaymentAmount}
                                                    onChange={e => setAddPaymentAmount(e.target.value)}
                                                    min="0"
                                                    max={supplierTxnInfo.remaining}
                                                    placeholder="Amount to pay..."
                                                />
                                                <input
                                                    type="date"
                                                    className="input-field"
                                                    style={{ width: '140px' }}
                                                    value={paymentDate}
                                                    onChange={e => setPaymentDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {modalMode === 'edit' && !supplierTxnInfo && formData.purchased_from && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    ℹ️ No supplier transactions found for this product.
                                </p>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'Save' : 'Update'}
                                </button>
                            </div>
                        </form>
                    </div >
                </div >
            )}

            {/* Product Side List */}
            <ProductSideList
                isOpen={isSideListOpen}
                onClose={() => setIsSideListOpen(false)}
                onToggle={toggleSideList}
                pendingItems={pendingItems}
                onRemoveItem={handleRemovePendingItem}
                onClearAll={handleClearAllPending}
                onProcessItems={handleProcessPendingItems}
                isProcessing={isProcessing}
            />
        </div>
    );
};

export default Products;
