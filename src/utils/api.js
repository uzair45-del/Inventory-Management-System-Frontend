import axios from 'axios'

// Use VITE_API_URL in production (Vercel), fallback to local proxy in dev
const baseURL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('inventory_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Handle 401 globally — redirect to login if token expired
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const publicPaths = ['/login', '/signup']
            if (!publicPaths.includes(window.location.pathname)) {
                localStorage.removeItem('inventory_token')
                localStorage.removeItem('inventory_user')
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
