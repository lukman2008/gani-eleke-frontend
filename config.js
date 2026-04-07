// Dynamic API configuration
const API_CONFIG = {
    getBaseUrl: function() {
        // Check if we're in production (Render)
        if (window.location.hostname === 'gani-eleke-backend.onrender.com') {
            return 'https://gani-eleke-backend.onrender.com';
        }
        // Check for localhost with port 10000 (Render's local port)
        if (window.location.port === '10000') {
            return `http://localhost:10000`;
        }
        // Default local development
        return 'http://localhost:5000';
    }
};

window.API_BASE_URL = API_CONFIG.getBaseUrl();
console.log('API Base URL:', window.API_BASE_URL);