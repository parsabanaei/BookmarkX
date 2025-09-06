// BookmarkX Manager - Main Application Logic
class BookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.allBookmarks = [];
        this.folders = new Set();
        this.currentTheme = 'light';
        this.currentView = 'list';
        this.searchTerm = '';
        this.sortBy = 'dateDesc';
        this.folderFilter = '';
        this.dateFilter = '';
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.loadTheme();
        await this.loadBookmarks();
        this.setupRealTimeUpdates();
    }
    
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', this.debounce((e) => {
            this.searchTerm = e.target.value;
            this.updateClearButton();
            this.filterAndRenderBookmarks();
        }, 300));
        
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            this.searchTerm = '';
            this.updateClearButton();
            this.filterAndRenderBookmarks();
        });
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // View toggle
        document.getElementById('listView').addEventListener('click', () => {
            this.setView('list');
        });
        
        document.getElementById('gridView').addEventListener('click', () => {
            this.setView('grid');
        });
        
        // Filters
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.filterAndRenderBookmarks();
        });
        
        document.getElementById('folderFilter').addEventListener('change', (e) => {
            this.folderFilter = e.target.value;
            this.filterAndRenderBookmarks();
        });
        
        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.dateFilter = e.target.value;
            this.filterAndRenderBookmarks();
        });
        
        // Error modal
        document.getElementById('closeError').addEventListener('click', () => {
            this.hideError();
        });
        
        document.getElementById('retryButton').addEventListener('click', () => {
            this.hideError();
            this.loadBookmarks();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'k':
                        e.preventDefault();
                        searchInput.focus();
                        break;
                    case 'f':
                        e.preventDefault();
                        searchInput.focus();
                        break;
                }
            }
            
            if (e.key === 'Escape') {
                if (searchInput.value) {
                    searchInput.value = '';
                    this.searchTerm = '';
                    this.updateClearButton();
                    this.filterAndRenderBookmarks();
                }
            }
        });
    }
    
    setupRealTimeUpdates() {
        // Listen for bookmark changes from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch(request.action) {
                case 'bookmarkCreated':
                case 'bookmarkRemoved':
                case 'bookmarkChanged':
                    this.loadBookmarks();
                    break;
            }
        });
    }
    
    async loadBookmarks() {
        try {
            this.showLoading();
            
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getBookmarks' }, resolve);
            });
            
            if (response && response.bookmarks) {
                this.processBookmarks(response.bookmarks);
                this.populateFolderFilter();
                this.filterAndRenderBookmarks();
                this.updateStats();
            } else {
                throw new Error('Failed to load bookmarks');
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.showError('Failed to load bookmarks. Please try again.');
        }
    }
    
    processBookmarks(bookmarkTree) {
        this.allBookmarks = [];
        this.folders = new Set();
        
        const processNode = (node, folderPath = '') => {
            if (node.url) {
                // This is a bookmark
                const bookmark = {
                    id: node.id,
                    title: node.title || 'Untitled',
                    url: node.url,
                    dateAdded: node.dateAdded,
                    folderPath: folderPath,
                    favicon: this.getFavicon(node.url)
                };
                this.allBookmarks.push(bookmark);
            } else {
                // This is a folder
                const currentPath = folderPath ? `${folderPath} > ${node.title}` : node.title;
                if (node.title && node.title !== 'Bookmarks Bar' && node.title !== 'Other Bookmarks') {
                    this.folders.add(currentPath);
                }
                
                if (node.children) {
                    node.children.forEach(child => processNode(child, currentPath));
                }
            }
        };
        
        bookmarkTree.forEach(node => processNode(node));
        this.bookmarks = [...this.allBookmarks];
    }
    
    getFavicon(url) {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
        }
    }
    
    populateFolderFilter() {
        const folderSelect = document.getElementById('folderFilter');
        
        // Clear existing options except "All Folders"
        while (folderSelect.children.length > 1) {
            folderSelect.removeChild(folderSelect.lastChild);
        }
        
        // Add folder options
        Array.from(this.folders).sort().forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            folderSelect.appendChild(option);
        });
    }
    
    filterAndRenderBookmarks() {
        let filtered = [...this.allBookmarks];
        
        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(bookmark => 
                bookmark.title.toLowerCase().includes(searchLower) ||
                bookmark.url.toLowerCase().includes(searchLower) ||
                bookmark.folderPath.toLowerCase().includes(searchLower)
            );
        }
        
        // Apply folder filter
        if (this.folderFilter) {
            filtered = filtered.filter(bookmark => 
                bookmark.folderPath === this.folderFilter
            );
        }
        
        // Apply date filter
        if (this.dateFilter) {
            const now = Date.now();
            const cutoff = this.getDateCutoff(now);
            filtered = filtered.filter(bookmark => 
                bookmark.dateAdded >= cutoff
            );
        }
        
        // Apply sorting
        filtered.sort(this.getSortFunction());
        
        this.bookmarks = filtered;
        this.renderBookmarks();
        this.updateFilteredStats();
    }
    
    getDateCutoff(now) {
        switch(this.dateFilter) {
            case 'today':
                return now - (24 * 60 * 60 * 1000);
            case 'week':
                return now - (7 * 24 * 60 * 60 * 1000);
            case 'month':
                return now - (30 * 24 * 60 * 60 * 1000);
            case 'year':
                return now - (365 * 24 * 60 * 60 * 1000);
            default:
                return 0;
        }
    }
    
    getSortFunction() {
        switch(this.sortBy) {
            case 'dateAsc':
                return (a, b) => a.dateAdded - b.dateAdded;
            case 'dateDesc':
                return (a, b) => b.dateAdded - a.dateAdded;
            case 'titleAsc':
                return (a, b) => a.title.localeCompare(b.title);
            case 'titleDesc':
                return (a, b) => b.title.localeCompare(a.title);
            case 'urlAsc':
                return (a, b) => a.url.localeCompare(b.url);
            case 'urlDesc':
                return (a, b) => b.url.localeCompare(a.url);
            default:
                return (a, b) => b.dateAdded - a.dateAdded;
        }
    }
    
    renderBookmarks() {
        const container = document.getElementById('bookmarksList');
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        
        loadingState.style.display = 'none';
        
        if (this.bookmarks.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';
        container.style.display = 'block';
        container.className = `bookmarks-list ${this.currentView}-view`;
        
        const html = this.bookmarks.map(bookmark => this.createBookmarkHTML(bookmark)).join('');
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.bookmark-actions')) return;
                
                const url = item.dataset.url;
                chrome.tabs.create({ url, active: false });
            });
        });
    }
    
    createBookmarkHTML(bookmark) {
        const date = new Date(bookmark.dateAdded).toLocaleDateString();
        const domain = this.getDomain(bookmark.url);
        
        return `
            <div class="bookmark-item" data-url="${this.escapeHtml(bookmark.url)}">
                <div class="bookmark-favicon">
                    <img src="${bookmark.favicon}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><path d=&quot;M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71&quot;></path><path d=&quot;M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71&quot;></path></svg>'">
                </div>
                <div class="bookmark-content">
                    <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
                    <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
                    <div class="bookmark-meta">
                        <span class="bookmark-domain">${this.escapeHtml(domain)}</span>
                        ${bookmark.folderPath ? `<span class="bookmark-folder">${this.escapeHtml(bookmark.folderPath)}</span>` : ''}
                        <span class="bookmark-date">${date}</span>
                    </div>
                </div>
                <div class="bookmark-actions">
                    <button class="action-btn" onclick="this.parentNode.parentNode.click()" title="Open bookmark">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15,3 21,3 21,9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="navigator.clipboard.writeText('${this.escapeHtml(bookmark.url)}')" title="Copy URL">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
    
    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateStats() {
        document.getElementById('bookmarkCount').textContent = 
            `${this.allBookmarks.length} bookmark${this.allBookmarks.length !== 1 ? 's' : ''}`;
        document.getElementById('folderCount').textContent = 
            `${this.folders.size} folder${this.folders.size !== 1 ? 's' : ''}`;
    }
    
    updateFilteredStats() {
        const filteredCount = document.getElementById('filteredCount');
        const isFiltered = this.searchTerm || this.folderFilter || this.dateFilter;
        
        if (isFiltered) {
            filteredCount.textContent = `Showing ${this.bookmarks.length} result${this.bookmarks.length !== 1 ? 's' : ''}`;
            filteredCount.style.display = 'inline';
        } else {
            filteredCount.style.display = 'none';
        }
    }
    
    updateClearButton() {
        const clearBtn = document.getElementById('clearSearch');
        clearBtn.style.display = this.searchTerm ? 'flex' : 'none';
    }
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('bookmarkx-theme', this.currentTheme);
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('bookmarkx-theme') || 'light';
        this.currentTheme = savedTheme;
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    
    setView(view) {
        this.currentView = view;
        
        document.getElementById('listView').classList.toggle('active', view === 'list');
        document.getElementById('gridView').classList.toggle('active', view === 'grid');
        
        const container = document.getElementById('bookmarksList');
        if (container) {
            container.className = `bookmarks-list ${view}-view`;
        }
        
        localStorage.setItem('bookmarkx-view', view);
    }
    
    showLoading() {
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('bookmarksList').style.display = 'none';
    }
    
    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorModal').style.display = 'flex';
    }
    
    hideError() {
        document.getElementById('errorModal').style.display = 'none';
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BookmarkManager();
});
