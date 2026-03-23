import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import useKeepAlive from './hooks/useKeepAlive';

// Lazy‑loaded pages — each page becomes a separate JS chunk (code splitting)
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const DeveloperDashboard = lazy(() => import('./pages/DeveloperDashboard'));
const Products = lazy(() => import('./pages/Products'));
const Buyers = lazy(() => import('./pages/Buyers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Billing = lazy(() => import('./pages/Billing'));
const RecentSales = lazy(() => import('./pages/RecentSales'));
const Expenses = lazy(() => import('./pages/Expenses'));
const MonthlyReport = lazy(() => import('./pages/MonthlyReport'));
const Companies = lazy(() => import('./pages/Companies'));

// Lightweight loading fallback shown while a lazy chunk loads
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#0f172a',
    color: '#94a3b8',
    fontSize: '0.9rem',
    letterSpacing: '0.05em',
  }}>
    Loading…
  </div>
);

function App() {
  // Pings /api/health every 14 min to keep Render free tier warm
  useKeepAlive();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/developer-dashboard" element={<DeveloperDashboard />} />

          {/* Protected Routes Wrapper */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/products" replace />} />
              <Route path="products" element={<Products />} />
              <Route path="buyers" element={<Buyers />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="billing" element={<Billing />} />
              <Route path="sales" element={<RecentSales />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="monthly-report" element={<MonthlyReport />} />
              <Route path="companies" element={<Companies />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
