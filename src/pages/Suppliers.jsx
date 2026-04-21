import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, MoreVertical, Truck, Edit, Trash2, X } from 'lucide-react';
import { notifySuccess, notifyError, confirmAction } from '../utils/notifications';
import ExpandableSupplierCard from '../components/ExpandableSupplierCard';
import CustomDropdown from '../components/CustomDropdown';
import ProductSideList from '../components/ProductSideList';
import './Suppliers.css';

const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('udhar_desc');
    const [filterOption, setFilterOption] = useState('all');
    const [totalPayables, setTotalPayables] = useState(0);

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
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        phone: '',
        company_name: '',
        category: '',
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
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        cash_amount: '',
        online_amount: ''
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

    const filteredSuppliers = suppliers
        .filter(supplier => {
            const matchesSearch = supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (supplier.company_name && supplier.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (supplier.phone && supplier.phone.includes(searchQuery));
            
            if(!matchesSearch) return false;

            const remaining = (supplier.supplier_transactions || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);

            if (filterOption === 'pending_udhar') return remaining > 0;
            if (filterOption === 'cleared') return remaining <= 0;
            if (filterOption === 'method_cash') return supplier.supplier_transactions?.some(t => t.payment_method === 'Cash');
            if (filterOption === 'method_online') return supplier.supplier_transactions?.some(t => t.payment_method === 'Online');
            if (filterOption === 'method_split') return supplier.supplier_transactions?.some(t => t.payment_method === 'Split');
            if (filterOption === 'cat_hardware') return supplier.category === 'Hardware';
            if (filterOption === 'cat_electric') return supplier.category === 'Electric';
            if (filterOption === 'cat_paint') return supplier.category === 'Paint';
            return true;
        })
        .sort((a, b) => {
            const aRemaining = (a.supplier_transactions || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);
            const bRemaining = (b.supplier_transactions || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);
            
            if (sortOption === 'name_asc') return a.name.localeCompare(b.name);
            if (sortOption === 'name_desc') return b.name.localeCompare(a.name);
            if (sortOption === 'udhar_desc') return bRemaining - aRemaining;
            if (sortOption === 'udhar_asc') return aRemaining - bRemaining;
            if (sortOption === 'date_asc') return a.id - b.id; // approximate oldest
            if (sortOption === 'date_desc') return b.id - a.id; // approximate newest

            // Default fallback
            if (aRemaining > 0 && bRemaining <= 0) return -1;
            if (aRemaining <= 0 && bRemaining > 0) return 1;
            if (aRemaining > 0 && bRemaining > 0) return bRemaining - aRemaining;
            return a.name.localeCompare(b.name);
        });

    // Handler functions for ExpandableSupplierCard
    const handleEditSupplier = (supplier) => {
        openEditModal(supplier);
    };

    const handleDeleteSupplier = (supplierId) => {
        handleDelete(supplierId);
    };

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
            category: '',
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
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'Cash',
            cash_amount: '',
            online_amount: ''
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
            category: row.category || '',
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
        setIsSubmitting(true);
        try {
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
                    company_name: formData.company_name,
                    category: formData.category
                };

                const newItem = {
                    action: 'add',
                    name: formData.name,
                    data: payload
                };
                
                let actualPaymentMethod = formData.payment_method || 'Cash';
                let targetAmountForSplitValidation = Number(formData.paid_amount || 0);
                let splitCash = 0;
                let splitOnline = 0;

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

                const finalProductName = formData.product_name || productSearch;
                let payloadProductName = finalProductName;
                let payloadQuantity = Number(formData.quantity);
                let isCreatingPurchase = false;

                if (!(formData.product_id || finalProductName) && Number(formData.total_amount) > 0) {
                    isCreatingPurchase = true;
                    payloadProductName = "Opening Balance";
                    payloadQuantity = 1;
                } else if ((formData.product_id || finalProductName) && Number(formData.quantity) > 0) {
                    isCreatingPurchase = true;
                }

                if (isCreatingPurchase) {
                    if (Number(formData.paid_amount || 0) > Number(formData.total_amount)) {
                        notifyError("Paid amount cannot exceed total amount.");
                        return;
                    }
                    if (Number(formData.paid_amount || 0) < 0 || Number(formData.total_amount) < 0 || payloadQuantity <= 0) {
                        notifyError("Amounts and quantity must be valid positive numbers.");
                        return;
                    }
                    
                    newItem.purchaseData = {
                        product_id: formData.product_id || null,
                        product_name: payloadProductName,
                        quantity: payloadQuantity,
                        total_amount: Number(formData.total_amount),
                        paid_amount: Number(formData.paid_amount || 0),
                        purchase_date: formData.purchase_date,
                        payment_method: actualPaymentMethod,
                        cash_amount: splitCash,
                        online_amount: splitOnline
                    };
                }
                
                setPendingItems(prev => [...prev, newItem]);
                setIsSideListOpen(true);
                closeModal();
                return;
            }
        
            // For existing suppliers (edit mode), keep the original logic
            const token = localStorage.getItem('inventory_token');
            const payload = {
                name: formData.name,
                phone: formData.phone,
                company_name: formData.company_name,
                category: formData.category
            };

            let splitCash = 0;
            let splitOnline = 0;
            let actualPaymentMethod = formData.payment_method || 'Cash';
            let targetAmountForSplitValidation = 0;
            
            const finalProductName = formData.product_name || productSearch;

            if (formData.id && formData.payment_amount) {
                targetAmountForSplitValidation = Number(formData.payment_amount);
            } else if (modalMode === 'add' || (!formData.txn_id && (formData.product_id || finalProductName))) {
                targetAmountForSplitValidation = Number(formData.paid_amount || 0);
            } else if (formData.txn_id && formData.add_payment) {
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
                payload.payment_method = actualPaymentMethod;
                payload.cash_amount = splitCash;
                payload.online_amount = splitOnline;
            }

            // UPDATE EXISTING SUPPLIER
            await axios.put(`/api/suppliers/${formData.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (formData.txn_id) {
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
                    updatePayload.payment_method = actualPaymentMethod;
                    updatePayload.cash_amount = splitCash;
                    updatePayload.online_amount = splitOnline;
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
            } else {
                let isCreatingPurchase = false;
                let payloadProductName = finalProductName;
                let payloadQuantity = Number(formData.quantity);

                if (!(formData.product_id || finalProductName) && Number(formData.total_amount) > 0) {
                    isCreatingPurchase = true;
                    payloadProductName = "Opening Balance";
                    payloadQuantity = 1;
                } else if ((formData.product_id || finalProductName) && Number(formData.quantity) > 0) {
                    isCreatingPurchase = true;
                }

                if (isCreatingPurchase) {
                    if (Number(formData.paid_amount || 0) > Number(formData.total_amount)) {
                        notifyError("Paid amount cannot exceed total amount.");
                        return;
                    }
                    if (Number(formData.paid_amount || 0) < 0 || Number(formData.total_amount) < 0 || payloadQuantity <= 0) {
                        notifyError("Amounts and quantity must be valid positive numbers.");
                        return;
                    }

                    const purchasePayload = {
                        supplier_id: formData.id,
                        product_id: formData.product_id || null,
                        product_name: payloadProductName,
                        quantity: payloadQuantity,
                        total_amount: Number(formData.total_amount),
                        paid_amount: Number(formData.paid_amount || 0),
                        purchase_date: formData.purchase_date,
                        payment_method: actualPaymentMethod,
                        cash_amount: splitCash,
                        online_amount: splitOnline
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
        } finally {
            setIsSubmitting(false);
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
                        const supplierRes = await axios.post('/api/suppliers', item.data, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const newSupplier = supplierRes.data.data?.[0];
                        if (newSupplier && item.purchaseData) {
                            item.purchaseData.supplier_id = newSupplier.id;
                            await axios.post('/api/purchases', item.purchaseData, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                        }
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

            <div className="suppliers-list-container glass-panel">
                <div className="table-header-controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-wrapper" style={{ flex: '1', minWidth: '300px' }}>
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
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
                                { value: "all", label: "All Suppliers" },
                                { value: "pending_udhar", label: "Pending Payables" },
                                { value: "cleared", label: "Cleared" },
                                { value: "method_cash", label: "Paid in Cash" },
                                { value: "method_online", label: "Paid in Online" },
                                { value: "method_split", label: "Split Payment" },
                                { value: "cat_hardware", label: "Category: Hardware" },
                                { value: "cat_electric", label: "Category: Electric" },
                                { value: "cat_paint", label: "Category: Paint" }
                            ]}
                        />
                        <CustomDropdown 
                            className="minimal-select" 
                            style={{ minWidth: '150px' }}
                            value={sortOption} 
                            onChange={(e) => setSortOption(e.target.value)}
                            options={[
                                { value: "udhar_desc", label: "Highest Payables First" },
                                { value: "udhar_asc", label: "Lowest Payables First" },
                                { value: "date_desc", label: "Newest First" },
                                { value: "date_asc", label: "Oldest First" },
                                { value: "name_asc", label: "Name (A-Z)" },
                                { value: "name_desc", label: "Name (Z-A)" }
                            ]}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state text-center py-8">Loading suppliers...</div>
                ) : (
                    <div className="suppliers-cards-list">
                        {filteredSuppliers.map((supplier) => (
                            <ExpandableSupplierCard
                                key={supplier.id}
                                supplier={supplier}
                                onEdit={handleEditSupplier}
                                onDelete={handleDeleteSupplier}
                            />
                        ))}

                        {filteredSuppliers.length === 0 && (
                            <div className="text-center py-8 text-muted">
                                No suppliers found matching your search.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for Add / Edit */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel animate-fade-in" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h2>{modalMode === 'add' ? 'Add New Supplier' : 'Edit Supplier'}</h2>
                            <button className="icon-btn-small" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="modal-body">

                            {/* Contact Info - compact 2-col grid */}
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Contact Name</label>
                                    <input type="text" className="input-field" name="name" value={formData.name} onChange={handleFormChange} required />
                                </div>
                                <div className="input-group">
                                    <label>Phone</label>
                                    <input type="text" className="input-field" name="phone" value={formData.phone} onChange={handleFormChange} />
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Company Name (Optional)</label>
                                    <input type="text" className="input-field" name="company_name" value={formData.company_name} onChange={handleFormChange} />
                                </div>
                                <div className="input-group">
                                    <label>Category</label>
                                    <CustomDropdown 
                                        className="minimal-select"
                                        value={formData.category}
                                        onChange={(e) => handleFormChange({ target: { name: 'category', value: e.target.value } })}
                                        options={[
                                            { value: "", label: "Select Category" },
                                            { value: "Hardware", label: "Hardware" },
                                            { value: "Electric", label: "Electric" },
                                            { value: "Paint", label: "Paint" }
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Generic supplier payment — edit mode with outstanding due */}
                            {modalMode === 'edit' && formData.txn_due > 0 && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '2px' }}>
                                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                        💰 Make Payment — Due: Rs. {formData.txn_due.toLocaleString()}
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <input
                                            type="number"
                                            className="input-field"
                                            style={{ flex: 1 }}
                                            name="payment_amount"
                                            value={formData.payment_amount}
                                            onChange={handleFormChange}
                                            placeholder={`Max: Rs. ${formData.txn_due}`}
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

                                    {/* Payment method pills */}
                                    {Number(formData.payment_amount) > 0 && (
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
                                </div>
                            )}

                            {/* Transaction fields — Add Mode OR Edit with no previous txn */}
                            {(modalMode === 'add' || (modalMode === 'edit' && !formData.txn_id)) && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '2px' }}>
                                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                        {modalMode === 'add' ? '📦 Purchase Details (Optional)' : '📦 Add First Purchase'}
                                    </label>

                                    <div className="form-grid" style={{ marginTop: '8px' }}>
                                        <div className="input-group">
                                            <label>Product (Optional)</label>
                                            <div className="custom-searchable-dropdown">
                                                <input type="text" className="input-field" placeholder="Search product..." value={productSearch}
                                                    onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                                                    onClick={() => setShowProductDropdown(true)} />
                                                {showProductDropdown && (
                                                    <div className="dropdown-options glass-panel">
                                                        {productsList.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                                            <div key={p.id} className="dropdown-option" onClick={() => handleProductSelect(p)}>{p.name}</div>
                                                        ))}
                                                        {productsList.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                                            <div className="dropdown-option text-muted">No products found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Qty (Optional)</label>
                                            <input type="number" className="input-field" name="quantity" value={formData.quantity} onChange={handleFormChange} min="0" />
                                        </div>
                                    </div>

                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Unit Price (Rs)</label>
                                            <input type="number" className="input-field" name="unit_price" value={formData.unit_price} onChange={handleFormChange} min="0" />
                                        </div>
                                        <div className="input-group">
                                            <label>Total Amount (Rs)</label>
                                            <input type="number" className="input-field" name="total_amount" value={formData.total_amount} onChange={handleFormChange} min="0" placeholder="0" />
                                        </div>
                                    </div>

                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Paid Amount (Rs)</label>
                                            <input type="number" className="input-field" name="paid_amount" value={formData.paid_amount}
                                                onChange={e => { handleFormChange(e); setFormData(prev => ({ ...prev, cash_amount: '', online_amount: '' })); }} min="0" />
                                        </div>
                                        <div className="input-group">
                                            <label>Purchase Date</label>
                                            <input type="date" className="input-field" name="purchase_date" value={formData.purchase_date} onChange={handleFormChange} />
                                        </div>
                                    </div>

                                    {Number(formData.paid_amount) > 0 && (
                                        <div style={{ marginTop: '6px' }}>
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
                                </div>
                            )}

                            {/* Update existing transaction payment */}
                            {modalMode === 'edit' && formData.txn_id && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '2px' }}>
                                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                        💳 Update Payment — Due: Rs. {formData.remaining_amount.toLocaleString()}
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <input type="number" className="input-field" style={{ flex: 1 }} name="add_payment" value={formData.add_payment}
                                            onChange={e => { handleFormChange(e); setFormData(prev => ({ ...prev, cash_amount: '', online_amount: '' })); }}
                                            min="0" max={formData.remaining_amount} placeholder={`Pay now (max ${formData.remaining_amount})...`} />
                                        <input type="number" className="input-field" style={{ flex: 1 }} name="new_total_amount" value={formData.new_total_amount} onChange={handleFormChange} min="0" placeholder="New total (optional)..." />
                                        <input type="date" className="input-field" style={{ width: '140px' }} name="payment_date" value={formData.payment_date} onChange={handleFormChange} />
                                    </div>

                                    {Number(formData.add_payment) > 0 && (
                                        <div style={{ marginTop: '8px' }}>
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
                                </div>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                                    {isSubmitting ? '⏳ Saving...' : (modalMode === 'add' ? 'Save Supplier' : 'Update Supplier')}
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
