import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Truck, Edit, Trash2, Phone, Building, Package, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import './ExpandableSupplierCard.css';

const ExpandableSupplierCard = ({
    supplier,
    onEdit,
    onDelete
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate totals
    const transactions = supplier.supplier_transactions || [];
    const totalPurchases = transactions.reduce((sum, txn) => sum + Number(txn.total_amount || 0), 0);
    const totalPaid = transactions.reduce((sum, txn) => sum + Number(txn.paid_amount || 0), 0);
    const totalDue = totalPurchases - totalPaid;
    const hasDue = totalDue > 0;

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={`supplier-card ${hasDue ? 'has-due' : ''}`}>
            {/* Main Card Header */}
            <div className="supplier-card-header" onClick={toggleExpand}>
                <div className="supplier-info">
                    <div className="supplier-avatar">
                        <Truck size={20} />
                    </div>
                    <div className="supplier-details">
                        <h3 className="supplier-name">{supplier.name}</h3>
                        {supplier.company_name && (
                            <p className="supplier-company">{supplier.company_name}</p>
                        )}
                        {supplier.category && (
                            <span className="supplier-category-badge">{supplier.category}</span>
                        )}
                        {supplier.phone && (
                            <p className="supplier-phone">
                                <Phone size={16} />
                                {supplier.phone}
                            </p>
                        )}
                    </div>
                </div>

                <div className="supplier-summary">
                    <div className="summary-amount">
                        <span className={`amount ${hasDue ? 'due' : 'clear'}`}>
                            {hasDue ? `Rs. ${totalDue.toLocaleString()}` : '✓ Clear'}
                        </span>
                        <span className="total-label">Total: Rs. {totalPurchases.toLocaleString()}</span>
                    </div>
                    <div className="expand-icon">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="supplier-card-expanded">
                    {/* Summary Boxes */}
                    <div className="summary-boxes">
                        <div className="summary-box">
                            <div className="box-icon">
                                <Package size={16} />
                            </div>
                            <div className="box-content">
                                <span className="box-label">Purchases</span>
                                <span className="box-value">Rs. {totalPurchases.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="summary-box success">
                            <div className="box-icon">
                                <DollarSign size={16} />
                            </div>
                            <div className="box-content">
                                <span className="box-label">Paid</span>
                                <span className="box-value">Rs. {totalPaid.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className={`summary-box ${hasDue ? 'danger' : 'success'}`}>
                            <div className="box-icon">
                                {hasDue ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                            </div>
                            <div className="box-content">
                                <span className="box-label">Pending</span>
                                <span className="box-value">Rs. {totalDue.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="supplier-details-expanded">
                        <div className="detail-row">
                            <span className="detail-label">Phone:</span>
                            <span className="detail-value">{supplier.phone || 'N/A'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Company:</span>
                            <span className="detail-value">{supplier.company_name || 'N/A'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Category:</span>
                            <span className="detail-value">{supplier.category || 'N/A'}</span>
                        </div>
                    </div>

                    {/* Transaction History */}
                    {transactions.length > 0 && (
                        <div className="transaction-history">
                            <h4 className="history-title">📦 PURCHASE HISTORY</h4>
                            <div className="transactions-list">
                                {transactions.map((txn, idx) => {
                                    const isOpeningBalance = txn.products?.name === '__opening_balance__';
                                    const displayProductName = isOpeningBalance
                                        ? '💰 Opening Balance'
                                        : (txn.products?.name || `Product #${txn.product_id}`);
                                    const purchaseRate = txn.quantity > 0 ? Math.round(Number(txn.total_amount) / Number(txn.quantity)) : 0;
                                    const remaining = Number(txn.total_amount || 0) - Number(txn.paid_amount || 0);
                                    const isPaid = remaining <= 0;

                                    return (
                                        <div key={txn.id || idx} className="transaction-card">
                                            <div className="transaction-header">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span className="product-name">
                                                        {displayProductName}
                                                    </span>
                                                    {txn.payment_method && (
                                                        <span className={`payment-badge ${txn.payment_method.toLowerCase()}`}>
                                                            {txn.payment_method === 'Cash' ? '💵' : txn.payment_method === 'Online' ? '📱' : '🔀'}
                                                            {txn.payment_method}
                                                            {txn.payment_method === 'Split' && (
                                                                <span className="split-detail">C:{txn.cash_amount} | O:{txn.online_amount}</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`transaction-status ${isPaid ? 'paid' : 'due'}`}>
                                                    {isPaid ? '✓ Paid' : `Due: Rs. ${remaining.toLocaleString()}`}
                                                </span>
                                            </div>
                                            <div className="transaction-details">
                                                {!isOpeningBalance && (
                                                    <>
                                                        <div className="detail-cell">
                                                            <span className="cell-label">Qty</span>
                                                            <span className="cell-value">{txn.quantity}</span>
                                                        </div>
                                                        <div className="detail-cell">
                                                            <span className="cell-label">Rate/Unit</span>
                                                            <span className="cell-value">Rs. {purchaseRate.toLocaleString()}</span>
                                                        </div>
                                                    </>
                                                )}
                                                <div className="detail-cell">
                                                    <span className="cell-label">Total</span>
                                                    <span className="cell-value">Rs. {Number(txn.total_amount).toLocaleString()}</span>
                                                </div>
                                                <div className="detail-cell">
                                                    <span className="cell-label">Paid</span>
                                                    <span className="cell-value paid">Rs. {Number(txn.paid_amount).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="card-actions">
                        <button className="action-btn edit" onClick={() => onEdit(supplier)}>
                            <Edit size={16} />
                            <span>Edit</span>
                        </button>
                        <button className="action-btn delete" onClick={() => onDelete(supplier.id)}>
                            <Trash2 size={16} />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpandableSupplierCard;
