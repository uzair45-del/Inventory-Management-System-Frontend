import { useState, useEffect } from 'react';
import { Store, MapPin, Phone, Save, RotateCcw, CheckCircle } from 'lucide-react';
import { useShopSettings, saveShopSettings, DEFAULT_SHOP } from '../utils/useShopSettings';
import './ShopSettings.css';

export default function ShopSettings() {
    const currentShop = useShopSettings();
    const [form, setForm] = useState({ name: '', address: '', phone: '' });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setForm({ ...currentShop });
    }, [currentShop.name, currentShop.address, currentShop.phone]);

    const handleSave = () => {
        saveShopSettings(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const handleReset = () => {
        setForm({ ...DEFAULT_SHOP });
        saveShopSettings(DEFAULT_SHOP);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div className="shop-settings-container">
            <div className="panel-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Store size={26} style={{ color: 'var(--accent-primary)' }} />
                    Shop Settings
                </h1>
                <p className="page-subtitle">
                    This information appears on all bills, invoices, and reports.
                </p>
            </div>

            <div className="shop-settings-grid">
                {/* Left: Form */}
                <div className="glass-panel shop-form-panel">
                    <h3 className="section-title" style={{ marginBottom: '24px' }}>Store Information</h3>

                    <div className="shop-field-group">
                        <label className="shop-label">
                            <Store size={15} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
                            Shop / Store Name
                        </label>
                        <input
                            id="shop-name-input"
                            className="shop-input"
                            placeholder="e.g. Jellani Hardware Store"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                    </div>

                    <div className="shop-field-group">
                        <label className="shop-label">
                            <MapPin size={15} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
                            Shop Address
                        </label>
                        <textarea
                            id="shop-address-input"
                            className="shop-input shop-textarea"
                            placeholder="e.g. Main Kallar Syedan Road, Near DHA Phase 7"
                            value={form.address}
                            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            rows={3}
                        />
                    </div>

                    <div className="shop-field-group">
                        <label className="shop-label">
                            <Phone size={15} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
                            Phone Number
                        </label>
                        <input
                            id="shop-phone-input"
                            className="shop-input"
                            placeholder="e.g. 0329-5749291"
                            value={form.phone}
                            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                        <button
                            id="save-shop-settings-btn"
                            className={`btn-primary flex-1 ${saved ? 'saved-pulse' : ''}`}
                            onClick={handleSave}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 24px' }}
                        >
                            {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                            {saved ? 'Saved!' : 'Save Settings'}
                        </button>
                        <button
                            id="reset-shop-settings-btn"
                            className="btn-secondary"
                            onClick={handleReset}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
                            title="Reset to default"
                        >
                            <RotateCcw size={16} /> Reset
                        </button>
                    </div>
                </div>

                {/* Right: Live Receipt Preview */}
                <div className="glass-panel shop-preview-panel">
                    <h3 className="section-title" style={{ marginBottom: '20px' }}>Live Receipt Preview</h3>
                    <div className="receipt-preview-box">
                        <div className="preview-logo">🧮</div>
                        <h2 className="preview-shop-name">{form.name || 'My Store'}</h2>
                        <p className="preview-address">{form.address || 'Shop Address'}</p>
                        <p className="preview-phone">Ph: {form.phone || '0300-0000000'}</p>
                        <div className="preview-badge">TAX INVOICE</div>
                        <div className="preview-divider" />
                        <div className="preview-row"><span>Customer:</span><span>Walk-in Customer</span></div>
                        <div className="preview-row"><span>Date:</span><span>{new Date().toLocaleDateString()}</span></div>
                        <div className="preview-row"><span>Invoice #:</span><span>INV-001234</span></div>
                        <div className="preview-divider" />
                        <div className="preview-row" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            <span>Total</span><span>Rs. 5,000</span>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
                        Changes reflect instantly on all new bills and PDFs
                    </p>
                </div>
            </div>
        </div>
    );
}
