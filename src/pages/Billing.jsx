import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Printer, Search, Receipt, Calculator, Save, RefreshCw, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import CustomDropdown from '../components/CustomDropdown';
import { notifySuccess, notifyError } from '../utils/notifications';
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
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Credit-specific fields
    const [buyerPhone, setBuyerPhone] = useState('');
    const [paidAmount, setPaidAmount] = useState('');

    // Payment method fields
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [cashAmount, setCashAmount] = useState('');
    const [onlineAmount, setOnlineAmount] = useState('');

    const receiptRef = useRef();

    const handleDownloadPdf = async () => {
        if (cart.length === 0) {
            notifyError("No items in the cart to print.");
            return;
        }

        const element = receiptRef.current;

        const widthPx = element.offsetWidth || 500;
        const heightPx = element.scrollHeight || 800;

        const widthMm = widthPx * 0.264583;
        const heightMm = heightPx * 0.264583;

        const opt = {
            margin: 5,
            filename: `Invoice_${customerName || 'WalkIn'}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: [widthMm + 10, heightMm + 15], orientation: 'portrait' }
        };

        // Temporary styles for PDF export
        element.classList.add('pdf-mode-active');
        element.style.background = '#ffffff';
        element.style.color = '#000000';

        const actionsContainer = element.querySelector('.bill-actions-container');
        if (actionsContainer) actionsContainer.style.display = 'none';

        const newWindow = window.open('', '_blank');
        if (newWindow) newWindow.document.write('<body><h2 style="font-family:sans-serif; text-align:center; margin-top: 20vh;">Generating PDF Receipt...</h2></body>');

        await html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
            const pdfUrl = pdf.output('bloburl');
            if (newWindow) {
                newWindow.location.href = pdfUrl;
            } else {
                window.open(pdfUrl, '_blank');
            }
        });

        element.classList.remove('pdf-mode-active');
        element.style.background = '';
        element.style.color = '';
        if (actionsContainer) actionsContainer.style.display = 'flex';
    };

    const formatProductId = (id) => {
        if (!id) return '';
        return String(id).toUpperCase();
    };

    // Remove "Per " prefix for display on bill (e.g. "Per Piece" → "Piece")
    const stripPer = (unit) => unit ? unit.replace(/^Per\s+/i, '') : '';

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

            // Validate stock for original and credit bills (both are real sales)
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
            setProductSearchTerm('');
            setQuantity(1);
            setSelectedUnit('Per Piece');
        }
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleSaveBill = async () => {
        if (cart.length === 0) {
            notifyError("No items in the cart to create a bill.");
            return;
        }

        // ===== QUOTATION BILL =====
        if (billType === 'quotation') {
            notifySuccess("Quotation Generated! (No database changes)");
            handleDownloadPdf();
            return;
        }

        const targetPaidAmount = billType === 'credit' ? Number(paidAmount || 0) : total;
        let finalCashAmount = 0;
        let finalOnlineAmount = 0;

        if (paymentMethod === 'Cash') {
            finalCashAmount = targetPaidAmount;
        } else if (paymentMethod === 'Online') {
            finalOnlineAmount = targetPaidAmount;
        } else if (paymentMethod === 'Split') {
            if (!cashAmount || Number(cashAmount) <= 0) {
                notifyError('Please enter a valid Cash Amount for the split payment.');
                return;
            }
            if (Number(cashAmount) >= targetPaidAmount) {
                notifyError('Cash Amount must be less than the total paid amount for a split payment.');
                return;
            }
            finalCashAmount = Number(cashAmount || 0);
            finalOnlineAmount = Number(onlineAmount || 0);
            if (targetPaidAmount > 0 && Math.abs((finalCashAmount + finalOnlineAmount) - targetPaidAmount) > 1) {
                notifyError(`Split amounts (${finalCashAmount} + ${finalOnlineAmount} = ${finalCashAmount + finalOnlineAmount}) must equal the paid amount (${targetPaidAmount}).`);
                return;
            }
        }

        // ===== CREDIT VALIDATION =====
        if (billType === 'credit' && (!customerName.trim() || !buyerPhone.trim())) {
            notifyError('Credit bill requires Customer Name and Phone.');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            let buyerId = null;

            // ===== CREDIT: Create buyer first =====
            if (billType === 'credit') {
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
            const actualBillType = billType === 'credit' ? 'CREDIT' : 'REAL';
            const userPaid = billType === 'credit' ? Number(paidAmount || 0) : null;
            const lowStockAlerts = [];

            let currentCashPool = finalCashAmount;
            let currentOnlinePool = finalOnlineAmount;

            for (let i = 0; i < cart.length; i++) {
                const item = cart[i];
                const itemTotal = item.price * item.quantity;
                const isLastItem = i === cart.length - 1;

                let itemPaidAmount;
                if (billType === 'credit') {
                    const ratio = total > 0 ? (itemTotal / total) : 0;
                    itemPaidAmount = isLastItem 
                        ? (userPaid - cart.slice(0, i).reduce((s, it) => s + Math.round((it.price * it.quantity / total) * userPaid), 0))
                        : Math.round(ratio * userPaid);
                } else {
                    itemPaidAmount = itemTotal;
                }

                let thisCash = 0;
                let thisOnline = 0;
                if (paymentMethod === 'Split') {
                     const ratio = targetPaidAmount > 0 ? (itemPaidAmount / targetPaidAmount) : 0;
                     thisCash = isLastItem ? currentCashPool : Math.round(ratio * finalCashAmount);
                     thisOnline = isLastItem ? currentOnlinePool : Math.round(ratio * finalOnlineAmount);
                     currentCashPool -= thisCash;
                     currentOnlinePool -= thisOnline;
                } else if (paymentMethod === 'Cash') {
                     thisCash = itemPaidAmount;
                } else if (paymentMethod === 'Online') {
                     thisOnline = itemPaidAmount;
                }

                const saleData = {
                    product_id: item.id,
                    quantity: item.quantity,
                    total_amount: itemTotal,
                    bill_type: actualBillType,
                    buyer_id: buyerId,
                    buyer_name: customerName || 'Cash Walk-in Customer',
                    company_name: companyName || null,
                    paid_amount: itemPaidAmount,
                    quantity_unit: item.cart_unit,
                    payment_method: paymentMethod,
                    cash_amount: thisCash,
                    online_amount: thisOnline
                };

                await axios.post('/api/sales', saleData, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const newRemaining = item.remaining_quantity - item.quantity;
                const threshold = item.low_stock_threshold !== undefined && item.low_stock_threshold !== null ? item.low_stock_threshold : 10;
                if (newRemaining <= threshold) {
                    lowStockAlerts.push(`${item.name} (${newRemaining} left)`);
                }
            }

            if (billType === 'credit') {
                const remaining = total - Number(paidAmount || 0);
                notifySuccess(`Credit Bill saved! Stock deducted. Remaining balance: Rs. ${remaining}`);
            } else {
                notifySuccess('Original Bill saved! Stock has been deducted.');
            }

            if (lowStockAlerts.length > 0) {
                setTimeout(() => {
                    notifyError(`⚠️ Low Stock Alert:\n${lowStockAlerts.join('\n')}`);
                }, 500);
            }

            setCart([]);
            setCustomerName('');
            setCompanyName('');
            setBuyerPhone('');
            setPaidAmount('');
            setCashAmount('');
            setOnlineAmount('');
            fetchProducts();
            fetchCustomers();
        } catch (err) {
            console.error('Error creating sale:', err);
            notifyError(err.response?.data?.error || 'Failed to save bill. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;

    // Validate that important fields are filled
    const canProceed = (() => {
        // Basic validation
        if (cart.length === 0) return false;
        
        // Credit bill validation - allow partial payments
        if (billType === 'credit') {
            if (!customerName.trim() || !buyerPhone.trim()) return false;
            if (!paidAmount || Number(paidAmount) < 0) return false;
            if (Number(paidAmount) > total) return false;
        }
        
        // Split payment validation
        if (paymentMethod === 'Split') {
            const cash = Number(cashAmount || 0);
            const online = Number(onlineAmount || 0);
            const totalPaid = cash + online;
            
            if (totalPaid !== total) return false;
            if (cash < 0 || online < 0) return false;
        }
        
        // Cash payment validation
        if (paymentMethod === 'Cash' && billType !== 'credit') {
            // For cash bills, no additional validation needed
        }
        
        // Online payment validation
        if (paymentMethod === 'Online' && billType !== 'credit') {
            // For online bills, no additional validation needed
        }
        
        return true;
    })();

    return (
        <div className="billing-container">
            {/* Left Panel: Entry */}
            <div className="billing-entry-panel">
                <div className="panel-header">
                    <h1 className="page-title">Generate Bill</h1>
                    <p className="page-subtitle">Create a new invoice for customer</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="form-section glass-panel" style={{ position: 'relative', zIndex: 10 }}>
                    <h3 className="section-title">Bill Details</h3>

                    <div className="form-grid">
                        <div className="input-group">
                            <label>Bill Type</label>
                            <CustomDropdown
                                className="minimal-select"
                                value={billType}
                                onChange={(e) => setBillType(e.target.value)}
                                options={[
                                    { value: 'original', label: 'Original (Deducts Stock)' },
                                    { value: 'quotation', label: 'Quotation (Estimate Only — No DB Changes)' },
                                    { value: 'credit', label: 'Credit (Credit Sale — Saves to Customers)' }
                                ]}
                            />
                        </div>

                        <div className="input-group">
                            <label>{billType === 'credit' ? 'Customer Name *' : 'Customer Name'}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder={billType === 'credit' ? 'Enter customer name (required)' : 'Enter or pick customer'}
                                    value={customerName}
                                    onChange={(e) => { setCustomerName(e.target.value); setShowCustomerDropdown('customer'); }}
                                    onFocus={() => setShowCustomerDropdown('customer')}
                                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                                    required={billType === 'credit'}
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

                    {/* Company Name - shown for Original and Credit bills */}
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

                    {/* Credit-specific fields */}
                    {billType === 'credit' && (
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
                                {paidAmount && Number(paidAmount) > 0 && (
                                    <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '0.9rem', color: '#ef4444' }}>Remaining Balance:</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ef4444' }}>
                                                Rs. {Math.max(0, total - Number(paidAmount)).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Payment Method section (for Original or Credit bills) */}
                    {billType !== 'quotation' && (
                        <div className="form-grid" style={{ marginTop: '16px' }}>
                            <div className="input-group">
                                <label>Payment Method</label>
                                <CustomDropdown
                                    className="minimal-select"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    options={[
                                        { value: 'Cash', label: 'Cash' },
                                        { value: 'Online', label: 'Online (Easypaisa/Jazzcash)' },
                                        { value: 'Split', label: 'Split (Cash + Online)' }
                                    ]}
                                />
                            </div>
                        </div>
                    )}

                    {billType !== 'quotation' && paymentMethod === 'Split' && (
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
                            <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Paid:</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Rs. {(Number(cashAmount || 0) + Number(onlineAmount || 0)).toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginTop: '4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                                    <span style={{ fontSize: '0.9rem', color: '#ef4444' }}>Remaining:</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ef4444' }}>
                                        Rs. {Math.max(0, total - (Number(cashAmount || 0) + Number(onlineAmount || 0))).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="divider"></div>

                    <h3 className="section-title">Add Items</h3>
                    <div className="add-item-row">
                        <div className="input-group flex-2">
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Search by ID or Name..."
                                    style={{ paddingLeft: '35px', width: '100%' }}
                                    value={productSearchTerm}
                                    onChange={(e) => {
                                        setProductSearchTerm(e.target.value);
                                        setShowProductDropdown(true);
                                        if (selectedProduct) setSelectedProduct('');
                                    }}
                                    onFocus={() => setShowProductDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                                />
                                {showProductDropdown && (
                                    <div className="dropdown-options glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '250px', overflowY: 'auto' }}>
                                        {products
                                            .filter(p => billType === 'quotation' || (p.remaining_quantity && p.remaining_quantity >= 1))
                                            .filter(p =>
                                                p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                                                String(p.id).toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                                                formatProductId(p.id).toLowerCase().includes(productSearchTerm.toLowerCase())
                                            )
                                            .map(p => (
                                                <div
                                                    key={p.id}
                                                    className="dropdown-option"
                                                    style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 14px' }}
                                                    onMouseDown={() => {
                                                        setSelectedProduct(p.id);
                                                        setProductSearchTerm(`${p.name} - Rs. ${p.price}`);
                                                        const unitToSet = p.quantity_unit 
                                                            ? (p.quantity_unit.toLowerCase().startsWith('per ') ? p.quantity_unit : `Per ${p.quantity_unit}`) 
                                                            : 'Per Piece';
                                                        setSelectedUnit(unitToSet);
                                                        setShowProductDropdown(false);
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <strong style={{ fontSize: '0.95rem' }}>{p.name}</strong>
                                                        <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Rs. {p.price}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>ID: {formatProductId(p.id)}</span>
                                                        {p.category && <span>• {p.category}</span>}
                                                        {p.color && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                • <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.color, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }}></span> {p.color}
                                                            </span>
                                                        )}
                                                        {billType !== 'quotation' && <span style={{ color: p.remaining_quantity > 0 ? '#a78bfa' : '#ef4444' }}>• Stock: {p.remaining_quantity}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        {products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || String(p.id).toLowerCase().includes(productSearchTerm.toLowerCase())).length === 0 && (
                                            <div style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>No products found</div>
                                        )}
                                    </div>
                                )}
                            </div>
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
                            <CustomDropdown
                                className="minimal-select"
                                value={selectedUnit}
                                onChange={(e) => setSelectedUnit(e.target.value)}
                                options={[
                                    { value: 'Per Piece', label: 'Per Piece' },
                                    { value: 'Per Dozen', label: 'Per Dozen' },
                                    { value: 'Per Box', label: 'Per Box' },
                                    { value: 'Per Kg', label: 'Per Kg' },
                                    { value: 'Per Liter', label: 'Per Liter' },
                                    { value: 'Per Meter', label: 'Per Meter' },
                                    { value: 'Per Roll', label: 'Per Roll' },
                                    { value: 'Per Pack', label: 'Per Pack' },
                                    { value: 'Per Case', label: 'Per Case' },
                                    { value: 'Per Gallon', label: 'Per Gallon' },
                                    { value: 'Per Bucket', label: 'Per Bucket / Balti' },
                                    { value: 'Per 250g', label: 'Per 250 Gram' },
                                    { value: 'Per Gram', label: 'Per Gram' },
                                    { value: 'Per Inch', label: 'Per Inch' },
                                    { value: 'Per Ft', label: 'Per Ft' },
                                    { value: 'Per Millimeter', label: 'Per Millimeter' },
                                    { value: 'Per Pair', label: 'Per Pair' },
                                    { value: 'Per Set', label: 'Per Set' },
                                    { value: 'Per Strip', label: 'Per Strip' },
                                    { value: 'Per Bag', label: 'Per Bag' },
                                    { value: 'Per Coil', label: 'Per Coil' }
                                ]}
                            />
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
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', fontSize: '0.85em', color: 'var(--text-muted)', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{formatProductId(item.id)}</span>
                                            {item.category && <span>• {item.category}</span>}
                                            {item.color && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    • <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }}></span> {item.color}
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ marginTop: '4px' }}>
                                            Rs. {item.price} x {item.quantity} {item.cart_unit ? `(${stripPer(item.cart_unit)})` : ''}
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
                        <h2 style={{ fontSize: '1.4rem' }}>Jellani Hardware, Paint<br />and Electric Store</h2>
                        <p className="receipt-address">Main Kallar Syedan Road, Near DHA Phase 7 Gate 1</p>
                        <p className="receipt-contact">Ph: 0329-5749291</p>

                        <div className="receipt-type-badge">
                            {billType === 'quotation' ? 'QUOTATION / ESTIMATE' : billType === 'credit' ? 'CREDIT / CREDIT INVOICE' : 'TAX INVOICE'}
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
                                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                                    <div style={{ fontSize: '0.75em', color: '#666', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                        <span>[{formatProductId(item.id)}]</span>
                                        {item.category && <span>• {item.category}</span>}
                                        {item.color && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                • <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, border: '1px solid #ccc', display: 'inline-block' }}></span> {item.color}
                                            </span>
                                        )}
                                    </div>
                                </span>
                                <span>{item.quantity} {item.cart_unit ? `(${stripPer(item.cart_unit)})` : ''}</span>
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

                        {billType !== 'quotation' && (
                            <>
                                <div className="summary-row" style={{ marginTop: '10px' }}>
                                    <span>Method</span>
                                    <span style={{ fontWeight: 600 }}>{paymentMethod === 'Split' ? 'Split (Cash+Online)' : paymentMethod}</span>
                                </div>
                                {paymentMethod === 'Split' && (
                                    <>
                                        <div className="summary-row" style={{ fontSize: '0.85rem' }}>
                                            <span>Cash Paid</span>
                                            <span>Rs. {Number(cashAmount || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="summary-row" style={{ fontSize: '0.85rem' }}>
                                            <span>Online Paid</span>
                                            <span>Rs. {Number(onlineAmount || 0).toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {billType === 'credit' && (
                            <>
                                <div className="summary-row">
                                    <span>Paid Amount</span>
                                    <span>Rs. {Number(paidAmount || 0).toLocaleString()}</span>
                                </div>
                                <div className="summary-row total" style={{ color: '#ef4444' }}>
                                    <span>Remaining (Credit)</span>
                                    <span>Rs. {(total - Number(paidAmount || 0)).toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Advertisement Footer */}
                    <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-primary)' }}>
                        <p style={{ margin: '0 0 5px', fontSize: '0.8rem', fontWeight: 600 }}>Software Developed by Hassan Ali Abrar</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Insta: <strong style={{ color: 'var(--info)' }}>hassan.secure</strong> | WA: <strong style={{ color: 'var(--success)' }}>+92 348 5055098</strong></p>
                    </div>

                    <div className="flex gap-2 mt-auto bill-actions-container" style={{ flexWrap: 'wrap', marginTop: '20px' }}>
                        <button 
                            className="btn-secondary flex-1" 
                            onClick={handleDownloadPdf}
                            disabled={!canProceed || loading}
                            style={{ opacity: (!canProceed || loading) ? 0.5 : 1, cursor: (!canProceed || loading) ? 'not-allowed' : 'pointer' }}
                        >
                            <Download size={18} />
                            <span>Download PDF</span>
                        </button>
                        <button
                            className="btn-primary flex-1 bg-accent"
                            onClick={async () => {
                                await handleDownloadPdf();
                                if (billType !== 'quotation') {
                                    handleSaveBill();
                                }
                            }}
                            disabled={!canProceed || loading}
                            style={{ opacity: (!canProceed || loading) ? 0.5 : 1, cursor: (!canProceed || loading) ? 'not-allowed' : 'pointer' }}
                        >
                            <Save size={18} />
                            <span>{loading ? 'Processing...' : 'Download & Save'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Billing;
