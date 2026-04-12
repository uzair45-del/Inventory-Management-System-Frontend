import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { User, Mail, Lock, UserPlus, LayoutDashboard, ShieldAlert } from 'lucide-react';
import './Signup.css';

const Signup = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [devExists, setDevExists] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkDeveloper = async () => {
            try {
                const response = await api.get('/api/auth/check-developer');
                setDevExists(response.data.exists);
            } catch {
                setDevExists(false);
            } finally {
                setChecking(false);
            }
        };
        checkDeveloper();
    }, []);

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/api/auth/signup', {
                name,
                email,
                password
            });

            const { token, ...userData } = response.data;

            if (token) {
                localStorage.setItem('inventory_token', token);
                localStorage.setItem('inventory_user', JSON.stringify({
                    id: userData.id || userData._id,
                    name: userData.name,
                    email: userData.email,
                    role: userData.role
                }));

                navigate('/developer-dashboard', { replace: true });
            } else {
                throw new Error('No token received');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className="signup-container">
                <div className="glow-orb top-left"></div>
                <div className="glow-orb bottom-right"></div>
                <div className="signup-box glass-panel animate-fade-in">
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Checking system status...</p>
                </div>
            </div>
        );
    }

    if (devExists) {
        return (
            <div className="signup-container">
                <div className="glow-orb top-left"></div>
                <div className="glow-orb bottom-right"></div>
                <div className="signup-box glass-panel animate-fade-in">
                    <div className="signup-header">
                        <div className="signup-logo" style={{ background: 'rgba(239, 68, 68, 0.1)', boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.2), 0 8px 16px rgba(239, 68, 68, 0.2)' }}>
                            <ShieldAlert size={36} color="#ef4444" />
                        </div>
                        <h1 className="signup-title">Access Restricted</h1>
                        <p className="signup-subtitle">A developer account already exists. Only one developer is allowed in the system.</p>
                    </div>
                    <Link to="/login" className="btn-primary signup-btn" style={{ textDecoration: 'none' }}>
                        <span>Go to Login</span>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="signup-container">
            {/* Background Glow Effects */}
            <div className="glow-orb top-left"></div>
            <div className="glow-orb bottom-right"></div>

            <div className="signup-box glass-panel animate-fade-in">
                <div className="signup-header">
                    <div className="signup-logo">
                        <LayoutDashboard size={36} color="var(--accent-primary)" />
                    </div>
                    <h1 className="signup-title">Create Account</h1>
                    <p className="signup-subtitle">Register as the system developer</p>
                </div>

                <form onSubmit={handleSignup} className="signup-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="input-group">
                        <label>Full Name</label>
                        <div className="input-wrapper">
                            <User className="input-icon" size={20} />
                            <input
                                type="text"
                                className="input-field with-icon"
                                placeholder="Hassan Developer"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Email Address</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                className="input-field with-icon"
                                placeholder="dev@inventorypro.com"
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

                    <div className="input-group">
                        <label>Confirm Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                className="input-field with-icon"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary signup-btn" disabled={loading}>
                        <span>{loading ? 'Creating Account...' : 'Create Developer Account'}</span>
                        {!loading && <UserPlus size={20} />}
                    </button>

                    <p className="login-redirect">
                        Already have an account? <Link to="/login">Sign In</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Signup;
