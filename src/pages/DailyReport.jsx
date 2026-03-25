import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Download, FileText, Package, Truck, Target, CreditCard, Filter } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import './Expenses.css'; // borrowing standard page styles

const DailyReport = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const [reportDate, setReportDate] = useState(defaultDate);
    const [loading, setLoading] = useState(false);
    
    // Data state
    const [salesToday, setSalesToday] = useState([]);
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
            const [salesRes, productsRes, suppliersRes, buyersRes] = await Promise.all([
                axios.get('/api/sales', getConfig()),
                axios.get('/api/products', getConfig()),
                axios.get('/api/suppliers', getConfig()),
                axios.get('/api/buyers', getConfig())
            ]);

            // Filter Sales
            const sToday = (salesRes.data || []).filter(s => {
                const d = s.date || s.purchase_date || s.created_at || '';
                return d.startsWith(reportDate);
            });
            setSalesToday(sToday);

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

    const handleDownloadPdf = () => {
        const element = reportRef.current;
        const opt = {
            margin:       0.5,
            filename:     `Daily_Report_${reportDate}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        // Ensure we temporarily style the print container for pure white background explicitly
        element.style.background = '#ffffff';
        element.style.color = '#000000'; // Make text black for PDF purely
        
        html2pdf().set(opt).from(element).save().then(() => {
            // Revert styles automatically by unsetting
            element.style.background = '';
            element.style.color = '';
        });
    };

    // Calculations
    const totalSalesAmount = salesToday.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const totalCashPaid = salesToday.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const totalUdhaarGiven = totalSalesAmount - totalCashPaid;
    
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
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Select Date</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                    type="date"
                                    className="input-field minimal-select"
                                    value={reportDate}
                                    onChange={(e) => setReportDate(e.target.value)}
                                    style={{ padding: '4px 8px', minWidth: '130px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '600', outline: 'none' }}
                                />
                            </div>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '40px' }}>
                            <div style={{ padding: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Target size={20} color="#38bdf8" />
                                    <h3 style={{ fontSize: '1.1rem', color: '#38bdf8', margin: 0 }}>Total Sales Overview</h3>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'inherit' }}>Total Selling Amount:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>Rs. {totalSalesAmount.toLocaleString()}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'inherit' }}>Cash Received:</span>
                                    <strong style={{ color: 'var(--success)' }}>Rs. {totalCashPaid.toLocaleString()}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                                    <span style={{ color: 'inherit' }}>Given on Udhaar:</span>
                                    <strong style={{ color: totalUdhaarGiven > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>Rs. {totalUdhaarGiven.toLocaleString()}</strong>
                                </div>
                            </div>

                            <div style={{ padding: '20px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Truck size={20} color="#a855f7" />
                                    <h3 style={{ fontSize: '1.1rem', color: '#a855f7', margin: 0 }}>Supplier Payables (Today)</h3>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'inherit' }}>Total Bill (Purchases):</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>Rs. {supplierTotalAmount.toLocaleString()}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'inherit' }}>Cash Paid:</span>
                                    <strong style={{ color: 'var(--success)' }}>Rs. {supplierTotalPaid.toLocaleString()}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                                    <span style={{ color: 'inherit' }}>Owed to Suppliers:</span>
                                    <strong style={{ color: totalUdhaarToSuppliers > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>Rs. {totalUdhaarToSuppliers.toLocaleString()}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Inventory & Customers Context */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                    <Package size={20} color="var(--accent-primary)" />
                                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>New Products ({productsToday.length})</h3>
                                </div>
                                {productsToday.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No new products.</p>
                                ) : (
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                                        {productsToday.map((p, i) => (
                                            <li key={i} style={{ marginBottom: '6px' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                    <Target size={20} color="var(--success)" />
                                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>New Customers ({buyersToday.length})</h3>
                                </div>
                                {buyersToday.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No new customers.</p>
                                ) : (
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                                        {buyersToday.map((b, i) => (
                                            <li key={i} style={{ marginBottom: '6px' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>{b.name}</strong> {b.company_name ? `(${b.company_name})` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                    <Truck size={20} color="var(--warning)" />
                                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>New Suppliers ({suppliersToday.length})</h3>
                                </div>
                                {suppliersToday.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No new suppliers.</p>
                                ) : (
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                                        {suppliersToday.map((s, i) => (
                                            <li key={i} style={{ marginBottom: '6px' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>{s.name}</strong> {s.company_name ? `(${s.company_name})` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Recent Transactions Table */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                <CreditCard size={20} color="var(--accent-primary)" />
                                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>Detailed Sales Log ({salesToday.length} records)</h3>
                            </div>
                            {salesToday.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No sales recorded today.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '10px 4px' }}>Customer</th>
                                            <th style={{ padding: '10px 4px' }}>Product Info</th>
                                            <th style={{ padding: '10px 4px' }}>Qty</th>
                                            <th style={{ padding: '10px 4px' }}>Total Amount</th>
                                            <th style={{ padding: '10px 4px' }}>Paid Amount</th>
                                            <th style={{ padding: '10px 4px' }}>Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salesToday.map((sale, i) => {
                                            const total = Number(sale.total_amount || 0);
                                            const paid = Number(sale.paid_amount || 0);
                                            const udhaar = total - paid;
                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
                                                    <td style={{ padding: '10px 4px' }}>{sale.buyer_name || sale.buyers?.name || 'Walk-in Customer'}</td>
                                                    <td style={{ padding: '10px 4px' }}>{sale.products?.name || `Product ID ${sale.product_id}`}</td>
                                                    <td style={{ padding: '10px 4px' }}>{sale.quantity}</td>
                                                    <td style={{ padding: '10px 4px' }}>Rs. {total.toLocaleString()}</td>
                                                    <td style={{ padding: '10px 4px', color: 'var(--success)' }}>Rs. {paid.toLocaleString()}</td>
                                                    <td style={{ padding: '10px 4px' }}>
                                                        {udhaar > 0 ? (
                                                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Udhaar: Rs. {udhaar.toLocaleString()}</span>
                                                        ) : (
                                                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>Clear</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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
