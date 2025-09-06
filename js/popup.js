// Popup script for BookmarkX
document.addEventListener('DOMContentLoaded', function() {
    const openManagerBtn = document.getElementById('openManager');
    
    if (openManagerBtn) {
        openManagerBtn.addEventListener('click', function() {
            // Send message to background script to open manager
            chrome.runtime.sendMessage({ action: 'openManager' }, function(response) {
                if (response && response.success) {
                    // Close the popup
                    window.close();
                }
            });
        });
    }
    
    // Add hover effect
    openManagerBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-1px)';
    });
    
    openManagerBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});
