import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Search, DollarSign } from 'lucide-react';
import './Expenses.css'; // We'll create a generic css or reuse styles

const API_URL = import.meta.env.VITE_API_URL + '/expenses';

const Expenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentExpense, setCurrentExpense] = useState({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Auth token configuration
    const getConfig = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem('inventory_token')}` }
    });

    useEffect(() => {
        fetchExpenses();
    }, [filterMonth]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const [year, month] = filterMonth.split('-');
            const response = await axios.get(`${API_URL}?year=${year}&month=${month}`, getConfig());
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
        try {
            if (currentExpense.id) {
                await axios.put(`${API_URL}/${currentExpense.id}`, currentExpense, getConfig());
            } else {
                await axios.post(API_URL, currentExpense, getConfig());
            }
            fetchExpenses();
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save expense:', error);
            alert('Error saving expense');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await axios.delete(`${API_URL}/${id}`, getConfig());
                fetchExpenses();
            } catch (error) {
                console.error('Failed to delete expense:', error);
            }
        }
    };

    const filteredExpenses = expenses.filter(exp =>
        exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    return (
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

            <div className="filters-section glass-panel">
                <div className="search-box">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search expenses by category or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="month-filter">
                    <label style={{ color: 'var(--text-secondary)', marginRight: '10px' }}>Filter Month:</label>
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="form-input"
                        style={{ width: 'auto' }}
                    />
                </div>
            </div>

            <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div className="summary-card glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div className="icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '15px', borderRadius: '12px' }}>
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '5px' }}>Total Expenses ({filterMonth})</p>
                        <h3 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>Rs. {totalExpenses.toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            <div className="table-container glass-panel">
                {loading ? (
                    <div className="loading-spinner" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading expenses...</div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No expenses found for this month.</div>
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
                                        <span className={`status-badge ${expense.category.toLowerCase().replace(' ', '-')}`} style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '4px 8px', borderRadius: '20px', fontSize: '0.85rem' }}>
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td>{expense.description || '-'}</td>
                                    <td style={{ fontWeight: '500', color: '#ef4444' }}>Rs. {Number(expense.amount).toLocaleString()}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-icon edit" onClick={() => handleOpenModal(expense)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn-icon delete" onClick={() => handleDelete(expense.id)}>
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
                    <div className="modal-content glass-panel fade-in" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{currentExpense.id ? 'Edit Expense' : 'Add Expense'}</h2>
                            <button className="close-btn" onClick={handleCloseModal}>&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={currentExpense.date}
                                    onChange={e => setCurrentExpense({ ...currentExpense, date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    className="form-input"
                                    value={currentExpense.category}
                                    onChange={e => setCurrentExpense({ ...currentExpense, category: e.target.value })}
                                    required
                                >
                                    <option value="Petrol">Petrol</option>
                                    <option value="Electric Bill">Electric Bill</option>
                                    <option value="Food">Food / Meals</option>
                                    <option value="Rent">Shop Rent</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Amount (Rs)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={currentExpense.amount}
                                    onChange={e => setCurrentExpense({ ...currentExpense, amount: e.target.value })}
                                    required
                                    min="0"
                                />
                            </div>

                            <div className="form-group">
                                <label>Description (Optional)</label>
                                <textarea
                                    className="form-input"
                                    style={{ minHeight: '80px', resize: 'vertical' }}
                                    value={currentExpense.description}
                                    onChange={e => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                                    placeholder="e.g. Bought petrol for bike"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                <button type="submit" className="btn-primary">
                                    {currentExpense.id ? 'Update Expense' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
