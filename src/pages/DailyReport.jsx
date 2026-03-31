import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Download, FileText, Package, Truck, Target, CreditCard, Filter } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import CustomDatePicker from '../components/CustomDatePicker';
import './Expenses.css'; // borrowing standard page styles
import './Reports.css'; // Premium analytics styling

const DailyReport = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const [reportDate, setReportDate] = useState(defaultDate);
    const [loading, setLoading] = useState(false);
    
    // Data state
    const [salesToday, setSalesToday] = useState([]);
    const [returnsToday, setReturnsToday] = useState([]);
    const [productsToday, setProductsToday] = useState([]);
    const [supplierTxns, setSupplierTxns] = useState([]);
    const [buyersToday, setBuyersToday] = useState([]);
    const [suppliersToday, setSuppliersToday] = useState([]);
    
    const reportRef = useRef();

    useEffect(() => {
        fetchDailyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportDate]);

    const getConfig = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('inventory_token')}` }
    });

    const fetchDailyData = async () => {
        setLoading(true);
        try {
            // Fetch everything and filter front-end for the selected date
            const [salesRes, productsRes, suppliersRes, buyersRes, returnsRes] = await Promise.all([
                axios.get('/api/sales', getConfig()),
                axios.get('/api/products', getConfig()),
                axios.get('/api/suppliers', getConfig()),
                axios.get('/api/buyers', getConfig()),
                axios.get('/api/sales/returns', getConfig()).catch(() => ({ data: [] }))
            ]);

            // Filter Sales
            const sToday = (salesRes.data || []).filter(s => {
                const d = s.date || s.purchase_date || s.created_at || '';
                return d.startsWith(reportDate);
            });
            setSalesToday(sToday);

            // Filter Returns
            const retToday = (returnsRes.data || []).filter(r => {
                const dateOnly = r.returned_at ? r.returned_at.split('T')[0] : '';
                return dateOnly === reportDate;
            });
            setReturnsToday(retToday);

            // Filter Products added today
            const pToday = (productsRes.data || []).filter(p => {
                const d = p.created_at || p.date || '';
                return d.startsWith(reportDate);
            });
            setProductsToday(pToday);

            // Filter Supplier transactions (Udhaar given to suppliers)
            let stoday = [];
            const newSuppliers = [];
            (suppliersRes.data || []).forEach(supplier => {
                const txns = supplier.supplier_transactions || [];
                txns.forEach(txn => {
                    const d = txn.purchase_date || txn.date || txn.created_at || '';
                    if (d.startsWith(reportDate)) {
                        stoday.push({ ...txn, supplierName: supplier.name });
                    }
                });
                // Check if supplier was added today
                const d = supplier.created_at || supplier.date || '';
                if (d.startsWith(reportDate)) {
                    newSuppliers.push(supplier);
                }
            });
            setSupplierTxns(stoday);
            setSuppliersToday(newSuppliers);

            // Filter new buyers/companies
            const bToday = (buyersRes.data || []).filter(b => {
                const d = b.created_at || b.date || '';
                return d.startsWith(reportDate);
            });
            setBuyersToday(bToday);

        } catch (error) {
            console.error('Failed to fetch daily data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        const element = reportRef.current;
        
        // Landscape A4 = 297mm wide ≈ 1122px at 96dpi. Use 1060px to leave room for margins.
        const originalWidth = element.style.width;
        const originalMaxWidth = element.style.maxWidth;
        element.style.width = '1060px';
        element.style.maxWidth = '1060px';

        // Wait a tick so the browser reflows at the clamped width
        await new Promise(r => setTimeout(r, 100));

        const heightMm = element.scrollHeight * 0.264583;

        const opt = {
            margin:       [8, 8, 8, 8],
            // Generate random filename for security
            filename:     `Report_${new Date().toISOString().slice(0, 10)}_${Math.random().toString(36).substring(2, 15)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 1.8, useCORS: true, width: 1060, windowWidth: 1060 },
            jsPDF:        { unit: 'mm', format: [297, heightMm + 16], orientation: 'landscape' }
        };

        element.classList.add('pdf-mode-active');
        element.style.background = '#ffffff';
        
        const newWindow = window.open('', '_blank');
        if (newWindow) newWindow.document.write('<body><h2 style="font-family:sans-serif; text-align:center; margin-top: 20vh;">Generating Daily Report PDF...</h2></body>');
        
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
        element.style.width = originalWidth;
        element.style.maxWidth = originalMaxWidth;
    };


    // Calculations
    const totalSalesAmount = salesToday.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const totalCashPaid = salesToday.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const totalUdhaarGiven = totalSalesAmount - totalCashPaid;
    
    // Returns Calculation
    const totalReturnsAmount = returnsToday.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const totalReturnsQty = returnsToday.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    
    // Supplier Udhaar Calculation
    const supplierTotalAmount = supplierTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const supplierTotalPaid = supplierTxns.reduce((sum, t) => sum + Number(t.paid_amount || 0), 0);
    const totalUdhaarToSuppliers = supplierTotalAmount - supplierTotalPaid;

    return (
        <div className="report-container page-container fade-in" style={{ paddingBottom: '40px' }}>
            <header className="page-header" style={{ marginBottom: '30px' }}>
                <div>
                    <h1 className="page-title">Daily Report</h1>
                    <p className="page-subtitle">Generate a full summary for any given day</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Modern Glass Date Picker */}
                    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '12px', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <CustomDatePicker
                                value={reportDate}
                                onChange={setReportDate}
                                className="report-date-picker"
                            />
                        </div>
                    </div>
                    
                    {/* PDF Download Button */}
                    <button 
                        className="btn-primary" 
                        onClick={handleDownloadPdf}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px' }}
                        disabled={loading}
                    >
                        <Download size={18} />
                        <span>Download PDF</span>
                    </button>
                </div>
            </header>

            <div>
                {loading ? (
                    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                        <div className="text-center" style={{ color: 'var(--text-muted)' }}>Loading records...</div>
                    </div>
                ) : (
                    <div 
                        ref={reportRef} 
                        style={{ padding: '30px', borderRadius: '16px', minHeight: '800px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)' }}
                    >
                        {/* Report Header */}
                        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid var(--border-color)', paddingBottom: '20px' }}>
                            <h1 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: '0 0 8px' }}>Store Daily Report</h1>
                            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>Date: <strong>{new Date(reportDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></p>
                        </div>

                        {/* Top Metrics Grid */}
                        <div className="report-hero-stats">
                            <div className="stat-card-premium blue">
                                <div className="stat-header">
                                    <div className="stat-icon-wrapper">
                                        <Target size={24} />
                                    </div>
                                    <h3 className="stat-title">Total Sales Overview</h3>
                                </div>
                                <div className="stat-row">
                                    <span>Total Selling Amount:</span>
                                    <span className="stat-value">Rs. {totalSalesAmount.toLocaleString()}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Cash Received:</span>
                                    <span className="stat-value" style={{ color: 'var(--success)' }}>Rs. {totalCashPaid.toLocaleString()}</span>
                                </div>
                                <div className="stat-row highlight">
                                    <span>Given on Udhaar:</span>
                                    <span className="stat-value" style={{ color: totalUdhaarGiven > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>Rs. {totalUdhaarGiven.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="stat-card-premium purple">
                                <div className="stat-header">
                                    <div className="stat-icon-wrapper">
                                        <Truck size={24} />
                                    </div>
                                    <h3 className="stat-title">Supplier Payables (Today)</h3>
                                </div>
                                <div className="stat-row">
                                    <span>Total Bill (Purchases):</span>
                                    <span className="stat-value">Rs. {supplierTotalAmount.toLocaleString()}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Cash Paid:</span>
                                    <span className="stat-value" style={{ color: 'var(--success)' }}>Rs. {supplierTotalPaid.toLocaleString()}</span>
                                </div>
                                <div className="stat-row highlight">
                                    <span>Owed to Suppliers:</span>
                                    <span className="stat-value" style={{ color: totalUdhaarToSuppliers > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>Rs. {totalUdhaarToSuppliers.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="stat-card-premium red">
                                <div className="stat-header">
                                    <div className="stat-icon-wrapper">
                                        <Package size={24} />
                                    </div>
                                    <h3 className="stat-title">Returns Overview</h3>
                                </div>
                                <div className="stat-row">
                                    <span>Total Returns Value:</span>
                                    <span className="stat-value">Rs. {totalReturnsAmount.toLocaleString()}</span>
                                </div>
                                <div className="stat-row highlight">
                                    <span>Total Items Returned:</span>
                                    <span className="stat-value">{totalReturnsQty}</span>
                                </div>
                            </div>
                        </div>

                        {/* Inventory & Customers Context */}
                        <div className="report-hero-stats" style={{ marginBottom: '40px' }}>
                            <div className="premium-list-container">
                                <div className="premium-list-header">
                                    <div className="stat-icon-wrapper" style={{ width: 40, height: 40, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)', boxShadow: 'none' }}>
                                        <Package size={20} />
                                    </div>
                                    <h3>New Products ({productsToday.length})</h3>
                                </div>
                                {productsToday.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '10px 0' }}>No new products added today.</p>
                                ) : (
                                    <ul className="premium-list">
                                        {productsToday.map((p, i) => (
                                            <li key={i} className="premium-list-item">
                                                <strong>{p.name}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            
                            <div className="premium-list-container">
                                <div className="premium-list-header">
                                    <div className="stat-icon-wrapper" style={{ width: 40, height: 40, background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', boxShadow: 'none' }}>
                                        <Target size={20} />
                                    </div>
                                    <h3>New Customers ({buyersToday.length})</h3>
                                </div>
                                {buyersToday.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '10px 0' }}>No new customers today.</p>
                                ) : (
                                    <ul className="premium-list">
                                        {buyersToday.map((b, i) => (
                                            <li key={i} className="premium-list-item">
                                                <strong>{b.name}</strong> <span style={{ color: 'var(--text-muted)' }}>{b.company_name ? `(${b.company_name})` : ''}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="premium-list-container">
                                <div className="premium-list-header">
                                    <div className="stat-icon-wrapper" style={{ width: 40, height: 40, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', boxShadow: 'none' }}>
                                        <Truck size={20} />
                                    </div>
                                    <h3>New Suppliers ({suppliersToday.length})</h3>
                                </div>
                                {suppliersToday.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '10px 0' }}>No new suppliers today.</p>
                                ) : (
                                    <ul className="premium-list">
                                        {suppliersToday.map((s, i) => (
                                            <li key={i} className="premium-list-item">
                                                <strong>{s.name}</strong> <span style={{ color: 'var(--text-muted)' }}>{s.company_name ? `(${s.company_name})` : ''}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Returned Goods Section */}
                        {returnsToday.length > 0 && (
                            <div className="premium-list-container" style={{ marginBottom: '40px', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%)' }}>
                                <div className="premium-list-header" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                    <div className="stat-icon-wrapper" style={{ width: 40, height: 40, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', boxShadow: 'none' }}>
                                        <Package size={20} />
                                    </div>
                                    <h3 style={{ color: 'var(--danger)' }}>Goods Returned Today ({returnsToday.length})</h3>
                                </div>
                                <ul className="premium-list">
                                    {returnsToday.map((r, i) => (
                                        <li key={i} className="premium-list-item">
                                            <strong style={{ color: 'var(--danger)' }}>{r.product_name}</strong>
                                            <span style={{ color: 'var(--text-secondary)' }}>- Qty: {r.quantity}</span>
                                            <span style={{ color: 'var(--text-primary)', marginLeft: '8px', fontWeight: 600 }}>
                                                (Refunded: Rs.{Number(r.total_amount).toLocaleString()})
                                            </span>
                                            {r.buyer_name && <span style={{ marginLeft: 'auto', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-muted)' }}>from {r.buyer_name}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Recent Transactions Table */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                                <div className="stat-icon-wrapper" style={{ width: 40, height: 40, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)', boxShadow: 'none' }}>
                                    <CreditCard size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>Detailed Sales Log ({salesToday.length} records)</h3>
                            </div>
                            
                            {salesToday.length === 0 ? (
                                <div className="premium-list-container" style={{ padding: '40px', textAlign: 'center' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>No sales recorded today.</p>
                                </div>
                            ) : (
                                <div className="premium-table-wrap">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Customer</th>
                                                <th>Product Info</th>
                                                <th>Qty</th>
                                                <th>Total Amount</th>
                                                <th>Paid Amount</th>
                                                <th>Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {salesToday.map((sale, i) => {
                                                const total = Number(sale.total_amount || 0);
                                                const paid = Number(sale.paid_amount || 0);
                                                const udhaar = total - paid;
                                                return (
                                                    <tr key={i}>
                                                        <td>{sale.buyer_name || sale.buyers?.name || 'Walk-in Customer'}</td>
                                                        <td>
                                                            <div style={{ fontWeight: 500 }}>{sale.products?.name || `Product ID ${sale.product_id}`}</div>
                                                        </td>
                                                        <td>{sale.quantity}</td>
                                                        <td style={{ fontWeight: 600 }}>Rs. {total.toLocaleString()}</td>
                                                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>Rs. {paid.toLocaleString()}</td>
                                                        <td>
                                                            {udhaar > 0 ? (
                                                                <span style={{ color: 'var(--danger)', fontWeight: 600, background: 'rgba(239, 68, 68, 0.15)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem' }}>
                                                                    Udhaar: Rs. {udhaar.toLocaleString()}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--success)', fontWeight: 600, background: 'rgba(34, 197, 94, 0.15)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem' }}>
                                                                    Clear
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Advertisement Footer */}
                        <div style={{ marginTop: '50px', paddingTop: '24px', borderTop: '2px solid var(--border-color)', textAlign: 'center', color: 'var(--text-primary)' }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.5px' }}>Software Developed by Hassan Ali Abrar</h3>
                            <p style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Instagram: <strong style={{ color: 'var(--info)' }}>hassan.secure</strong> | WhatsApp: <strong style={{ color: 'var(--success)' }}>+92 348 5055098</strong></p>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contact for custom software development, business automation, and IT solutions.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReport;
