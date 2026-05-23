// Dynamic API configuration
(function() {
    let API_BASE_URL;
    
    // Check if we're in production (Render)
    if (window.location.hostname === 'gani-eleke-backend.onrender.com') {
        API_BASE_URL = 'https://gani-eleke-backend.onrender.com';
    }
    // Check for localhost with port 10000 (Render's local port)
    else if (window.location.port === '10000') {
        API_BASE_URL = `http://localhost:10000`;
    }
    // Check for Vercel preview/production
    else if (window.location.hostname.includes('vercel.app')) {
        API_BASE_URL = 'https://gani-eleke-backend.onrender.com';
    }
    // Default local development
    else {
        API_BASE_URL = 'http://localhost:5000';
    }
    
    window.API_BASE_URL = API_BASE_URL;
    console.log('API Base URL configured:', API_BASE_URL);
})();