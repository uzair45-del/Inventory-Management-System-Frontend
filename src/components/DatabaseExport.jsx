import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Trash2, AlertTriangle, Shield, Database, FileText, Lock, Eye, EyeOff, Clock, Archive } from 'lucide-react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { notifySuccess, notifyError } from '../utils/notifications';
import './DatabaseExport.css';

// Auto-lock after 3 minutes
const AUTO_LOCK_MS = 3 * 60 * 1000;

const DatabaseExport = () => {
    const location = useLocation();

    /* ── password-gate state ── */
    const [isUnlocked, setIsUnlocked]       = useState(false);
    const [enteredPassword, setEnteredPassword] = useState('');
    const [showEnteredPw, setShowEnteredPw] = useState(false);
    const [pwError, setPwError]             = useState('');
    const [pwLoading, setPwLoading]         = useState(false);
    const [timeLeft, setTimeLeft]           = useState(AUTO_LOCK_MS);

    /* ── export / clear state ── */
    const [isExporting, setIsExporting]         = useState(false);
    const [isClearing, setIsClearing]           = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [confirmCode, setConfirmCode]         = useState('');

    /* ── archive state ── */
    const [archiveTimeframe, setArchiveTimeframe] = useState('1_year');
    const [isArchiving, setIsArchiving]           = useState(false);
    const [isDeletingArchive, setIsDeletingArchive] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [archiveConfirmCode, setArchiveConfirmCode] = useState('');

    const lockTimer      = useRef(null);
    const countdownTimer = useRef(null);

    /* ── lock the page ── */
    const lockPage = useCallback(() => {
        setIsUnlocked(false);
        setEnteredPassword('');
        setPwError('');
        setTimeLeft(AUTO_LOCK_MS);
        clearTimeout(lockTimer.current);
        clearInterval(countdownTimer.current);
    }, []);

    /* ── start 3-min countdown after unlock ── */
    const startAutoLock = useCallback(() => {
        clearTimeout(lockTimer.current);
        clearInterval(countdownTimer.current);
        setTimeLeft(AUTO_LOCK_MS);

        lockTimer.current = setTimeout(() => lockPage(), AUTO_LOCK_MS);

        countdownTimer.current = setInterval(() => {
            setTimeLeft(prev => (prev <= 1000 ? 0 : prev - 1000));
        }, 1000);
    }, [lockPage]);

    /* ── lock whenever the route changes (navigates away) ── */
    useEffect(() => {
        lockPage();
    }, [location.pathname, lockPage]);

    /* ── cleanup on unmount ── */
    useEffect(() => {
        return () => {
            clearTimeout(lockTimer.current);
            clearInterval(countdownTimer.current);
        };
    }, []);

    /* ── handle password submit – verify via backend ── */
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!enteredPassword.trim()) return;

        setPwLoading(true);
        setPwError('');

        try {
            const token = localStorage.getItem('inventory_token');
            await axios.post(
                '/api/auth/verify-password',
                { password: enteredPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // If we reach here → password is correct
            setIsUnlocked(true);
            startAutoLock();
        } catch (err) {
            setPwError('Galat password! Dobara koshish karein.');
            setEnteredPassword('');
        } finally {
            setPwLoading(false);
        }
    };

    /* ── format countdown ── */
    const formatTime = (ms) => {
        const total = Math.ceil(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    /* ── export CSV ── */
    const handleExport = async () => {
        try {
            setIsExporting(true);
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get('/api/export/export-csv', {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `database_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            notifySuccess('Database exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            notifyError('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    /* ── clear all data ── */
    const handleClearData = async () => {
        try {
            setIsClearing(true);
            const token = localStorage.getItem('inventory_token');
            await axios.post(
                '/api/export/clear-data',
                { confirmCode: 'DELETE_MY_DATA' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            notifySuccess('All data cleared successfully!');
            setShowClearConfirm(false);
            setConfirmCode('');
            setTimeout(() => {
                localStorage.removeItem('inventory_token');
                localStorage.removeItem('user_info');
                window.location.href = '/login';
            }, 2000);
        } catch (error) {
            notifyError('Failed to clear data: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsClearing(false);
        }
    };

    /* ── archive / download JSON ── */
    const handleDownloadArchive = async () => {
        try {
            setIsArchiving(true);
            const token = localStorage.getItem('inventory_token');
            const response = await axios.get(`/api/export/download-archive?timeframe=${archiveTimeframe}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `archive_${archiveTimeframe}_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            notifySuccess('Archive generated and downloaded!');
        } catch (error) {
            console.error('Archive download error:', error);
            notifyError('Archive generation failed. Please try again.');
        } finally {
            setIsArchiving(false);
        }
    };

    /* ── archive delete ── */
    const handleDeleteArchive = async () => {
        try {
            setIsDeletingArchive(true);
            const token = localStorage.getItem('inventory_token');
            await axios.post(
                '/api/export/delete-archive',
                { timeframe: archiveTimeframe, confirmCode: 'DELETE_MY_DATA' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            notifySuccess('Archived data deleted successfully!');
            setShowArchiveConfirm(false);
            setArchiveConfirmCode('');
        } catch (error) {
            notifyError('Failed to delete archive: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsDeletingArchive(false);
        }
    };

    /* ══════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════ */
    return (
        <div className="db-export-wrapper">

            {/* ── blurred content (always in DOM, blurred when locked) ── */}
            <div
                className={`database-export-container ${!isUnlocked ? 'content-blurred' : ''}`}
                aria-hidden={!isUnlocked}
            >
                <div className="export-header">
                    <h2><Database size={24} /> Database Management</h2>
                    <p>Export your complete data or clear everything</p>
                </div>

                <div className="export-actions">
                    {/* Export Section */}
                    <div className="export-section">
                        <div className="action-card">
                            <div className="action-header">
                                <FileText size={32} className="icon-export" />
                                <div>
                                    <h3>Export Database</h3>
                                    <p>Download all your data as CSV file</p>
                                </div>
                            </div>
                            <div className="action-content">
                                <div className="data-preview">
                                    <h4>What will be exported:</h4>
                                    <ul>
                                        <li>📦 All Products</li>
                                        <li>💰 All Sales Records</li>
                                        <li>👥 All Buyers</li>
                                        <li>🏪 All Suppliers</li>
                                        <li>💸 All Expenses</li>
                                        <li>📋 All Purchases</li>
                                    </ul>
                                </div>
                                <button className="btn-export" onClick={handleExport} disabled={isExporting}>
                                    <Download size={20} />
                                    {isExporting ? 'Exporting...' : 'Download CSV'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Archive Section */}
                    <div className="archive-section" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                        <div className="action-card warning-card">
                            <div className="action-header">
                                <Archive size={32} className="icon-warning" style={{ color: '#f59e0b', background: '#fef3c7', padding: '8px', borderRadius: '8px' }} />
                                <div>
                                    <h3>Data Archive & Cleanup</h3>
                                    <p>Download and delete old records to free up space</p>
                                </div>
                            </div>
                            <div className="action-content">
                                <div className="archive-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontWeight: '500', color: '#475569' }}>Select Timeframe:</label>
                                    <select 
                                        value={archiveTimeframe} 
                                        onChange={(e) => setArchiveTimeframe(e.target.value)}
                                        className="archive-select"
                                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', flex: 1, color: '#1e293b' }}
                                    >
                                        <option value="1_month">Older than 1 Month</option>
                                        <option value="6_months">Older than 6 Months</option>
                                        <option value="1_year">Older than 1 Year</option>
                                        <option value="2_years">Older than 2 Years</option>
                                    </select>
                                </div>
                                <div className="data-preview archive-info">
                                    <h4>What gets archived/deleted:</h4>
                                    <ul>
                                        <li>📦 <b>Products</b> will <span style={{color: '#10b981', fontWeight: 'bold'}}>NEVER</span> be deleted.</li>
                                        <li>👥 <b>Customers & Suppliers</b> with outstanding balances will <span style={{color: '#10b981', fontWeight: 'bold'}}>NEVER</span> be deleted.</li>
                                        <li>🗑️ Only fully paid transactions, expenses, & returned sales will be archived.</li>
                                    </ul>
                                </div>
                                
                                <div className="archive-btn-group" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn-export" 
                                        onClick={handleDownloadArchive} 
                                        disabled={isArchiving}
                                        style={{ width: '100%', background: '#f59e0b', color: 'white', border: 'none' }}
                                    >
                                        <Download size={20} />
                                        {isArchiving ? 'Generating...' : 'Download JSON Archive'}
                                    </button>

                                    {!showArchiveConfirm ? (
                                        <button 
                                            className="btn-danger" 
                                            onClick={() => setShowArchiveConfirm(true)} 
                                            disabled={isDeletingArchive}
                                            style={{ width: '100%' }}
                                        >
                                            <Trash2 size={20} /> Delete Archived Data
                                        </button>
                                    ) : (
                                        <div className="confirm-box archive-confirm">
                                            <h4>Type "DELETE_MY_DATA" to confirm deletion of {archiveTimeframe.replace('_', ' ')} data:</h4>
                                            <input
                                                type="text"
                                                value={archiveConfirmCode}
                                                onChange={(e) => setArchiveConfirmCode(e.target.value)}
                                                placeholder="DELETE_MY_DATA"
                                                className="confirm-input"
                                            />
                                            <div className="confirm-buttons">
                                                <button
                                                    className="btn-cancel"
                                                    onClick={() => { setShowArchiveConfirm(false); setArchiveConfirmCode(''); }}
                                                    disabled={isDeletingArchive}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    className="btn-confirm-danger"
                                                    onClick={handleDeleteArchive}
                                                    disabled={isDeletingArchive || archiveConfirmCode !== 'DELETE_MY_DATA'}
                                                >
                                                    <Trash2 size={20} />
                                                    {isDeletingArchive ? 'Deleting...' : 'Confirm Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Clear Data Section */}
                    <div className="clear-section">
                        <div className="action-card danger">
                            <div className="action-header">
                                <AlertTriangle size={32} className="icon-danger" />
                                <div>
                                    <h3>Clear Database</h3>
                                    <p>Permanently delete all your data</p>
                                </div>
                            </div>
                            <div className="action-content">
                                <div className="warning-box">
                                    <Shield size={20} />
                                    <div>
                                        <h4>⚠️ WARNING: This action cannot be undone!</h4>
                                        <p>All your data will be permanently deleted:</p>
                                        <ul>
                                            <li>🗑️ All products and inventory</li>
                                            <li>🗑️ All sales and transaction history</li>
                                            <li>🗑️ All customer and supplier records</li>
                                            <li>🗑️ All expenses and purchases</li>
                                            <li>🗑️ All reports and analytics data</li>
                                        </ul>
                                    </div>
                                </div>

                                {!showClearConfirm ? (
                                    <button className="btn-danger" onClick={() => setShowClearConfirm(true)} disabled={isClearing}>
                                        <Trash2 size={20} /> Clear All Data
                                    </button>
                                ) : (
                                    <div className="confirm-box">
                                        <h4>Type "DELETE_MY_DATA" to confirm:</h4>
                                        <input
                                            type="text"
                                            value={confirmCode}
                                            onChange={(e) => setConfirmCode(e.target.value)}
                                            placeholder="DELETE_MY_DATA"
                                            className="confirm-input"
                                        />
                                        <div className="confirm-buttons">
                                            <button
                                                className="btn-cancel"
                                                onClick={() => { setShowClearConfirm(false); setConfirmCode(''); }}
                                                disabled={isClearing}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="btn-confirm-danger"
                                                onClick={handleClearData}
                                                disabled={isClearing || confirmCode !== 'DELETE_MY_DATA'}
                                            >
                                                <Trash2 size={20} />
                                                {isClearing ? 'Deleting...' : 'Delete Everything'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PASSWORD OVERLAY (shown when locked) ── */}
            {!isUnlocked && (
                <div className="pw-overlay" role="dialog" aria-modal="true" aria-label="Password required">
                    <div className="pw-card">
                        <div className="pw-icon-wrap">
                            <Lock size={36} />
                        </div>
                        <h2 className="pw-title">Protected Area</h2>
                        <p className="pw-subtitle">
                            This page is restricted to authorized users only.<br />
                            Enter your account login password to continue.
                        </p>

                        <form onSubmit={handlePasswordSubmit} className="pw-form">
                            <div className="pw-input-wrap">
                                <input
                                    type={showEnteredPw ? 'text' : 'password'}
                                    value={enteredPassword}
                                    onChange={(e) => { setEnteredPassword(e.target.value); setPwError(''); }}
                                    placeholder="Enter your login password..."
                                    className={`pw-input ${pwError ? 'pw-input-error' : ''}`}
                                    autoFocus
                                    disabled={pwLoading}
                                />
                                <button
                                    type="button"
                                    className="pw-eye-btn"
                                    onClick={() => setShowEnteredPw(v => !v)}
                                    tabIndex={-1}
                                    aria-label="Toggle password visibility"
                                >
                                    {showEnteredPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {pwError && <p className="pw-error">{pwError}</p>}

                            <button type="submit" className="pw-submit-btn" disabled={pwLoading || !enteredPassword.trim()}>
                                {pwLoading
                                    ? <><span className="pw-spinner" /> Verifying...</>
                                    : <><Lock size={16} /> Unlock Page</>
                                }
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── COUNTDOWN BADGE (shown after unlock) ── */}
            {isUnlocked && (
                <div className={`lock-countdown ${timeLeft <= 30000 ? 'countdown-warning' : ''}`}>
                    <Clock size={14} />
                    <span>Auto-lock: {formatTime(timeLeft)}</span>
                    <button className="lock-now-btn" onClick={lockPage}>Lock Now</button>
                </div>
            )}
        </div>
    );
};

export default DatabaseExport;
