// API Configuration - Auto-detects local vs production environments
(function() {
    let API_BASE_URL;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_BASE_URL = 'http://localhost:3000';
    } else {
        API_BASE_URL = window.location.origin;
    }

    window.API_BASE_URL = API_BASE_URL;

    console.log('🔌 Nidigo API Configuration');
    console.log('   Hostname:', window.location.hostname);
    console.log('   API Base URL:', API_BASE_URL);
})();
