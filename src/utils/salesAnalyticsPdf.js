import html2pdf from 'html2pdf.js';
import { notifyError } from './notifications';

function escapeHtml(s) {
    if (s == null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const formatProductId = (id) => {
    if (!id) return '';
    return String(id).toUpperCase();
};

/**
 * Roll up sales by product: qty, revenue, cost (purchase_rate × qty), profit.
 */
export function computeSalesAnalytics(sales) {
    const byProduct = new Map();

    for (const s of sales) {
        const pid = s.product_id;
        const name = s.products?.name || `Product #${pid}`;
        const qty = Number(s.quantity || 0);
        const rev = Number(s.total_amount || 0);
        const rate = Number(s.products?.purchase_rate ?? 0);
        const cost = rate * qty;
        const profit = rev - cost;

        if (!byProduct.has(pid)) {
            byProduct.set(pid, {
                productId: pid,
                name,
                totalQty: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalProfit: 0,
                saleCount: 0,
            });
        }
        const a = byProduct.get(pid);
        a.totalQty += qty;
        a.totalRevenue += rev;
        a.totalCost += cost;
        a.totalProfit += profit;
        a.saleCount += 1;
    }

    const rows = Array.from(byProduct.values());
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const totalPaid = sales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const totalPending = totalRevenue - totalPaid;

    if (rows.length === 0) {
        return {
            rows: [],
            totalRevenue,
            totalPaid,
            totalPending,
            transactionCount: sales.length,
        };
    }

    const byQty = [...rows].sort((a, b) => b.totalQty - a.totalQty);
    const byProfit = [...rows].sort((a, b) => b.totalProfit - a.totalProfit);
    const byRev = [...rows].sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
        rows,
        totalRevenue,
        totalPaid,
        totalPending,
        transactionCount: sales.length,
        topByQty: byQty[0],
        lowestByQty: byQty[byQty.length - 1],
        topByProfit: byProfit[0],
        lowestByProfit: byProfit[byProfit.length - 1],
        topByRevenue: byRev[0],
        lowestByRevenue: byRev[byRev.length - 1],
    };
}

function insightRow(label, valueHtml) {
    return `
        <tr>
            <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;color:#334155;width:42%;">${escapeHtml(label)}</td>
            <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#0f172a;">${valueHtml}</td>
        </tr>`;
}

function buildInnerHtml(sales, analytics, periodLabel) {
    const gen = new Date().toLocaleString('en-GB');
    const {
        rows,
        totalRevenue,
        totalPaid,
        totalPending,
        transactionCount,
        topByQty,
        lowestByQty,
        topByProfit,
        lowestByProfit,
        topByRevenue,
        lowestByRevenue,
    } = analytics;

    const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

    let insightsBody = '';
    if (rows.length > 0) {
        insightsBody =
            insightRow(
                'Most units sold',
                `<strong>${escapeHtml(topByQty.name)}</strong> — ${topByQty.totalQty} pcs &middot; ${fmtRs(topByQty.totalRevenue)} revenue`
            ) +
            insightRow(
                'Lowest selling (by quantity)',
                `<strong>${escapeHtml(lowestByQty.name)}</strong> — ${lowestByQty.totalQty} pcs &middot; ${fmtRs(lowestByQty.totalRevenue)} revenue`
            ) +
            insightRow(
                'Highest total profit',
                `<strong>${escapeHtml(topByProfit.name)}</strong> — ${fmtRs(topByProfit.totalProfit)} profit &middot; cost ${fmtRs(topByProfit.totalCost)}`
            ) +
            insightRow(
                'Lowest total profit',
                `<strong>${escapeHtml(lowestByProfit.name)}</strong> — ${fmtRs(lowestByProfit.totalProfit)} profit &middot; cost ${fmtRs(lowestByProfit.totalCost)}`
            ) +
            insightRow(
                'Highest revenue (product)',
                `<strong>${escapeHtml(topByRevenue.name)}</strong> — ${fmtRs(topByRevenue.totalRevenue)}`
            ) +
            insightRow(
                'Lowest revenue (product)',
                `<strong>${escapeHtml(lowestByRevenue.name)}</strong> — ${fmtRs(lowestByRevenue.totalRevenue)}`
            );
    } else {
        insightsBody = `<tr><td colspan="2" style="padding:16px;text-align:center;color:#64748b;">No product-level data for this period.</td></tr>`;
    }

    const productRows = rows
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .map((r) => {
            return `<tr>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(r.name)} <span style="color:#64748b;font-size:11px;">(${escapeHtml(formatProductId(r.productId))})</span></td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${r.totalQty}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(r.totalRevenue)}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(r.totalCost)}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:${r.totalProfit >= 0 ? '#15803d' : '#b91c1c'};">${fmtRs(r.totalProfit)}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">${r.saleCount}</td>
            </tr>`;
        })
        .join('');

    const detailRows = sales
        .map((sale, idx) => {
            const pending = Number(sale.total_amount || 0) - Number(sale.paid_amount || 0);
            const rate = Number(sale.products?.purchase_rate ?? 0);
            const qty = Number(sale.quantity || 0);
            const lineProfit = Number(sale.total_amount || 0) - rate * qty;
            return `<tr>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${idx + 1}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">#${sale.id}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${sale.purchase_date ? escapeHtml(new Date(sale.purchase_date).toLocaleDateString('en-GB')) : '—'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(sale.products?.name || '—')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:10px;">${escapeHtml(sale.buyers?.name || 'Walk-in')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${qty}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(sale.total_amount)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(sale.paid_amount)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${pending > 0 ? fmtRs(pending) : '—'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:11px;">${fmtRs(lineProfit)}</td>
            </tr>`;
        })
        .join('');

    return `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
            <h1 style="margin:0 0 6px;font-size:22px;color:#1e3a8a;text-align:center;">Sales analytics report</h1>
            <p style="margin:0 0 4px;text-align:center;font-size:13px;color:#475569;">Period: <strong>${escapeHtml(periodLabel)}</strong></p>
            <p style="margin:0 0 18px;text-align:center;font-size:11px;color:#64748b;">Generated ${escapeHtml(gen)}</p>

            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:18px;justify-content:center;">
                <div style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;border-top:3px solid #22c55e;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">TOTAL REVENUE</div>
                    <div style="font-size:18px;font-weight:700;color:#15803d;">${fmtRs(totalRevenue)}</div>
                </div>
                <div style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;border-top:3px solid #8b5cf6;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">TOTAL PAID</div>
                    <div style="font-size:18px;font-weight:700;color:#6d28d9;">${fmtRs(totalPaid)}</div>
                </div>
                <div style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;border-top:3px solid #ef4444;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">PENDING (CREDIT)</div>
                    <div style="font-size:18px;font-weight:700;color:#b91c1c;">${fmtRs(totalPending)}</div>
                </div>
                <div style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;border-top:3px solid #3b82f6;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">TRANSACTIONS</div>
                    <div style="font-size:18px;font-weight:700;color:#1d4ed8;">${transactionCount}</div>
                </div>
            </div>

            <h2 style="font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:20px 0 10px;">Product insights</h2>
            <p style="font-size:11px;color:#64748b;margin:-4px 0 10px;">Profit = sale amount − (purchase rate × qty). Uses current product purchase rate.</p>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:22px;">${insightsBody}</table>

            <h2 style="font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:20px 0 10px;">Summary by product</h2>
            <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:22px;">
                <thead>
                    <tr style="background:#1e3a8a;color:#fff;">
                        <th style="padding:8px;text-align:left;">Product</th>
                        <th style="padding:8px;text-align:right;">Qty sold</th>
                        <th style="padding:8px;text-align:right;">Revenue</th>
                        <th style="padding:8px;text-align:right;">Est. cost</th>
                        <th style="padding:8px;text-align:right;">Profit</th>
                        <th style="padding:8px;text-align:center;">Bills</th>
                    </tr>
                </thead>
                <tbody>${productRows || '<tr><td colspan="6" style="padding:12px;text-align:center;">—</td></tr>'}</tbody>
            </table>

            <h2 style="font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:20px 0 10px;">All transactions</h2>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead>
                    <tr style="background:#1e3a8a;color:#fff;">
                        <th style="padding:6px;">#</th>
                        <th style="padding:6px;">Inv</th>
                        <th style="padding:6px;">Date</th>
                        <th style="padding:6px;">Product</th>
                        <th style="padding:6px;">Customer</th>
                        <th style="padding:6px;text-align:right;">Qty</th>
                        <th style="padding:6px;text-align:right;">Total</th>
                        <th style="padding:6px;text-align:right;">Paid</th>
                        <th style="padding:6px;text-align:right;">Due</th>
                        <th style="padding:6px;text-align:right;">Line profit</th>
                    </tr>
                </thead>
                <tbody>${detailRows || '<tr><td colspan="10" style="padding:12px;text-align:center;">—</td></tr>'}</tbody>
            </table>

            <div style="margin-top:36px;padding-top:18px;border-top:2px solid #e2e8f0;text-align:center;page-break-inside:avoid;">
                <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a;letter-spacing:0.3px;">Software Developed by Hassan Ali Abrar</h3>
                <p style="margin:0 0 6px;font-size:11px;color:#475569;">
                    Instagram: <strong style="color:#7c3aed;">hassan.secure</strong>
                    <span style="margin:0 10px;color:#cbd5e1;">|</span>
                    WhatsApp: <strong style="color:#059669;">+92 348 5055098</strong>
                </p>
                <p style="margin:0;font-size:10px;color:#64748b;">Contact for custom software development &amp; business automation</p>
                <p style="margin:10px 0 0;font-size:10px;color:#94a3b8;">Inventory Pro — Sales report</p>
            </div>
        </div>
    `;
}

/**
 * PDF for currently filtered sales (same rows as on screen).
 * html2canvas often returns a blank image for off-screen nodes; we render the
 * report in a fixed, visible panel (like Billing’s receipt) then capture it.
 */
export async function downloadSalesAnalyticsPdf(filteredSales, periodLabel, activeFilterKey) {
    if (!filteredSales?.length) {
        notifyError('No sales to export for this filter.');
        return;
    }

    const analytics = computeSalesAnalytics(filteredSales);

    const overlay = document.createElement('div');
    overlay.setAttribute('data-sales-pdf-overlay', '1');
    overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483646',
        'background:rgba(15,23,42,0.55)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:20px',
        'box-sizing:border-box',
    ].join(';');

    const stack = document.createElement('div');
    stack.style.cssText = [
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'gap:14px',
        'width:100%',
        'max-width:1040px',
        'max-height:92vh',
    ].join(';');

    const status = document.createElement('p');
    status.style.cssText =
        'color:#f8fafc;margin:0;font-family:system-ui,Segoe UI,sans-serif;font-size:14px;font-weight:600;';
    status.textContent = 'Generating PDF…';

    const root = document.createElement('div');
    root.setAttribute('data-sales-pdf', '1');
    root.style.cssText = [
        'width:1000px',
        'max-width:100%',
        'max-height:calc(92vh - 52px)',
        'overflow:auto',
        'background:#ffffff',
        'color:#0f172a',
        'padding:24px',
        'border-radius:12px',
        'box-shadow:0 25px 80px rgba(0,0,0,0.35)',
        'box-sizing:border-box',
        '-webkit-font-smoothing:antialiased',
    ].join(';');
    root.innerHTML = buildInnerHtml(filteredSales, analytics, periodLabel);

    stack.appendChild(status);
    stack.appendChild(root);
    overlay.appendChild(stack);
    document.body.appendChild(overlay);

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 150));

    /* Let full document height paint; scrollable max-height would clip html2canvas */
    const prevMaxHeight = root.style.maxHeight;
    const prevOverflow = root.style.overflow;
    root.style.maxHeight = 'none';
    root.style.overflow = 'visible';
    await new Promise((r) => setTimeout(r, 50));

    const heightPx = Math.max(root.scrollHeight, 400);
    const heightMm = heightPx * 0.264583;
    
    // Generate random filename for security
    const randomId = Math.random().toString(36).substring(2, 15); // Random string
    const timestamp = new Date().toISOString().slice(0, 10); // Date part
    const safeFilename = `Report_${timestamp}_${randomId}.pdf`;

    const opt = {
        margin: [10, 10, 10, 10],
        filename: safeFilename,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: Math.max(root.scrollWidth, 960),
        },
        jsPDF: {
            unit: 'mm',
            format: [210, Math.min(heightMm + 40, 15000)],
            orientation: 'portrait',
        },
        pagebreak: { mode: ['css', 'legacy'] },
    };

    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sales PDF</title></head><body style="margin:0;font-family:sans-serif;"><p style="text-align:center;margin-top:22vh;color:#334155;">Opening sales PDF…</p></body></html>'
        );
    }

    try {
        const pdfUrl = await html2pdf()
            .set(opt)
            .from(root)
            .toPdf()
            .get('pdf')
            .then((pdf) => pdf.output('bloburl'));
        if (newWindow) {
            newWindow.location.href = pdfUrl;
        } else {
            window.open(pdfUrl, '_blank');
        }
    } catch (e) {
        console.error('salesAnalyticsPdf', e);
        if (newWindow) newWindow.close();
        throw e;
    } finally {
        root.style.maxHeight = prevMaxHeight;
        root.style.overflow = prevOverflow;
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}
