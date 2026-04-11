import { useState, useEffect } from 'react';

export const DEFAULT_SHOP = {
    name: 'My Store',
    address: 'City, Pakistan',
    phone: '0300-0000000',
};

export function useShopSettings() {
    const [shop, setShop] = useState(() => {
        try {
            const stored = localStorage.getItem('shop_settings');
            return stored ? { ...DEFAULT_SHOP, ...JSON.parse(stored) } : DEFAULT_SHOP;
        } catch {
            return DEFAULT_SHOP;
        }
    });

    useEffect(() => {
        const handler = () => {
            try {
                const stored = localStorage.getItem('shop_settings');
                setShop(stored ? { ...DEFAULT_SHOP, ...JSON.parse(stored) } : DEFAULT_SHOP);
            } catch {
                setShop(DEFAULT_SHOP);
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    return shop;
}

export function saveShopSettings(settings) {
    localStorage.setItem('shop_settings', JSON.stringify(settings));
    // Fire storage event so other components update reactively
    window.dispatchEvent(new Event('storage'));
}
