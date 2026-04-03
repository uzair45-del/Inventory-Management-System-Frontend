import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Wallet, Users, Truck, AlertTriangle, Building2, Banknote, Download } from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';
import CustomDatePicker from '../components/CustomDatePicker';
import { notifyError } from '../utils/notifications';
import './MonthlyReport.css'; // Optional generic modern styling
import './Reports.css'; // Premium analytics styling

const API_URL = '/api/reports/monthly';

const MonthlyReport = () => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    // Use single date state for month and year
    const currentDate = new Date();
    const [selectedDate, setSelectedDate] = useState(currentDate.toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'daily_summary'
    const reportRef = useRef();

    // Extract month and year from selected date
    const filterYear = new Date(selectedDate).getFullYear().toString();
    const filterMonth = String(new Date(selectedDate).getMonth() + 1).padStart(2, '0');

    useEffect(() => {
        fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterYear, filterMonth]);

    const handleDownloadPdf = async () => {
        const element = reportRef.current;

        // Landscape A4 = 297mm wide ≈ 1122px at 96dpi. Use 1060px to leave room for margins.
        const originalWidth = element.style.width;
        const originalMaxWidth = element.style.maxWidth;
        element.style.width = '1060px';
        element.style.maxWidth = '1060px';

        await new Promise(r => setTimeout(r, 100));

        const heightMm = element.scrollHeight * 0.264583;

        const opt = {
            margin:       [5, 5, 5, 5],
            // Generate random filename for security
            filename:     `Report_${new Date().toISOString().slice(0, 10)}_${Math.random().toString(36).substring(2, 15)}.pdf`,
            image:        { type: 'jpeg', quality: 0.95 },
            html2canvas:  { scale: 1.0, useCORS: true, width: 1060, windowWidth: 1060 },
            jsPDF:        { unit: 'mm', format: [297, heightMm * 0.55 + 10], orientation: 'landscape' }
        };

        element.classList.add('pdf-mode-active');
        element.style.background = '#ffffff';
        element.style.color = '#000000';
        
        const newWindow = window.open('', '_blank');
        if (newWindow) newWindow.document.write('<body><h2 style="font-family:sans-serif; text-align:center; margin-top: 20vh;">Generating Monthly Report PDF...</h2></body>');
        
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

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}?year=${filterYear}&month=${filterMonth}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('inventory_token')}` }
            });
            setReportData(response.data);
        } catch (error) {
            console.error('Failed to fetch monthly report:', error);
            notifyError('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <RefreshCw className="spinner" size={40} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (!reportData) return <div className="page-container">No Data Available</div>;

    const { summary, expense_breakdown, activity_lists, company_wise_summary } = reportData;

    return (
        <div className="report-container page-container fade-in" style={{ paddingBottom: '40px' }}>
            <header className="page-header" style={{ marginBottom: '30px' }}>
                <div>
                    <h1 className="page-title">Monthly Financial Report</h1>
                    <p className="page-subtitle">Complete overview of your business health</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Date selector */}
                    <CustomDatePicker
                        value={selectedDate}
                        onChange={setSelectedDate}
                        label="SELECT DATE"
                        className="monthly-report-date-picker"
                    />
                    
                    {/* View Toggle */}
                    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '12px', background: 'var(--bg-secondary)' }}>
                        <button 
                            onClick={() => setViewMode('overview')}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: viewMode === 'overview' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'overview' ? '#fff' : 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}
                        >
                            Overview
                        </button>
                        <button 
                            onClick={() => setViewMode('daily_summary')}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: viewMode === 'daily_summary' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'daily_summary' ? '#fff' : 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}
                        >
                            Daily Summaries
                        </button>
                    </div>

                    {/* PDF Download Button */}
                    <button 
                        className="btn-primary" 
                        onClick={handleDownloadPdf}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', marginLeft: '12px' }}
                    >
                        <Download size={18} />
                        <span>Download PDF</span>
                    </button>
                </div>
            </header>
            <div ref={reportRef} style={{ background: 'var(--bg-primary)', padding: '30px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                
                {/* PDF Report Header (Only visible / structured for doc feel) */}
                <div style={{ textAlign: 'center', marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid var(--border-color)' }}>
                    <h1 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: '0 0 8px' }}>
                        {viewMode === 'overview' ? 'Monthly Summary' : 'Day-by-Day Monthly Summary'}
                    </h1>
                    <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>Period: <strong>{new Date(selectedDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong></p>
                </div>

                {/* OVERVIEW MODE */}
                <div style={{ display: viewMode === 'overview' ? 'block' : 'none' }}>
                    {/* KEY METRICS */}
                    <div className="report-hero-stats">

                        {/* Net Cash Flow */}
                        <div className={`stat-card-premium ${summary.cash_flow_profit >= 0 ? 'green' : 'red'}`}>
                            <div className="stat-header">
                                <div className="stat-icon-wrapper">
                                    {summary.cash_flow_profit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                                </div>
                                <h3 className="stat-title">Cash Flow Profit (In hand)</h3>
                            </div>
                            <div className="stat-row highlight">
                                <span>Net Difference:</span>
                                <span className="stat-value" style={{ color: summary.cash_flow_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    Rs. {summary.cash_flow_profit.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Accrual Profit */}
                        <div className="stat-card-premium blue" title="Profit based on invoice totals, regardless of if cash was received">
                            <div className="stat-header">
                                <div className="stat-icon-wrapper">
                                    <Wallet size={24} />
                                </div>
                                <h3 className="stat-title">Gross Business Margin</h3>
                            </div>
                            <div className="stat-row highlight">
                                <span>Estimated Margin:</span>
                                <span className="stat-value">Rs. {summary.accrual_profit.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Returns */}
                        <div className="stat-card-premium red">
                            <div className="stat-header">
                                <div className="stat-icon-wrapper">
                                    <TrendingDown size={24} />
                                </div>
                                <h3 className="stat-title">Total Returns</h3>
                            </div>
                            <div className="stat-row highlight">
                                <span>Refunded:</span>
                                <span className="stat-value">Rs. {summary.total_returns_this_month?.toLocaleString() || '0'}</span>
                            </div>
                        </div>

                        {/* Expenses */}
                        <div className="stat-card-premium orange">
                            <div className="stat-header">
                                <div className="stat-icon-wrapper">
                                    <DollarSign size={24} />
                                </div>
                                <h3 className="stat-title">Total Shop Expenses</h3>
                            </div>
                            <div className="stat-row highlight">
                                <span>Outflow:</span>
                                <span className="stat-value">Rs. {summary.total_expenses.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Risk / Dues */}
                        <div className="stat-card-premium purple">
                            <div className="stat-header">
                                <div className="stat-icon-wrapper">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="stat-title">Pending Customer Dues</h3>
                            </div>
                            <div className="stat-row highlight">
                                <span>All-Time:</span>
                                <span className="stat-value">Rs. {summary.total_all_time_dues_from_buyers.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* DETAILED LEDGER SPLIT */}
                    <div className="ledger-split" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>

                        {/* INCOME SIDE */}
                        <div className="ledger-section">
                            <h2 style={{ fontSize: '1.2rem', color: '#38bdf8', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Users size={20} /> Income & Receivables
                            </h2>

                            <div className="premium-list-container" style={{ marginBottom: '24px', background: 'rgba(56, 189, 248, 0.02)' }}>
                                <div className="premium-list-header">
                                    <div className="stat-icon-wrapper" style={{ width: 40, height: 40, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)', boxShadow: 'none' }}>
                                        <Users size={20} />
                                    </div>
                                    <h3 style={{ fontSize: '1.25rem', color: '#38bdf8', margin: 0 }}>Income & Receivables</h3>
                                </div>
                                <div className="stat-row">
                                    <span>Total Sales Invoices Made:</span>
                                    <span className="stat-value">Rs. {summary.total_sales_created_value.toLocaleString()}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Cash Sales (Fully Paid):</span>
                                    <span className="stat-value" style={{ color: 'var(--success)' }}>Rs. {(summary.total_cash_sales_this_month || 0).toLocaleString()}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Credit Installments Received:</span>
                                    <span className="stat-value" style={{ color: 'var(--info)' }}>Rs. {summary.total_sales_collected_this_month.toLocaleString()}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Total Value Refunded (Returns):</span>
                                    <span className="stat-value" style={{ color: 'var(--danger)' }}>Rs. {summary.total_returns_this_month?.toLocaleString() || '0'}</span>
                                </div>
                                <div className="stat-row highlight">
                                    <span>New Credit Given This Month:</span>
                                    <span className="stat-value" style={{ color: 'var(--warning)' }}>Rs. {summary.total_credit_given_this_month.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Cash Sales by Salesman */}
                            <div className="premium-table-wrap" style={{ marginBottom: '20px' }}>
                                <h3 style={{ padding: '15px 20px', borderBottom: '1px solid var(--glass-border)', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Banknote size={16} color="#22c55e" /> Cash Collected (by Salesman)
                                </h3>
                                {activity_lists.cash_sales_by_salesman.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '2rem' }}>
                                        <p>No cash sales recorded this month.</p>
                                    </div>
                                ) : (
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Salesman / User</th>
                                                <th style={{ textAlign: 'center' }}>Bills</th>
                                                <th style={{ textAlign: 'right' }}>Cash Collected</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activity_lists.cash_sales_by_salesman.map(s => (
                                                <tr key={s.id}>
                                                    <td style={{ fontWeight: '500' }}>{s.salesman_name}</td>
                                                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{s.num_cash_bills}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '600' }}>+Rs. {s.total_cash_collected.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {/* Total row */}
                                            <tr style={{ borderTop: '2px solid var(--glass-border)', background: 'rgba(34,197,94,0.05)' }}>
                                                <td style={{ fontWeight: '700', color: 'var(--success)' }}>Total</td>
                                                <td style={{ textAlign: 'center', fontWeight: '700' }}>
                                                    {activity_lists.cash_sales_by_salesman.reduce((s, r) => s + r.num_cash_bills, 0)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '700' }}>
                                                    +Rs. {(summary.total_cash_sales_this_month || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* credit installments received */}
                            <div className="premium-table-wrap">
                                <h3 style={{ padding: '15px 20px', borderBottom: '1px solid var(--glass-border)', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Users size={16} color="#a78bfa" /> Credit Installments Received
                                </h3>
                                {activity_lists.credit_payments_received.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '2rem' }}>
                                        <p>No credit payments received this month.</p>
                                    </div>
                                ) : (
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Phone</th>
                                                <th style={{ textAlign: 'right' }}>Received</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activity_lists.credit_payments_received.map(b => (
                                                <tr key={b.id}>
                                                    <td>{b.name}</td>
                                                    <td>{b.phone}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--accent-primary)', fontWeight: '500' }}>+Rs. {b.amount_paid_this_month.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* OUTFLOW SIDE */}
                        <div className="ledger-section">
                            <h2 style={{ fontSize: '1.2rem', color: '#ef4444', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Truck size={20} /> Expenses & Payables
                            </h2>

                            <div className="premium-list-container" style={{ marginBottom: '24px', background: 'rgba(239, 68, 68, 0.02)' }}>
                                <div className="stat-row">
                                    <span>Total Purchase Invoices Made:</span>
                                    <span className="stat-value">Rs. {summary.total_purchases_created_value.toLocaleString()}</span>
                                </div>
                                <div className="stat-row">
                                    <span>Actual Cash Paid to Suppliers:</span>
                                    <span className="stat-value" style={{ color: 'var(--danger)' }}>Rs. {summary.total_purchases_paid_this_month.toLocaleString()}</span>
                                </div>
                                <div className="stat-row highlight">
                                    <span>Total Shop Expenses:</span>
                                    <span className="stat-value" style={{ color: 'var(--warning)' }}>Rs. {summary.total_expenses.toLocaleString()}</span>
                                </div>
                                <div className="stat-row highlight">
                                    <span>New Credit Taken This Month:</span>
                                    <span className="stat-value" style={{ color: 'var(--info)' }}>Rs. {summary.total_credit_taken_this_month.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Breakdown of Expenses */}
                            <div className="premium-list-container" style={{ marginBottom: '20px' }}>
                                <div className="premium-list-header">
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Expense Breakdown</h3>
                                </div>
                                {Object.keys(expense_breakdown).length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)' }}>No expenses recorded.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {Object.entries(expense_breakdown).map(([category, amount]) => (
                                            <div key={category} className="stat-row">
                                                <span>{category}</span>
                                                <span className="stat-value">Rs. {amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Payments to Suppliers */}
                            <div className="premium-table-wrap">
                                <h3 style={{ padding: '15px 20px', borderBottom: '1px solid var(--glass-border)', margin: 0, fontSize: '1rem' }}>Payments Made to Suppliers</h3>
                                {activity_lists.payments_made_to_suppliers.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '2rem' }}>
                                        <p>No payments to suppliers this month.</p>
                                    </div>
                                ) : (
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Supplier Name</th>
                                                <th style={{ textAlign: 'right' }}>Paid</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activity_lists.payments_made_to_suppliers.map(s => (
                                                <tr key={s.id}>
                                                    <td>{s.name}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: '500' }}>-Rs. {s.amount_paid_this_month.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* ===== COMPANY-WISE SUMMARY ===== */}
                    <div className="premium-table-wrap" style={{ marginTop: '30px' }}>
                        <h3 style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', margin: 0, fontSize: '1.1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Building2 size={20} /> Company-Wise Sales Summary (This Month)
                        </h3>
                        {company_wise_summary.length === 0 ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p>No sales recorded this month.</p>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Company Name</th>
                                        <th style={{ textAlign: 'center' }}>Transactions</th>
                                        <th style={{ textAlign: 'right' }}>Total Sales</th>
                                        <th style={{ textAlign: 'right' }}>Collected</th>
                                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {company_wise_summary.map((c, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: '600' }}>
                                                {c.company_name === 'Walk-in / No Company'
                                                    ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{c.company_name}</span>
                                                    : c.company_name
                                                }
                                            </td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{c.num_transactions}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '500' }}>Rs. {c.total_sales.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '500' }}>Rs. {c.total_collected.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', color: c.total_outstanding > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '600' }}>
                                                {c.total_outstanding > 0 ? `Rs. ${c.total_outstanding.toLocaleString()}` : '✓ Clear'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Grand total row */}
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--glass-border)', background: 'rgba(56,189,248,0.05)', fontWeight: '700' }}>
                                        <td>Grand Total</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {company_wise_summary.reduce((s, c) => s + c.num_transactions, 0)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            Rs. {company_wise_summary.reduce((s, c) => s + c.total_sales, 0).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>
                                            Rs. {company_wise_summary.reduce((s, c) => s + c.total_collected, 0).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>
                                            Rs. {company_wise_summary.reduce((s, c) => s + c.total_outstanding, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>

                    {/* Outdated / All Time Dues Section */}
                    <div className="premium-table-wrap" style={{ marginTop: '30px', borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                        <h3 style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', margin: 0, fontSize: '1.1rem', color: '#eab308' }}>
                            ⚠️ Action Required: Customers with Outstanding Dues (All-Time)
                        </h3>
                        {activity_lists.all_time_buyers_with_dues.length === 0 ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p style={{ color: 'var(--success)', fontWeight: '500' }}>Great! No pending dues from any customers.</p>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Customer Name</th>
                                        <th>Phone Number</th>
                                        <th style={{ textAlign: 'right' }}>Total Remaining Amount to Recover</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activity_lists.all_time_buyers_with_dues.map(b => (
                                        <tr key={b.id}>
                                            <td style={{ fontWeight: '500' }}>{b.name}</td>
                                            <td>
                                                <a href={`tel:${b.phone}`} style={{ color: 'var(--info)', textDecoration: 'none' }}>{b.phone}</a>
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: '600' }}>Rs. {b.remaining_due.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div> {/* End OVERVIEW MODE */}

                {/* DAILY SUMMARIES MODE */}
                {viewMode === 'daily_summary' && (
                    <div className="premium-table-wrap" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <h3 style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}>
                            Month Day-by-Day Breakdown
                        </h3>
                        {(!reportData.daily_breakdown || reportData.daily_breakdown.length === 0) ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p style={{ color: 'var(--text-muted)' }}>No activity recorded for this month.</p>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th style={{ textAlign: 'right' }}>Sales (#)</th>
                                        <th style={{ textAlign: 'right' }}>Total Sale Value</th>
                                        <th style={{ textAlign: 'right' }}>Actual Cash Received</th>
                                        <th style={{ textAlign: 'right' }}>New Credit Given</th>
                                        <th style={{ textAlign: 'right' }}>Returns Value</th>
                                        <th style={{ textAlign: 'right' }}>Expenses Logged</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.daily_breakdown.map((day, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ fontWeight: '600', padding: '16px 20px', color: 'var(--text-primary)' }}>
                                                {new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)', padding: '16px 20px' }}>{day.num_new_sales > 0 ? day.num_new_sales : '-'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '600', padding: '16px 20px', color: 'var(--info)' }}>
                                                {day.total_sales > 0 ? `Rs. ${day.total_sales.toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '600', padding: '16px 20px' }}>
                                                {day.cash_in > 0 ? `Rs. ${day.cash_in.toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', color: day.credit_given > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: '600', padding: '16px 20px' }}>
                                                {day.credit_given > 0 ? `Rs. ${day.credit_given.toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', color: day.returned_sales_value > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: '600', padding: '16px 20px' }}>
                                                {day.returned_sales_value > 0 ? `Rs. ${day.returned_sales_value.toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', color: day.expenses > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: '600', padding: '16px 20px' }}>
                                                {day.expenses > 0 ? `Rs. ${day.expenses.toLocaleString()}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot style={{ background: 'var(--bg-secondary)' }}>
                                    <tr style={{ fontWeight: '700' }}>
                                        <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>Total for Month</td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--text-primary)' }}>
                                            {reportData.daily_breakdown.reduce((sum, d) => sum + d.num_new_sales, 0)}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--info)' }}>
                                            Rs. {reportData.daily_breakdown.reduce((sum, d) => sum + d.total_sales, 0).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--success)' }}>
                                            Rs. {reportData.daily_breakdown.reduce((sum, d) => sum + d.cash_in, 0).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--warning)' }}>
                                            Rs. {reportData.daily_breakdown.reduce((sum, d) => sum + d.credit_given, 0).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--danger)' }}>
                                            Rs. {reportData.daily_breakdown.reduce((sum, d) => sum + (d.returned_sales_value || 0), 0).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--danger)' }}>
                                            Rs. {reportData.daily_breakdown.reduce((sum, d) => sum + d.expenses, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                )}

                {/* Advertisement Footer */}
            <div style={{ marginTop: '50px', paddingTop: '24px', borderTop: '2px solid var(--border-color)', textAlign: 'center', color: 'var(--text-primary)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.5px' }}>Software Developed by Hassan Ali Abrar</h3>
                <p style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Instagram: <strong style={{ color: 'var(--info)' }}>hassan.secure</strong> | WhatsApp: <strong style={{ color: 'var(--success)' }}>+92 348 5055098</strong></p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contact for custom software development, business automation, and IT solutions.</p>
            </div>
            
            </div> {/* End of reportRef wrapper */}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin { 100% { transform: rotate(360deg); } }
                
                /* Premium Glass Cards */
                .stat-card.flex-row { 
                    display: flex; align-items: center; gap: 20px; 
                    transition: transform 0.2s ease, box-shadow 0.2s ease; 
                }
                .stat-card.flex-row:hover { transform: translateY(-3px); box-shadow: 0 16px 32px rgba(0,0,0,0.12); }
                .stat-icon { display: flex; align-items: center; justify-content: center; width: 68px; height: 68px; border-radius: 16px; font-size: 1.5rem; flex-shrink: 0; }
                .stat-title { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
                .stat-value { font-size: 1.85rem; margin: 0; font-weight: 700; }
                
                /* Premium Tables */
                .data-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; }
                .data-table th { padding: 16px 20px; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--glass-border); background: rgba(0,0,0,0.02); }
                .data-table th:first-child { border-top-left-radius: 12px; }
                .data-table th:last-child { border-top-right-radius: 12px; }
                .data-table td { padding: 16px 20px; font-size: 0.95rem; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); transition: background 0.2s; }
                .data-table tbody tr:last-child td { border-bottom: none; }
                .data-table tbody tr:hover td { background: rgba(255, 255, 255, 0.03); }
                
                tfoot td { padding: 16px 20px; font-size: 0.95rem; font-weight: 700; background: rgba(0,0,0,0.02); }
                tfoot td:first-child { border-bottom-left-radius: 12px; }
                tfoot td:last-child { border-bottom-right-radius: 12px; }

                /* Hide border on glass-panel when tables are present for clean look */
                .table-container { border: 1px solid var(--glass-border); background: var(--bg-primary); }
                
                /* Select inputs modern styling */
                .page-header select:focus { background: rgba(255,255,255,0.05); }
                .minimal-select option { background: var(--bg-primary); color: var(--text-primary); }
            `}} />
        </div>
    );
};

export default MonthlyReport;
