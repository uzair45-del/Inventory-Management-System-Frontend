import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Search, DollarSign, X } from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';
import ProductSideList from '../components/ProductSideList';
import './Expenses.css'; // We'll create a generic css or reuse styles

const API_URL = '/api/expenses';

const Expenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentExpense, setCurrentExpense] = useState({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    const [searchTerm, setSearchTerm] = useState('');

    // Side List State
    const [isSideListOpen, setIsSideListOpen] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Separate state for Year and Month
    const currentYearStr = new Date().getFullYear().toString();
    const currentMonthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const [filterYear, setFilterYear] = useState(currentYearStr);
    const [filterMonth, setFilterMonth] = useState(currentMonthStr);

    // Auth token configuration
    const getConfig = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('inventory_token')}` }
    });

    useEffect(() => {
        fetchExpenses();
    }, [filterYear, filterMonth]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}?year=${filterYear}&month=${filterMonth}`, getConfig());
            setExpenses(response.data);
        } catch (error) {
            console.error('Failed to fetch expenses:', error);
            // Fallback to fetch all if filtering fails
            try {
                const response = await axios.get(API_URL, getConfig());
                setExpenses(response.data);
            } catch (e) {
                console.error('Fallback failed', e);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (expense = null) => {
        if (expense) {
            setCurrentExpense(expense);
        } else {
            setCurrentExpense({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentExpense({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentExpense.id) {
            // Check if expense with same description already exists in pending list
            if (isExpenseIdInPendingList(currentExpense.description || currentExpense.category)) {
                alert('This expense is already in pending list.');
                return;
            }
            
            // For new expenses, add to pending list instead of direct save
            const newItem = {
                action: 'add',
                name: currentExpense.description || currentExpense.category,
                data: currentExpense
            };
            
            setPendingItems(prev => [...prev, newItem]);
            setIsSideListOpen(true);
            handleCloseModal();
            return;
        }
        
        // For existing expenses (edit mode), keep the original logic
        try {
            await axios.put(`${API_URL}/${currentExpense.id}`, currentExpense, getConfig());
            fetchExpenses();
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save expense:', error);
            alert('Error saving expense');
        }
    };

    const handleDelete = async (id) => {
        const expense = expenses.find(e => e.id === id);
        if (!expense) return;
        
        // Check if expense is already in pending list
        if (isExpenseIdInPendingList(id)) {
            alert('This expense is already in pending list.');
            return;
        }
        
        if (!window.confirm(`Add "${expense.description || expense.category}" to pending deletions?`)) return;

        // Add to pending list instead of direct deletion
        const newItem = {
            action: 'delete',
            name: expense.description || expense.category,
            data: expense
        };
        
        setPendingItems(prev => [...prev, newItem]);
        setIsSideListOpen(true);
    };

    // Check if expense ID already exists in pending list
    const isExpenseIdInPendingList = (expenseId) => {
        return pendingItems.some(item => {
            if (item.action === 'add') {
                // For new items, check by description or category
                return item.name.toLowerCase().trim() === expenseId.toLowerCase().trim();
            } else if (item.action === 'delete') {
                // For deletions, check by actual ID
                return item.data.id === expenseId;
            }
            return false;
        });
    };

    // Side List Handlers
    const handleRemovePendingItem = (index) => {
        setPendingItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleClearAllPending = () => {
        if (window.confirm('Clear all pending changes?')) {
            setPendingItems([]);
        }
    };

    const handleProcessPendingItems = async () => {
        if (pendingItems.length === 0) return;
        
        if (!window.confirm(`Process ${pendingItems.length} pending changes? This cannot be undone.`)) {
            return;
        }

        setIsProcessing(true);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        try {
            // Process items in order
            for (const item of pendingItems) {
                try {
                    if (item.action === 'add') {
                        await axios.post(API_URL, item.data, getConfig());
                        successCount++;
                    } else if (item.action === 'delete') {
                        await axios.delete(`${API_URL}/${item.data.id}`, getConfig());
                        successCount++;
                    }
                } catch (err) {
                    errorCount++;
                    errors.push(`${item.action === 'add' ? 'Adding' : 'Deleting'} "${item.name}": ${err.response?.data?.error || err.message}`);
                }
            }

            // Show results
            if (errorCount > 0) {
                alert(`Processed ${successCount} items successfully. ${errorCount} items failed:\n\n${errors.join('\n')}`);
            } else {
                alert(`Successfully processed ${successCount} items!`);
            }

            // Clear pending items and refresh expenses
            setPendingItems([]);
            setIsSideListOpen(false);
            fetchExpenses();
        } catch (err) {
            console.error('Error processing pending items:', err);
            alert('An unexpected error occurred while processing items.');
        } finally {
            setIsProcessing(false);
        }
    };

    const { filteredExpenses, totalExpenses } = useMemo(() => {
        const filtered = expenses.filter(exp =>
            exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        const total = filtered.reduce((sum, exp) => sum + Number(exp.amount), 0);
        return { filteredExpenses: filtered, totalExpenses: total };
    }, [expenses, searchTerm]);

    return (
        <>
            <div className="expenses-container page-container fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Daily Expenses</h1>
                    <p className="page-subtitle">Track your shop's daily running costs</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    <Plus size={20} />
                    <span>Add Expense</span>
                </button>
            </header>

            <div className="filters-section glass-panel" style={{ position: 'relative', zIndex: 10 }}>
                <div className="search-box">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search expenses by category or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input input-field"
                        style={{ paddingLeft: '40px', background: 'rgba(255, 255, 255, 0.05)' }}
                    />
                </div>

                <div className="filter-group" style={{ display: 'flex', gap: '10px' }}>
                    <div className="month-filter">
                        <label style={{ color: 'var(--text-secondary)', marginRight: '10px', fontSize: '0.9rem' }}>Year:</label>
                        <CustomDropdown
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="minimal-select"
                            style={{ width: '100px', padding: '0px' }}
                            options={[
                                { value: '2024', label: '2024' },
                                { value: '2025', label: '2025' },
                                { value: '2026', label: '2026' },
                                { value: '2027', label: '2027' }
                            ]}
                        />
                    </div>

                    <div className="month-filter">
                        <label style={{ color: 'var(--text-secondary)', marginRight: '10px', fontSize: '0.9rem' }}>Month:</label>
                        <CustomDropdown
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="minimal-select"
                            style={{ width: '130px', padding: '0px' }}
                            options={[
                                { value: '01', label: 'January' },
                                { value: '02', label: 'February' },
                                { value: '03', label: 'March' },
                                { value: '04', label: 'April' },
                                { value: '05', label: 'May' },
                                { value: '06', label: 'June' },
                                { value: '07', label: 'July' },
                                { value: '08', label: 'August' },
                                { value: '09', label: 'September' },
                                { value: '10', label: 'October' },
                                { value: '11', label: 'November' },
                                { value: '12', label: 'December' }
                            ]}
                        />
                    </div>
                </div>
            </div>

            <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div className="summary-card glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div className="icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '15px', borderRadius: '12px' }}>
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '5px' }}>Total Expenses ({filterMonth}-{filterYear})</p>
                        <h3 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>Rs. {totalExpenses.toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            <div className="table-container glass-panel">
                {loading ? (
                    <div className="loading-state">Loading expenses...</div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="empty-state">
                        <DollarSign size={48} className="empty-icon" />
                        <h3>No expenses found</h3>
                        <p>No expenses logged for this period.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td>{new Date(expense.date).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`status-badge ${expense.category.toLowerCase().replace(' ', '-')}`} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '500' }}>
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td>{expense.description || '-'}</td>
                                    <td style={{ fontWeight: '500', color: '#ef4444' }}>Rs. {Number(expense.amount).toLocaleString()}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="icon-btn-small text-accent" onClick={() => handleOpenModal(expense)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="icon-btn-small text-danger" onClick={() => handleDelete(expense.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '450px' }}>
                        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{currentExpense.id ? 'Edit Expense' : 'Add Expense'}</h2>
                            <button type="button" className="icon-btn-small" style={{ color: 'var(--text-muted)' }} onClick={handleCloseModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Date</label>
                                        <input
                                            type="date"
                                            className="input-field"
                                            style={{ width: '100%' }}
                                            value={currentExpense.date}
                                            onChange={e => setCurrentExpense({ ...currentExpense, date: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Category</label>
                                        <CustomDropdown
                                            className="minimal-select"
                                            style={{ width: '100%' }}
                                            value={currentExpense.category}
                                            onChange={e => setCurrentExpense({ ...currentExpense, category: e.target.value })}
                                            options={[
                                                { value: 'Petrol', label: 'Petrol' },
                                                { value: 'Electric Bill', label: 'Electric Bill' },
                                                { value: 'Food', label: 'Food / Meals' },
                                                { value: 'Rent', label: 'Shop Rent' },
                                                { value: 'Maintenance', label: 'Maintenance' },
                                                { value: 'Other', label: 'Other' }
                                            ]}
                                        />
                                    </div>
                                </div>

                                <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Amount (Rs)</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 500 }}>Rs.</span>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={currentExpense.amount}
                                            onChange={e => setCurrentExpense({ ...currentExpense, amount: e.target.value })}
                                            required
                                            min="0"
                                            style={{ paddingLeft: '48px', fontSize: '1.05rem', fontWeight: '600', width: '100%' }}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Description (Optional)</label>
                                    <textarea
                                        className="input-field"
                                        style={{ minHeight: '90px', resize: 'vertical', paddingTop: '12px', width: '100%' }}
                                        value={currentExpense.description}
                                        onChange={e => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                                        placeholder="e.g. Bought petrol for bike"
                                    />
                                </div>
                            </div>

                            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-secondary)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                                <button type="button" onClick={handleCloseModal} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" style={{ padding: '10px 24px', fontWeight: 600 }}>
                                    {currentExpense.id ? 'Update Expense' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>

            {/* Expense Side List */}
            <ProductSideList
                isOpen={isSideListOpen}
                onClose={() => setIsSideListOpen(false)}
                pendingItems={pendingItems}
                onRemoveItem={handleRemovePendingItem}
                onClearAll={handleClearAllPending}
                onProcessItems={handleProcessPendingItems}
                isProcessing={isProcessing}
                entityType="expense"
            />
        </>
    );
};

export default Expenses;
