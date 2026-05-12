// Session tracking for web crawler optimization - ONLY PORTAL-LOGIN FLOWS
function initSessionTracking() {
    const page = document.body.dataset.page;
    
    // ONLY track portal and login pages - ignore all internal navigation
    const allowedPages = ['landing', 'admin-login', 'user-login'];
    
    if (!allowedPages.includes(page)) {
        // Don't track internal pages like dashboard, income, expense, etc.
        return;
    }
    
    // Store session info for crawler tracking
    if (!sessionStorage.getItem('nidigoSessionStart')) {
        sessionStorage.setItem('nidigoSessionStart', Date.now());
        sessionStorage.setItem('nidigoCurrentPage', page);
        sessionStorage.setItem('nidigoLoginFlow', '1');
    }
    
    // Handle browser navigation events ONLY for portal/login pages
    handlePortalNavigation();
}

function handlePortalNavigation() {
    // ONLY track navigation between portal and login pages
    let navigationTimer;
    
    window.addEventListener('popstate', (event) => {
        clearTimeout(navigationTimer);
        navigationTimer = setTimeout(() => {
            updatePortalSession();
        }, 100);
    });
    
    // Track forward navigation
    window.addEventListener('pushstate', (event) => {
        clearTimeout(navigationTimer);
        navigationTimer = setTimeout(() => {
            updatePortalSession();
        }, 100);
    });
}

function updatePortalSession() {
    const page = document.body.dataset.page;
    const allowedPages = ['landing', 'admin-login', 'user-login'];
    
    // ONLY update if we're on a portal or login page
    if (!allowedPages.includes(page)) {
        return;
    }
    
    // Update session for portal/login flows only
    sessionStorage.setItem('nidigoCurrentPage', page);
    sessionStorage.setItem('nidigoLastActivity', Date.now());
    
    // Track the specific flow: portal → admin → portal OR portal → user → portal
    const currentPage = sessionStorage.getItem('nidigoCurrentPage');
    const previousPage = sessionStorage.getItem('nidigoPreviousPage');
    
    if (previousPage && currentPage !== previousPage) {
        // Track the backtracking between portal and login pages
        sessionStorage.setItem('nidigoFlowPath', `${previousPage} → ${currentPage}`);
        sessionStorage.setItem('nidigoFlowChange', Date.now());
    }
    
    sessionStorage.setItem('nidigoPreviousPage', currentPage);
}
