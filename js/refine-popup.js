// BookmarkX Refine-Style Popup Script
class RefinePopup {
    constructor() {
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadBookmarkStats();
        this.addEnhancedInteractions();
    }
    
    setupEventListeners() {
        // Main manager button
        const openManagerBtn = document.getElementById('openManager');
        if (openManagerBtn) {
            openManagerBtn.addEventListener('click', () => {
                this.openManager();
            });
        }
        
        // Quick search button
        const quickSearchBtn = document.getElementById('quickSearch');
        if (quickSearchBtn) {
            quickSearchBtn.addEventListener('click', () => {
                this.openManagerWithSearch();
            });
        }
        
        // Recent bookmarks button
        const recentBtn = document.getElementById('recentBookmarks');
        if (recentBtn) {
            recentBtn.addEventListener('click', () => {
                this.openManagerWithRecent();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Enhanced button interactions
        this.setupButtonAnimations();
    }
    
    async loadBookmarkStats() {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getBookmarks' }, resolve);
            });
            
            if (response && response.bookmarks) {
                const stats = this.calculateBookmarkStats(response.bookmarks);
                this.updateStatsDisplay(stats);
            } else {
                this.showStatsError();
            }
        } catch (error) {
            console.error('Error loading bookmark stats:', error);
            this.showStatsError();
        }
    }
    
    calculateBookmarkStats(bookmarkTree) {
        let bookmarkCount = 0;
        let folderCount = 0;
        
        const processNode = (node) => {
            if (node.url) {
                bookmarkCount++;
            } else if (node.title && node.title !== 'Bookmarks Bar' && node.title !== 'Other Bookmarks') {
                folderCount++;
            }
            
            if (node.children) {
                node.children.forEach(child => processNode(child));
            }
        };
        
        bookmarkTree.forEach(node => processNode(node));
        
        return { bookmarkCount, folderCount };
    }
    
    updateStatsDisplay(stats) {
        const bookmarkCountEl = document.getElementById('popupBookmarkCount');
        const folderCountEl = document.getElementById('popupFolderCount');
        
        if (bookmarkCountEl) {
            bookmarkCountEl.textContent = `${stats.bookmarkCount} bookmark${stats.bookmarkCount !== 1 ? 's' : ''}`;
        }
        
        if (folderCountEl) {
            folderCountEl.textContent = `${stats.folderCount} folder${stats.folderCount !== 1 ? 's' : ''}`;
        }
        
        // Add pulse animation to updated stats
        [bookmarkCountEl, folderCountEl].forEach(el => {
            if (el) {
                el.style.animation = 'refine-pulse 0.5s ease-in-out';
                setTimeout(() => {
                    el.style.animation = '';
                }, 500);
            }
        });
    }
    
    showStatsError() {
        const bookmarkCountEl = document.getElementById('popupBookmarkCount');
        const folderCountEl = document.getElementById('popupFolderCount');
        
        if (bookmarkCountEl) bookmarkCountEl.textContent = 'Unable to load';
        if (folderCountEl) folderCountEl.textContent = 'Unable to load';
    }
    
    openManager() {
        chrome.runtime.sendMessage({ action: 'openManager' }, (response) => {
            if (response && response.success) {
                this.closePopup();
            }
        });
    }
    
    openManagerWithSearch() {
        // Open manager and focus search
        chrome.runtime.sendMessage({ 
            action: 'openManager',
            focus: 'search'
        }, (response) => {
            if (response && response.success) {
                this.closePopup();
            }
        });
    }
    
    openManagerWithRecent() {
        // Open manager with recent filter
        chrome.runtime.sendMessage({ 
            action: 'openManager',
            view: 'recent'
        }, (response) => {
            if (response && response.success) {
                this.closePopup();
            }
        });
    }
    
    closePopup() {
        window.close();
    }
    
    handleKeyboardShortcuts(e) {
        switch(e.key) {
            case 'Enter':
                e.preventDefault();
                this.openManager();
                break;
            case 'Escape':
                this.closePopup();
                break;
            case '1':
                if (e.altKey) {
                    e.preventDefault();
                    this.openManager();
                }
                break;
            case '2':
                if (e.altKey) {
                    e.preventDefault();
                    this.openManagerWithSearch();
                }
                break;
            case '3':
                if (e.altKey) {
                    e.preventDefault();
                    this.openManagerWithRecent();
                }
                break;
        }
    }
    
    setupButtonAnimations() {
        const buttons = document.querySelectorAll('.refine-popup-btn');
        
        buttons.forEach(button => {
            // Enhanced hover effects
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
            });
            
            // Click animation
            button.addEventListener('mousedown', () => {
                button.style.transform = 'translateY(0) scale(0.98)';
            });
            
            button.addEventListener('mouseup', () => {
                button.style.transform = 'translateY(-2px) scale(1)';
            });
            
            // Focus enhancement
            button.addEventListener('focus', () => {
                button.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.2)';
            });
            
            button.addEventListener('blur', () => {
                button.style.boxShadow = '';
            });
        });
    }
    
    addEnhancedInteractions() {
        // Add ripple effect to buttons
        const buttons = document.querySelectorAll('.refine-popup-btn');
        
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.createRippleEffect(e, button);
            });
        });
        
        // Add stats hover effects
        const stats = document.querySelectorAll('.refine-popup-stat');
        stats.forEach(stat => {
            stat.addEventListener('mouseenter', () => {
                stat.style.transform = 'scale(1.05)';
                stat.style.background = 'rgba(14, 165, 233, 0.1)';
            });
            
            stat.addEventListener('mouseleave', () => {
                stat.style.transform = 'scale(1)';
                stat.style.background = '';
            });
        });
        
        // Add entrance animation for stats when they load
        setTimeout(() => {
            stats.forEach((stat, index) => {
                stat.style.animation = `refine-slide-in 0.3s ease-out ${index * 0.1}s both`;
            });
        }, 100);
    }
    
    createRippleEffect(event, button) {
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: refine-ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RefinePopup();
});

// Add custom animations
const animations = `
@keyframes refine-ripple {
    to {
        transform: scale(2);
        opacity: 0;
    }
}

@keyframes refine-slide-in {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes refine-pulse {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.8;
        transform: scale(1.05);
    }
}
`;

// Inject animations
const styleSheet = document.createElement('style');
styleSheet.textContent = animations;
document.head.appendChild(styleSheet);
