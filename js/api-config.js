// API Configuration - Auto-detects local vs production environments
(function() {
    // Determine the API base URL based on current environment
    let API_BASE_URL;

    // Check if we're in development (localhost)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_BASE_URL = 'http://localhost:3000';
    }
    // Check if running on Vercel (production)
    else if (window.location.hostname.includes('vercel.app')) {
        // Use your actual Render backend URL
        API_BASE_URL = 'https://ngo-finance-management-1.onrender.com';
    }
    // Fallback for any other deployment
    else {
        API_BASE_URL = 'https://ngo-finance-management-1.onrender.com';
    }

    // Make it globally available
    window.API_BASE_URL = API_BASE_URL;

    // Log for debugging
    console.log('🔌 Nidigo API Configuration');
    console.log('   Hostname:', window.location.hostname);
    console.log('   API Base URL:', API_BASE_URL);
})();
