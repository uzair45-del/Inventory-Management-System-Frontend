import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, MoreVertical, CreditCard, Edit, Trash2, X } from 'lucide-react';
import './Buyers.css';

const Buyers = () => {
    const [buyers, setBuyers] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalOutstanding, setTotalOutstanding] = useState(0);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
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
        payment_date: new Date().toISOString().split('T')[0]
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
        if (!window.confirm('Are you sure you want to delete this customer?')) return;
        try {
            const token = localStorage.getItem('inventory_token');
            await axios.delete(`/api/buyers/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchBuyers();
        } catch (err) {
            console.error('Error deleting customer:', err);
            alert('Failed to delete customer.');
        }
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
            payment_date: new Date().toISOString().split('T')[0]
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
            payment_date: new Date().toISOString().split('T')[0]
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
        try {
            const token = localStorage.getItem('inventory_token');
            const payload = {
                name: formData.name,
                phone: formData.phone,
                address: formData.address,
                company_name: formData.company_name || null
            };

            const finalProductName = formData.product_name || productSearch;

            if (modalMode === 'add') {
                const buyerRes = await axios.post('/api/buyers', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const newBuyer = buyerRes.data.data?.[0];

                // If product is selected, create a credit sale transaction
                if (newBuyer && (formData.product_id || finalProductName) && Number(formData.quantity) > 0) {
                    const salePayload = {
                        buyer_id: newBuyer.id,
                        product_id: formData.product_id || null,
                        product_name: finalProductName,
                        quantity: Number(formData.quantity),
                        total_amount: Number(formData.total_amount),
                        paid_amount: Number(formData.paid_amount || 0),
                        bill_type: 'CREDIT' // Udhaar
                    };

                    await axios.post('/api/sales', salePayload, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            } else {
                if (formData.txn_id && formData.add_payment && Number(formData.add_payment) > 0) {
                    if (Number(formData.add_payment) > Number(formData.remaining_amount)) {
                        alert("Cannot pay more than remaining credit amount.");
                        return;
                    }
                    // Update the transaction parallel to buyer update
                    await axios.put(`/api/sales/${formData.txn_id}`, {
                        add_payment: Number(formData.add_payment),
                        date: formData.payment_date
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
            alert(err.response?.data?.error || 'Failed to save customer.');
        }
    };

    const filteredBuyers = buyers.filter(buyer =>
        buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (buyer.company_name && buyer.company_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const flattenedData = [];
    filteredBuyers.forEach(buyer => {
        if (buyer.buyer_transactions && buyer.buyer_transactions.length > 0) {
            buyer.buyer_transactions.forEach(txn => {
                flattenedData.push({ ...buyer, txn });
            });
        } else {
            // Buyer with no transactions yet
            flattenedData.push({ ...buyer, txn: null });
        }
    });

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Customers Directory</h1>
                    <p className="page-subtitle">Track credit sales (Udhaar) and collections</p>
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
                        <p className="stat-label">Total Outstanding (Udhaar)</p>
                        <h2 className="stat-value">Rs. {totalOutstanding.toLocaleString()}</h2>
                    </div>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="table-container glass-panel">
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

                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-state text-center py-8">Loading buyers...</div>
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
                                    <th>Remaining (Udhaar)</th>
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
                                                        title="Delete Buyer"
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
                                            No customers or Udhaar records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

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
                                    <h3 className="text-lg font-medium text-gray-200 mb-4">Udhaar / Credit Details (Optional)</h3>

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
                                        <label>Purchase Date</label>
                                        <input
                                            type="date"
                                            className="input-field"
                                            name="purchase_date"
                                            value={formData.purchase_date}
                                            onChange={handleFormChange}
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
                                    {modalMode === 'add' ? 'Save Customer' : 'Update Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Buyers;
