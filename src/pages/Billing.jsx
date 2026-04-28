import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Printer, Search, Receipt, Calculator, Save, RefreshCw, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import CustomDropdown from '../components/CustomDropdown';
import { alertSuccess, alertError } from '../utils/notifications';
import { useShopSettings } from '../utils/useShopSettings';
import { fuzzyMatch } from '../utils/fuzzySearch';
import './Billing.css';

// ─── FUZZY SEARCH LOGIC ───
const levenshtein = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
};

const fuzzySearch = (query, text, id, formattedId) => {
    if (!query) return true;
    query = query.toLowerCase();
    text = text.toLowerCase();
    id = String(id).toLowerCase();
    formattedId = formattedId.toLowerCase();

    if (text.includes(query) || id.includes(query) || formattedId.includes(query)) return true;

    const queryWords = query.split(/\s+/).filter(Boolean);
    const textWords = text.split(/\s+/).filter(Boolean);
    textWords.push(id, formattedId);

    return queryWords.every(qw => {
        return textWords.some(tw => {
            if (tw.includes(qw)) return true;
            const allowedTypos = qw.length > 5 ? 2 : (qw.length > 3 ? 1 : 0);
            return levenshtein(qw, tw) <= allowedTypos;
        });
    });
};
// ──────────────────────────

