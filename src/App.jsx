import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DeveloperDashboard from './pages/DeveloperDashboard';
import Products from './pages/Products';
import Buyers from './pages/Buyers';
import Suppliers from './pages/Suppliers';
import Billing from './pages/Billing';
import RecentSales from './pages/RecentSales';
import Expenses from './pages/Expenses';
import MonthlyReport from './pages/MonthlyReport';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
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
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
