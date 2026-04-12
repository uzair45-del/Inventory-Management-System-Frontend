import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { Mail, Lock, LogIn, LayoutDashboard } from 'lucide-react';
import './Login.css';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [loginType, setLoginType] = useState('salesman'); // 'salesman' or 'developer'

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (email && password) {
            setLoading(true);
            try {
                const endpoint = loginType === 'developer'
                    ? '/api/auth/login-developer'
                    : '/api/auth/login-salesman';

                console.log(`Sending login request to ${endpoint}...`, { email: email });
                const response = await api.post(endpoint, { email, password });
                console.log('Login response:', response.data);

                // Backend returns: { _id, name, email, role, token }
                const { token, ...userData } = response.data;

                if (token) {
                    // Store actual token and user info
                    localStorage.setItem('inventory_token', token);
                    localStorage.setItem('inventory_user', JSON.stringify({
                        id: userData.id || userData._id,
                        name: userData.name,
                        email: userData.email,
                        role: userData.role
                    }));

                    // Redirect based on role
                    if (userData.role === 'developer') {
                        navigate('/developer-dashboard', { replace: true });
                    } else {
                        navigate('/products', { replace: true });
                    }
                } else {
                    throw new Error('No token received');
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="login-container">
            {/* Background Glow Effects */}
            <div className="glow-orb top-left"></div>
            <div className="glow-orb bottom-right"></div>

            <div className="login-box glass-panel animate-fade-in">
                <div className="login-header">
                    <div className="login-logo">
                        <LayoutDashboard size={36} color="var(--accent-primary)" />
                    </div>
                    <h1 className="login-title">Welcome Back</h1>
                    <p className="login-subtitle">Sign in to your account</p>
                </div>

                <div className="role-selector">
                    <button
                        className={`role-tab ${loginType === 'salesman' ? 'active' : ''}`}
                        onClick={() => setLoginType('salesman')}
                        type="button"
                    >
                        Salesman
                    </button>
                    <button
                        className={`role-tab ${loginType === 'developer' ? 'active' : ''}`}
                        onClick={() => setLoginType('developer')}
                        type="button"
                    >
                        Developer
                    </button>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && <div className="error-message">{error}</div>}
                    <div className="input-group">
                        <label>Email Address</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                className="input-field with-icon"
                                placeholder={loginType === 'developer' ? "developer@inventorypro.com" : "sales@inventorypro.com"}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                className="input-field with-icon"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="login-actions">
                        <label className="checkbox-wrapper">
                            <input type="checkbox" />
                            <span className="checkbox-custom"></span>
                            Remember me
                        </label>
                        <a href="#" className="forgot-password">Forgot Password?</a>
                    </div>

                    <button type="submit" className="btn-primary login-btn" disabled={loading}>
                        <span>{loading ? 'Signing in...' : `Sign In as ${loginType === 'developer' ? 'Developer' : 'Salesman'}`}</span>
                        {!loading && <LogIn size={20} />}
                    </button>

                    <p className="signup-redirect">
                        Don't have an account? <Link to="/signup">Sign Up</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Login;