const Billing = () => {
    const shopSettings = useShopSettings();
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
    const [skipFocus, setSkipFocus] = useState(false);

    const [currentInvoiceId, setCurrentInvoiceId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchNextInvoiceId = async () => {
        try {
            const token = localStorage.getItem('inventory_token');
            const res = await axios.get('/api/billing/next-invoice-id', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentInvoiceId(res.data.nextInvoiceId);
        } catch (err) {
            console.error('Failed to fetch next invoice ID', err);
        }
    };

    // Credit-specific fields
    const [buyerPhone, setBuyerPhone] = useState('');
    const [paidAmount, setPaidAmount] = useState('0');

    // Payment method fields
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [cashAmount, setCashAmount] = useState('');
    const [onlineAmount, setOnlineAmount] = useState('');

    // Recent generated bill recovery
    const [recentGeneratedBill, setRecentGeneratedBill] = useState(null);
    const [isEditingGeneratedBill, setIsEditingGeneratedBill] = useState(false);
    const skipAutosave = useRef(false);

    const receiptRef = useRef();

    const handleDownloadPdf = async (preOpenedWindow = null) => {
        if (cart.length === 0) {
            alertError('Error', "No items in the cart to print.");
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

        const recentBillContainer = element.querySelector('.recent-bill-container');
        if (recentBillContainer) recentBillContainer.style.display = 'none';

        const newWindow = preOpenedWindow || window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write('<body><h2 style="font-family:sans-serif; text-align:center; margin-top: 20vh;">Generating PDF Receipt...</h2></body>');
        }

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
        if (recentBillContainer) recentBillContainer.style.display = 'flex';
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
        fetchNextInvoiceId();

        // Polling setup for cross-platform real-time sync of invoice ID
        // Uses virtually 0 bandwidth since the backend caches it in-memory
        const intervalId = setInterval(() => {
            fetchNextInvoiceId();
        }, 5000);

        // Load recent generated bill for the side panel
        const savedRecent = localStorage.getItem('recent_billing_data');
        if (savedRecent) {
            try {
                setRecentGeneratedBill(JSON.parse(savedRecent));
            } catch (e) { console.error('Failed to parse recent bill', e); }
        }

        // Load auto-saved draft if exists
        const savedDraft = localStorage.getItem('current_billing_draft');
        if (savedDraft) {
            try {
                skipAutosave.current = true;
                const draft = JSON.parse(savedDraft);
                setCart(draft.cart || []);
                setCustomerName(draft.customerName || '');
                setCompanyName(draft.companyName || '');
                setBuyerPhone(draft.buyerPhone || '');
                setBillType(draft.billType || 'original');
                setPaidAmount(draft.paidAmount || '0');
                setPaymentMethod(draft.paymentMethod || 'Cash');
                setCashAmount(draft.cashAmount || '');
                setOnlineAmount(draft.onlineAmount || '');
                setIsEditingGeneratedBill(draft.isEditingGeneratedBill || false);

                setTimeout(() => { skipAutosave.current = false; }, 500);
            } catch (e) {
                console.error('Failed to parse draft', e);
                skipAutosave.current = false;
            }
        }

        return () => {
            clearInterval(intervalId);
        };
    }, []);

    // Continuously auto-save the active draft (debounced slightly by React batching)
    useEffect(() => {
        if (skipAutosave.current) return;

        const draftObj = {
            cart,
            customerName,
            companyName,
            buyerPhone,
            billType,
            paidAmount,
            paymentMethod,
            cashAmount,
            onlineAmount,
            isEditingGeneratedBill
        };

        if (cart.length > 0 || customerName) {
            localStorage.setItem('current_billing_draft', JSON.stringify(draftObj));
        } else {
            // If completely empty, remove draft
            localStorage.removeItem('current_billing_draft');
        }
    }, [cart, customerName, companyName, buyerPhone, billType, paidAmount, paymentMethod, cashAmount, onlineAmount, isEditingGeneratedBill]);

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

    const clearCartUI = () => {
        skipAutosave.current = true;
        setIsEditingGeneratedBill(false);
        setCart([]);
        setCustomerName('');
        setCompanyName('');
        setBuyerPhone('');
        setPaidAmount('0');
        setCashAmount('');
        setOnlineAmount('');
        fetchNextInvoiceId();
        localStorage.removeItem('current_billing_draft');
        setTimeout(() => { skipAutosave.current = false; }, 500);
    };

    const handleSaveBill = async () => {
        if (cart.length === 0) {
            alertError('Error', "No items in the cart to create a bill.");
            return null;
        }

        // ===== QUOTATION BILL =====
        if (billType === 'quotation') {
            alertSuccess('Success', "Quotation Generated! (No database changes)");
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
            if (Number(cashAmount || 0) < 0 || Number(onlineAmount || 0) < 0) {
                alertError('Error', 'Please enter valid amounts for the split payment.');
                return;
            }
            finalCashAmount = Number(cashAmount || 0);
            finalOnlineAmount = Number(onlineAmount || 0);
            if (targetPaidAmount > 0 && Math.abs((finalCashAmount + finalOnlineAmount) - targetPaidAmount) > 0.01) {
                alertError('Error', `Split amounts (${finalCashAmount} + ${finalOnlineAmount} = ${finalCashAmount + finalOnlineAmount}) must equal the paid amount (${targetPaidAmount}).`);
                return;
            }
        }

        // ===== CREDIT VALIDATION =====
        if (billType === 'credit' && (!customerName.trim() || !buyerPhone.trim())) {
            alertError('Error', 'Credit bill requires Customer Name and Phone.');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('inventory_token');
            const generatedInvoiceId = currentInvoiceId;
            const billTimestamp = new Date().toISOString();
            const total_value = total;

            // If editing an already generated bill, erase the old transactions cleanly first
            if (isEditingGeneratedBill && recentGeneratedBill?.cart) {
                for (const oldItem of recentGeneratedBill.cart) {
                    if (oldItem.txn_id) {
                        try {
                            await axios.delete(`/api/sales/${oldItem.txn_id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                        } catch (e) {
                            console.error('Failed to erase previous transaction line', e);
                        }
                    }
                }
            }

            // ── Pre-compute per-item paid / split amounts (same logic as before) ──
            const userPaid = billType === 'credit' ? Number(paidAmount || 0) : null;
            let currentCashPool = finalCashAmount;
            let currentOnlinePool = finalOnlineAmount;

            const computedCart = cart.map((item, i) => {
                const itemTotal = item.price * item.quantity;
                const isLastItem = i === cart.length - 1;

                let itemPaidAmount;
                if (billType === 'credit') {
                    const ratio = total_value > 0 ? (itemTotal / total_value) : 0;
                    itemPaidAmount = isLastItem
                        ? (userPaid - cart.slice(0, i).reduce((s, it) => s + Math.round((it.price * it.quantity / total_value) * userPaid), 0))
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

                return {
                    product_id: item.id,
                    product_name: item.name, // Added for error tracing
                    quantity: item.quantity,
                    price: item.price,
                    cart_unit: item.cart_unit,
                    itemPaidAmount,
                    thisCash,
                    thisOnline
                };
            });

            // ── Single atomic request — nothing saved unless ALL items succeed ──
            const res = await axios.post('/api/billing', {
                billType,
                customerName: customerName || null,
                buyerPhone: buyerPhone || null,
                companyName: companyName || null,
                paymentMethod,
                paidAmount: billType === 'credit' ? Number(paidAmount || 0) : total_value,
                cashAmount: finalCashAmount,
                onlineAmount: finalOnlineAmount,
                invoiceId: generatedInvoiceId,
                billTimestamp,
                cart: computedCart
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Attach txn IDs to cart items for receipt recovery
            const generatedCartItems = cart.map((item, i) => ({
                ...item,
                txn_id: res.data.items?.[i]?.txn_id
            }));

            if (billType === 'credit') {
                const remaining = total_value - Number(paidAmount || 0);
                alertSuccess('Success', `Credit Bill saved! Stock deducted. Remaining balance: Rs. ${remaining}`);
            } else {
                alertSuccess('Success', 'Original Bill saved! Stock has been deducted.');
            }

            // Low stock alerts
            const lowStockAlerts = cart
                .map(item => {
                    const newRemaining = item.remaining_quantity - item.quantity;
                    const threshold = item.low_stock_threshold ?? 10;
                    return newRemaining <= threshold ? `${item.name} (${newRemaining} left)` : null;
                })
                .filter(Boolean);

            if (lowStockAlerts.length > 0) {
                setTimeout(() => alertError('Error', `⚠️ Low Stock Alert:\n${lowStockAlerts.join('\n')}`), 500);
            }

            // Save recent bill for receipt recovery
            const savedBillObj = {
                cart: generatedCartItems,
                customerName, companyName, buyerPhone, billType, paidAmount, paymentMethod, cashAmount, onlineAmount,
                isEditingGeneratedBill: false
            };
            localStorage.setItem('recent_billing_data', JSON.stringify(savedBillObj));
            setRecentGeneratedBill(savedBillObj);

            fetchProducts();
            fetchCustomers();

            return generatedInvoiceId;
        } catch (err) {
            console.error('Error creating bill:', err);
            alertError('Error', err.response?.data?.error || 'Failed to save bill. Please try again.');
            return null;
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

        // Split payment validation - different logic for credit vs regular bills
        if (paymentMethod === 'Split') {
            if (billType === 'credit') {
                // For credit bills: cash + online = paid amount
                const cash = Number(cashAmount || 0);
                const online = Number(onlineAmount || 0);
                const totalPaid = cash + online;

                if (totalPaid !== Number(paidAmount || 0)) return false;
                if (cash < 0 || online < 0) return false;
            } else {
                // For regular bills: cash + online = total amount
                const cash = Number(cashAmount || 0);
                const online = Number(onlineAmount || 0);
                const totalPaid = cash + online;

                if (totalPaid !== total) return false;
                if (cash < 0 || online < 0) return false;
            }
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
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isEditingGeneratedBill ? <span style={{ color: '#f59e0b' }}>Editing Printed Bill</span> : 'Generate Bill'}
                        </h1>
                        <p className="page-subtitle">
                            {isEditingGeneratedBill ? 'Changes will completely replace the previous bill' : 'Create a new invoice for customer'}
                        </p>
                    </div>
                    {isEditingGeneratedBill && (
                        <button
                            className="btn-danger"
                            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                            onClick={() => {
                                setIsEditingGeneratedBill(false);
                                setCart([]);
                                localStorage.removeItem('current_billing_draft');
                                alertSuccess('Cancelled', 'Returned to new blank bill');
                            }}
                        >
                            Cancel Editing
                        </button>
                    )}
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
                                    placeholder={billType === 'credit' ? 'Enter customer name (required)' : 'Enter customer name'}
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required={billType === 'credit'}
                                />
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
                                    onChange={(e) => {
                                        const cash = e.target.value;
                                        setCashAmount(cash);
                                        const targetTotal = billType === 'credit' ? Number(paidAmount || 0) : total;
                                        if (cash === '') {
                                            setOnlineAmount(String(targetTotal));
                                        } else if (Number(cash) >= 0) {
                                            setOnlineAmount(String(Math.max(0, targetTotal - Number(cash))));
                                        }
                                    }}
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
                                    onChange={(e) => {
                                        const online = e.target.value;
                                        setOnlineAmount(online);
                                        const targetTotal = billType === 'credit' ? Number(paidAmount || 0) : total;
                                        if (online === '') {
                                            setCashAmount(String(targetTotal));
                                        } else if (Number(online) >= 0) {
                                            setCashAmount(String(Math.max(0, targetTotal - Number(online))));
                                        }
                                    }}
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
                                            .filter(p => fuzzySearch(productSearchTerm, p.name, p.id, formatProductId(p.id)))
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
                                        {products.filter(p => fuzzySearch(productSearchTerm, p.name, p.id, formatProductId(p.id))).length === 0 && (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="item-count">{cart.length} items</span>
                            {(cart.length > 0 || customerName || companyName || buyerPhone) && (
                                <button
                                    onClick={() => {
                                        skipAutosave.current = true;
                                        setCart([]);
                                        setCustomerName('');
                                        setCompanyName('');
                                        setBuyerPhone('');
                                        setPaidAmount('0');
                                        setCashAmount('');
                                        setOnlineAmount('');
                                        setPaymentMethod('Cash');
                                        setBillType('original');
                                        setIsEditingGeneratedBill(false);
                                        setSelectedProduct('');
                                        setProductSearchTerm('');
                                        setQuantity(1);
                                        setError(null);
                                        localStorage.removeItem('current_billing_draft');
                                        setTimeout(() => { skipAutosave.current = false; }, 300);
                                    }}
                                    style={{
                                        background: 'rgba(239,68,68,0.15)',
                                        border: '1px solid rgba(239,68,68,0.4)',
                                        borderRadius: '6px',
                                        color: '#ef4444',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                    title="Clear all cart items and inputs"
                                >
                                    <Trash2 size={12} /> Cancel Bill
                                </button>
                            )}
                        </div>
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
                        <h2 style={{ fontSize: '1.4rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                            {shopSettings.name}
                        </h2>
                        <p className="receipt-address">{shopSettings.address}</p>
                        <p className="receipt-contact">Ph: {shopSettings.phone}</p>

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
                            <span id="receipt-invoice-id" style={{ color: 'inherit', fontSize: 'inherit', fontStyle: 'normal' }}>
                                #{cart.length > 0 && cart[0].invoice_id ? cart[0].invoice_id : cart.length > 0 && cart[0].txn_id ? cart[0].txn_id : currentInvoiceId}
                            </span>
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
                                if (billType === 'quotation') {
                                    await handleDownloadPdf();
                                } else {
                                    // Open window synchronously to avoid popup blocker
                                    const newWindow = window.open('', '_blank');
                                    if (newWindow) newWindow.document.write('<body><h2 style="font-family:sans-serif; text-align:center; margin-top: 20vh;">Saving Bill & Generating Receipt...</h2></body>');

                                    const firstTxnId = await handleSaveBill();
                                    if (firstTxnId) {
                                        const invSpan = document.getElementById('receipt-invoice-id');
                                        if (invSpan) invSpan.innerText = `#${firstTxnId}`;
                                        await handleDownloadPdf(newWindow);
                                        clearCartUI();
                                    } else {
                                        // If save failed, close the loading window
                                        if (newWindow) newWindow.close();
                                    }
                                }
                            }}
                            disabled={!canProceed || loading}
                            style={{ opacity: (!canProceed || loading) ? 0.5 : 1, cursor: (!canProceed || loading) ? 'not-allowed' : 'pointer' }}
                        >
                            <Save size={18} />
                            <span>{loading ? 'Processing...' : 'Download & Save'}</span>
                        </button>
                    </div>

                    {/* Recent Bill compact inline row */}
                    {recentGeneratedBill && !isEditingGeneratedBill && (
                        <div className="recent-bill-container" style={{
                            marginTop: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: '10px',
                            padding: '10px 14px'
                        }}>
                            <Receipt size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{recentGeneratedBill.customerName || 'Walk-in'}</strong>
                                    {' — '}{recentGeneratedBill.cart?.length || 0} items, Rs.&nbsp;
                                    {(recentGeneratedBill.cart || []).reduce((s, it) => s + (it.price * it.quantity), 0).toLocaleString()}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    skipAutosave.current = true;
                                    setCart(recentGeneratedBill.cart || []);
                                    setCustomerName(recentGeneratedBill.customerName || '');
                                    setCompanyName(recentGeneratedBill.companyName || '');
                                    setBuyerPhone(recentGeneratedBill.buyerPhone || '');
                                    setBillType(recentGeneratedBill.billType || 'original');
                                    setPaidAmount(recentGeneratedBill.paidAmount || '0');
                                    setPaymentMethod(recentGeneratedBill.paymentMethod || 'Cash');
                                    setCashAmount(recentGeneratedBill.cashAmount || '');
                                    setOnlineAmount(recentGeneratedBill.onlineAmount || '');
                                    setIsEditingGeneratedBill(true);
                                    if (recentGeneratedBill.cart && recentGeneratedBill.cart.length > 0 && recentGeneratedBill.cart[0].invoice_id) {
                                        setCurrentInvoiceId(recentGeneratedBill.cart[0].invoice_id);
                                    }
                                    setTimeout(() => { skipAutosave.current = false; }, 500);
                                    alertSuccess('Recovered', 'Recent bill loaded into editor!');
                                }}
                                style={{
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    padding: '5px 10px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <RefreshCw size={12} /> Edit
                            </button>
                            <button
                                onClick={() => { localStorage.removeItem('recent_billing_data'); setRecentGeneratedBill(null); }}
                                title="Clear"
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>


        </div >
    );
};

export default Billing;

