import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Search, DollarSign } from 'lucide-react';
import './Expenses.css'; // We'll create a generic css or reuse styles

const API_URL = '/api/expenses';

const Expenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentExpense, setCurrentExpense] = useState({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    const [searchTerm, setSearchTerm] = useState('');

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

                <div className="filter-group" style={{ display: 'flex', gap: '10px' }}>
                    <div className="month-filter">
                        <label style={{ color: 'var(--text-secondary)', marginRight: '10px', fontSize: '0.9rem' }}>Year:</label>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="form-input"
                            style={{ width: '100px', padding: '8px 12px', background: 'var(--bg-primary)' }}
                        >
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                        </select>
                    </div>

                    <div className="month-filter">
                        <label style={{ color: 'var(--text-secondary)', marginRight: '10px', fontSize: '0.9rem' }}>Month:</label>
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="form-input"
                            style={{ width: '130px', padding: '8px 12px', background: 'var(--bg-primary)' }}
                        >
                            <option value="01">January</option>
                            <option value="02">February</option>
                            <option value="03">March</option>
                            <option value="04">April</option>
                            <option value="05">May</option>
                            <option value="06">June</option>
                            <option value="07">July</option>
                            <option value="08">August</option>
                            <option value="09">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                        </select>
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={currentExpense.date}
                                        onChange={e => setCurrentExpense({ ...currentExpense, date: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Category</label>
                                    <select
                                        className="input-field minimal-select"
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
                            </div>

                            <div className="form-group">
                                <label>Amount (Rs)</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>Rs.</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={currentExpense.amount}
                                        onChange={e => setCurrentExpense({ ...currentExpense, amount: e.target.value })}
                                        required
                                        min="0"
                                        style={{ paddingLeft: '45px', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: '500' }}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description (Optional)</label>
                                <textarea
                                    className="form-input"
                                    style={{ minHeight: '80px', resize: 'vertical', background: 'var(--bg-primary)' }}
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
