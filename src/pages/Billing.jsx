import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Printer, Search, Receipt, Calculator, Save, RefreshCw, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import './Billing.css';

const Billing = () => {
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedUnit, setSelectedUnit] = useState('Per Piece');
    const [billType, setBillType] = useState('original');
    const [customerName, setCustomerName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Udhaar-specific fields
    const [buyerPhone, setBuyerPhone] = useState('');
    const [paidAmount, setPaidAmount] = useState('');

    const receiptRef = useRef();

    const handleDownloadPdf = async () => {
        if (cart.length === 0) {
            alert("No items in the cart to print.");
            return;
        }
        
        const element = receiptRef.current;
        
        const widthPx = element.offsetWidth || 500;
        const heightPx = element.scrollHeight || 800;
        
        const widthMm = widthPx * 0.264583;
        const heightMm = heightPx * 0.264583;

        const opt = {
            margin:       5,
            filename:     `Invoice_${customerName || 'WalkIn'}_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: [widthMm + 10, heightMm + 15], orientation: 'portrait' }
        };

        // Temporary styles for PDF export
        element.classList.add('pdf-mode-active');
        element.style.background = '#ffffff';
        element.style.color = '#000000';
        
        const actionsContainer = element.querySelector('.bill-actions-container');
        if(actionsContainer) actionsContainer.style.display = 'none';
        
        await html2pdf().set(opt).from(element).save();
        
        element.classList.remove('pdf-mode-active');
        element.style.background = '';
        element.style.color = '';
        if(actionsContainer) actionsContainer.style.display = 'flex';
    };

    const formatProductId = (id) => {
        if (!id) return '';
        return `AB${String(id).padStart(2, '0')}`;
    };

    useEffect(() => {
        fetchProducts();
        fetchCustomers();
    }, []);

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/products', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(response.data);
        } catch (err) {
            console.error('Error fetching products:', err);
            setError('Failed to load products');
        }
    };

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/buyers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(response.data);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    };

    const addToCart = () => {
        if (!selectedProduct) return;
        setError(null); // Clear previous errors

        const product = products.find(p => String(p.id) === String(selectedProduct));
        if (product) {
            const qtyToAdd = parseInt(quantity);

            // Validate stock for original and udhaar bills (both are real sales)
            if (billType !== 'quotation' && product.remaining_quantity < qtyToAdd) {
                setError(`Notification: Cannot add ${qtyToAdd} items. Only ${product.remaining_quantity} in stock.`);
                return;
            }

            const existingItem = cart.find(item => item.id === product.id);
            if (existingItem) {
                const newTotalQty = existingItem.quantity + qtyToAdd;
                if (billType !== 'quotation' && product.remaining_quantity < newTotalQty) {
                    setError(`Notification: Cannot add more. Exceeds stock limit of ${product.remaining_quantity}.`);
                    return;
                }
                setCart(cart.map(item =>
                    item.id === product.id ? { ...item, quantity: newTotalQty, cart_unit: selectedUnit } : item
                ));
            } else {
                setCart([...cart, { ...product, quantity: qtyToAdd, cart_unit: selectedUnit }]);
            }
            setSelectedProduct('');
            setQuantity(1);
            setSelectedUnit('Per Piece');
        }
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleSaveBill = async () => {
        if (cart.length === 0) {
            alert("No items in the cart to create a bill.");
            return;
        }

        // ===== QUOTATION BILL =====
        if (billType === 'quotation') {
            alert("Quotation Generated! (No database changes)");
            handleDownloadPdf();
            return;
        }

        // ===== UDHAAR VALIDATION =====
        if (billType === 'udhaar' && (!customerName.trim() || !buyerPhone.trim())) {
            alert('Udhaar bill requires Buyer Name and Phone.');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            let buyerId = null;

            // ===== UDHAAR: Create buyer first =====
            if (billType === 'udhaar') {
                const buyerRes = await axios.post('/api/buyers', {
                    name: customerName.trim(),
                    phone: buyerPhone.trim(),
                    company_name: companyName.trim() || null
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                buyerId = buyerRes.data.data?.[0]?.id;
                if (!buyerId) throw new Error('Failed to create customer');
            }

            // ===== Process each cart item as a sale =====
            const actualBillType = billType === 'udhaar' ? 'CREDIT' : 'REAL';
            const userPaid = billType === 'udhaar' ? Number(paidAmount || 0) : null;

            for (const item of cart) {
                const itemTotal = item.price * item.quantity;
                const saleData = {
                    product_id: item.id,
                    quantity: item.quantity,
                    total_amount: itemTotal,
                    bill_type: actualBillType,
                    buyer_id: buyerId,
                    buyer_name: customerName || 'Cash Walk-in Customer',
                    company_name: companyName || null,
                    paid_amount: billType === 'udhaar' ? userPaid : itemTotal,
                    quantity_unit: item.cart_unit
                };

                await axios.post('/api/sales', saleData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            if (billType === 'udhaar') {
                const remaining = total - Number(paidAmount || 0);
                alert(`Udhaar Bill saved! Stock deducted. Remaining balance: Rs. ${remaining}`);
            } else {
                alert('Original Bill saved! Stock has been deducted.');
            }

            setCart([]);
            setCustomerName('');
            setCompanyName('');
            setBuyerPhone('');
            setPaidAmount('');
            fetchProducts();
            fetchCustomers();
        } catch (err) {
            console.error('Error creating sale:', err);
            alert(err.response?.data?.error || 'Failed to save bill. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;

    return (
        <div className="billing-container">
            {/* Left Panel: Entry */}
            <div className="billing-entry-panel">
                <div className="panel-header">
                    <h1 className="page-title">Generate Bill</h1>
                    <p className="page-subtitle">Create a new invoice for customer</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="form-section glass-panel">
                    <h3 className="section-title">Bill Details</h3>

                    <div className="form-grid">
                        <div className="input-group">
                            <label>Bill Type</label>
                            <select
                                className="input-field minimal-select"
                                value={billType}
                                onChange={(e) => setBillType(e.target.value)}
                            >
                                <option value="original">Original (Deducts Stock)</option>
                                <option value="quotation">Quotation (Estimate Only — No DB Changes)</option>
                                <option value="udhaar">Udhaar (Credit Sale — Saves to Buyers)</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label>{billType === 'udhaar' ? 'Customer Name *' : 'Customer Name'}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder={billType === 'udhaar' ? 'Enter customer name (required)' : 'Enter or pick customer'}
                                    value={customerName}
                                    onChange={(e) => { setCustomerName(e.target.value); setShowCustomerDropdown('customer'); }}
                                    onFocus={() => setShowCustomerDropdown('customer')}
                                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                                    required={billType === 'udhaar'}
                                />
                                {showCustomerDropdown === 'customer' && customers.filter(c =>
                                    c.name.toLowerCase().includes(customerName.toLowerCase()) ||
                                    (c.company_name && c.company_name.toLowerCase().includes(customerName.toLowerCase()))
                                ).length > 0 && (
                                        <div className="dropdown-options glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100 }}>
                                            {customers
                                                .filter(c =>
                                                    c.name.toLowerCase().includes(customerName.toLowerCase()) ||
                                                    (c.company_name && c.company_name.toLowerCase().includes(customerName.toLowerCase()))
                                                )
                                                .map(c => (
                                                    <div
                                                        key={c.id}
                                                        className="dropdown-option"
                                                        onMouseDown={() => {
                                                            setCustomerName(c.name);
                                                            setCompanyName(c.company_name || '');
                                                            setBuyerPhone(c.phone || '');
                                                            setShowCustomerDropdown(false);
                                                        }}
                                                    >
                                                        <strong>{c.name}</strong>
                                                        {c.company_name && <span style={{ color: '#38bdf8', marginLeft: 8, fontSize: '0.85em' }}>🏢 {c.company_name}</span>}
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>

                    {/* Company Name - shown for Original and Udhaar bills */}
                    {billType !== 'quotation' && (() => {
                        const companyOptions = [...new Set(
                            customers
                                .map(c => c.company_name)
                                .filter(Boolean)
                        )];
                        return (
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Company Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="Type or select a company..."
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            onFocus={() => setShowCustomerDropdown('company')}
                                            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                                        />
                                        {showCustomerDropdown === 'company' && companyOptions.filter(c =>
                                            c.toLowerCase().includes(companyName.toLowerCase())
                                        ).length > 0 && (
                                                <div className="dropdown-options glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100 }}>
                                                    {companyOptions
                                                        .filter(c => c.toLowerCase().includes(companyName.toLowerCase()))
                                                        .map((c, i) => (
                                                            <div
                                                                key={i}
                                                                className="dropdown-option"
                                                                onMouseDown={() => {
                                                                    setCompanyName(c);
                                                                    setShowCustomerDropdown(false);
                                                                }}
                                                            >
                                                                🏢 {c}
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Udhaar-specific fields */}
                    {billType === 'udhaar' && (
                        <>
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Customer Phone *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Enter phone number"
                                        value={buyerPhone}
                                        onChange={(e) => setBuyerPhone(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Paid Amount (Rs)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="0"
                                        min="0"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="divider"></div>

                    <h3 className="section-title">Add Items</h3>
                    <div className="add-item-row">
                        <div className="input-group flex-2">
                            <select
                                className="input-field minimal-select"
                                value={selectedProduct}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedProduct(val);
                                    if(val) {
                                        const prod = products.find(p => String(p.id) === String(val));
                                        if (prod) setSelectedUnit(prod.quantity_unit || 'Per Piece');
                                    }
                                }}
                            >
                                <option value="">Select a product...</option>
                                {products.filter(p => billType === 'quotation' || (p.remaining_quantity && p.remaining_quantity >= 1)).map(p => (
                                    <option key={p.id} value={p.id}>
                                        [{formatProductId(p.id)}] {p.name} - Rs. {p.price} {p.quantity_unit ? `(${p.quantity_unit})` : ''} {billType !== 'quotation' ? `(Stock: ${p.remaining_quantity})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group flex-1">
                            <input
                                type="number"
                                className="input-field"
                                min="1"
                                max={billType !== 'quotation' && selectedProduct ? (products.find(p => String(p.id) === String(selectedProduct))?.remaining_quantity || '') : ''}
                                value={quantity}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    const selected = products.find(p => String(p.id) === String(selectedProduct));
                                    if (billType !== 'quotation' && selected && val > selected.remaining_quantity) {
                                        setQuantity(selected.remaining_quantity);
                                    } else {
                                        setQuantity(e.target.value);
                                    }
                                }}
                            />
                        </div>
                        <div className="input-group flex-1">
                            <select
                                className="input-field minimal-select"
                                value={selectedUnit}
                                onChange={(e) => setSelectedUnit(e.target.value)}
                            >
                                <option value="Per Piece">Per Piece</option>
                                <option value="Per Dozen">Per Dozen</option>
                                <option value="Per Box">Per Box</option>
                                <option value="Per Kg">Per Kg</option>
                                <option value="Per Liter">Per Liter</option>
                                <option value="Per Meter">Per Meter</option>
                                <option value="Per Roll">Per Roll</option>
                                <option value="Per Pack">Per Pack</option>
                                <option value="Per Case">Per Case</option>
                            </select>
                        </div>
                        <button className="btn-primary add-btn" onClick={addToCart}>
                            <Plus size={20} />
                        </button>
                    </div>
                    {selectedProduct && billType !== 'quotation' && (() => {
                        const sel = products.find(p => String(p.id) === String(selectedProduct));
                        return sel ? (
                            <p className="stock-hint" style={{
                                marginTop: '0.5rem',
                                fontSize: '0.82rem',
                                color: sel.remaining_quantity > 0 ? '#a78bfa' : '#ef4444',
                                fontWeight: 500
                            }}>
                                📦 Remaining Stock: <strong>{sel.remaining_quantity}</strong> units of "{sel.name}"
                            </p>
                        ) : null;
                    })()}
                </div>

                <div className="cart-section glass-panel">
                    <h3 className="section-title flex items-center justify-between">
                        <span>Current Items</span>
                        <span className="item-count">{cart.length} items</span>
                    </h3>

                    <div className="cart-items">
                        {cart.length === 0 ? (
                            <div className="empty-cart">
                                <Receipt size={32} className="text-muted mb-2" />
                                <p>No items added yet</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className="cart-item animate-fade-in">
                                    <div className="item-details">
                                        <h4>{item.name}</h4>
                                        <p>
                                            <span style={{ fontSize: '0.85em', color: 'var(--accent-primary)', marginRight: '6px' }}>{formatProductId(item.id)}</span>
                                            Rs. {item.price} x {item.quantity} {item.cart_unit ? `(${item.cart_unit})` : ''}
                                        </p>
                                    </div>
                                    <div className="item-total">
                                        <span>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                                        <button className="icon-btn-danger" onClick={() => removeFromCart(item.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Receipt Preview */}
            <div className="billing-preview-panel">
                <div className="receipt glass-panel" ref={receiptRef}>
                    <div className="receipt-header">
                        <div className="receipt-logo">
                            <Calculator size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.4rem' }}>Jellani Hardware, Paint<br/>and Electric Store</h2>
                        <p className="receipt-address">Main Kallar Syedan Road, Near DHA Phase 7 Gate 1</p>
                        <p className="receipt-contact">Ph: 0329-5749291</p>

                        <div className="receipt-type-badge">
                            {billType === 'quotation' ? 'QUOTATION / ESTIMATE' : billType === 'udhaar' ? 'UDHAAR / CREDIT INVOICE' : 'TAX INVOICE'}
                        </div>
                    </div>

                    <div className="receipt-meta">
                        <div className="meta-row">
                            <span>Date:</span>
                            <span>{new Date().toLocaleDateString()}</span>
                        </div>
                        <div className="meta-row">
                            <span>Customer:</span>
                            <span>{customerName || 'Cash Customer'}{companyName ? ` (${companyName})` : ''}</span>
                        </div>
                        <div className="meta-row">
                            <span>Invoice #:</span>
                            <span>INV-{Math.floor(100000 + Math.random() * 900000)}</span>
                        </div>
                    </div>

                    <div className="receipt-items-table">
                        <div className="receipt-table-header">
                            <span>Item</span>
                            <span>Qty</span>
                            <span>Total</span>
                        </div>
                        {cart.map(item => (
                            <div key={item.id} className="receipt-table-row">
                                <span className="item-name-col">
                                    {item.name}
                                    <div style={{ fontSize: '0.7em', color: '#666', marginTop: '2px' }}>{formatProductId(item.id)}</div>
                                </span>
                                <span>{item.quantity} {item.cart_unit ? `\n(${item.cart_unit})` : ''}</span>
                                <span>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>

                    <div className="receipt-summary">
                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>Rs. {subtotal.toLocaleString()}</span>
                        </div>
                        <div className="summary-row total">
                            <span>Total Amount</span>
                            <span>Rs. {total.toLocaleString()}</span>
                        </div>
                        {billType === 'udhaar' && (
                            <>
                                <div className="summary-row">
                                    <span>Paid Amount</span>
                                    <span>Rs. {Number(paidAmount || 0).toLocaleString()}</span>
                                </div>
                                <div className="summary-row total" style={{ color: '#ef4444' }}>
                                    <span>Remaining (Udhaar)</span>
                                    <span>Rs. {(total - Number(paidAmount || 0)).toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Advertisement Footer */}
                    <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-primary)' }}>
                        <p style={{ margin: '0 0 5px', fontSize: '0.8rem', fontWeight: 600 }}>Software Developed by Hassan Ali Abrar</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Insta: <strong style={{color:'var(--info)'}}>hassan.secure</strong> | WA: <strong style={{color:'var(--success)'}}>+92 348 5055098</strong></p>
                    </div>

                    <div className="flex gap-2 mt-auto bill-actions-container" style={{ flexWrap: 'wrap', marginTop: '20px' }}>
                        <button className="btn-secondary flex-1" onClick={handleDownloadPdf}>
                            <Download size={18} />
                            <span>Download PDF</span>
                        </button>
                        {billType !== 'quotation' && (
                            <button
                                className="btn-primary flex-1"
                                style={{ background: '#22c55e', borderColor: '#22c55e' }}
                                onClick={handleSaveBill}
                                disabled={loading || cart.length === 0}
                            >
                                <RefreshCw size={18} />
                                <span>{loading ? 'Saving...' : 'Update / Save'}</span>
                            </button>
                        )}
                        <button
                            className="btn-primary flex-1 bg-accent"
                            onClick={async () => { 
                                await handleDownloadPdf(); 
                                if (billType !== 'quotation') {
                                    handleSaveBill(); 
                                }
                            }}
                            disabled={loading || cart.length === 0}
                        >
                            <Save size={18} />
                            <span>{loading ? 'Saving...' : billType === 'quotation' ? 'PDF Only' : billType === 'udhaar' ? 'Save Udhaar' : 'Save & PDF'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Billing;
