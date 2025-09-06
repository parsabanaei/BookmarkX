// BookmarkX Refine-Style Manager - Enhanced Application Logic
class RefineBookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.allBookmarks = [];
        this.folders = new Map();
        this.currentTheme = 'light';
        this.currentView = 'list'; // Only list view supported
        this.searchTerm = '';
        this.sortBy = 'dateDesc';
        this.folderFilter = '';
        this.dateFilter = '';
        this.selectedBookmarks = new Set();
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.loadSettings();
        await this.loadBookmarks();
        this.setupRealTimeUpdates();
        this.initializeTooltips();
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
        
        // View is fixed to list view only - no toggle needed
        
        // Filters
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.filterAndRenderBookmarks();
        });
        
        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.dateFilter = e.target.value;
            this.filterAndRenderBookmarks();
        });
        
        // Navigation items
        document.querySelectorAll('.refine-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.handleNavigation(item);
            });
        });
        
        // Header actions
        document.getElementById('githubBtn').addEventListener('click', () => {
            this.openGitHubRepository();
        });
        
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadBookmarks();
        });
        
        document.getElementById('addBookmarkBtn').addEventListener('click', () => {
            this.showAddBookmarkDialog();
        });
        
        // Add keyboard shortcut for adding bookmarks (Ctrl/Cmd + D)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.showAddBookmarkDialog();
            }
        });
        
        // Initialize Add Bookmark modal
        this.initAddBookmarkModal();
        
        // Initialize Delete Bookmark modal
        this.initDeleteBookmarkModal();
        
        // Initialize Edit Bookmark modal
        this.initEditBookmarkModal();
        
        document.getElementById('addFirstBookmark').addEventListener('click', () => {
            this.showAddBookmarkDialog();
        });
        
        // Modal controls
        document.getElementById('closeError').addEventListener('click', () => {
            this.hideError();
        });
        
        document.getElementById('retryButton').addEventListener('click', () => {
            this.hideError();
            this.loadBookmarks();
        });
        
        // Note: Select all functionality removed with table view
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }
    
    setupRealTimeUpdates() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch(request.action) {
                case 'bookmarkCreated':
                case 'bookmarkRemoved':
                case 'bookmarkChanged':
                    this.loadBookmarks();
                    this.showToast('Bookmarks updated', 'success');
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
                this.populateFolderNavigation();
                this.filterAndRenderBookmarks();
                this.updateStats();
                this.hideLoading();
            } else {
                throw new Error('Failed to load bookmarks');
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.showError('Failed to load bookmarks. Please check your connection and try again.');
        }
    }
    
    processBookmarks(bookmarkTree) {
        this.allBookmarks = [];
        this.folders.clear();
        
        const processNode = (node, folderPath = '', level = 0) => {
            if (node.url) {
                const bookmark = {
                    id: node.id,
                    title: node.title || 'Untitled',
                    url: node.url,
                    dateAdded: node.dateAdded,
                    folderPath: folderPath,
                    level: level,
                    favicon: this.getFavicon(node.url),
                    domain: this.getDomain(node.url)
                };
                this.allBookmarks.push(bookmark);
            } else if (node.title && node.title !== 'Bookmarks Bar' && node.title !== 'Other Bookmarks') {
                const currentPath = folderPath ? `${folderPath} > ${node.title}` : node.title;
                this.folders.set(currentPath, {
                    name: node.title,
                    path: currentPath,
                    level: level,
                    count: 0
                });
                
                if (node.children) {
                    node.children.forEach(child => processNode(child, currentPath, level + 1));
                }
            } else if (node.children) {
                node.children.forEach(child => processNode(child, folderPath, level));
            }
        };
        
        bookmarkTree.forEach(node => processNode(node));
        
        // Count bookmarks per folder
        this.allBookmarks.forEach(bookmark => {
            if (bookmark.folderPath && this.folders.has(bookmark.folderPath)) {
                const folder = this.folders.get(bookmark.folderPath);
                folder.count++;
            }
        });
        
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
    
    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }
    
    populateFolderNavigation() {
        const folderNav = document.getElementById('folderNav');
        folderNav.innerHTML = '';
        
        if (this.folders.size === 0) return;
        
        Array.from(this.folders.values())
            .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
            .forEach(folder => {
                const navItem = document.createElement('div');
                navItem.className = 'refine-nav-item';
                navItem.style.paddingLeft = `${2 + folder.level * 0.75}rem`;
                navItem.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>${this.escapeHtml(folder.name)}</span>
                    <span class="refine-badge">${folder.count}</span>
                `;
                
                navItem.addEventListener('click', () => {
                    this.folderFilter = folder.path;
                    this.updateNavigation();
                    this.filterAndRenderBookmarks();
                });
                
                folderNav.appendChild(navItem);
            });
    }
    
    handleNavigation(navItem) {
        // Remove active class from all nav items
        document.querySelectorAll('.refine-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to clicked item
        navItem.classList.add('active');
        
        // Handle navigation logic
        if (navItem.id === 'recentNav') {
            this.folderFilter = '';
            this.showRecent();
        } else {
            this.folderFilter = '';
            this.showAllBookmarks();
        }
    }
    
    showAllBookmarks() {
        this.filterAndRenderBookmarks();
    }
    
    // Favorites functionality removed
    
    showRecent() {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recent = this.allBookmarks.filter(bookmark => 
            bookmark.dateAdded >= oneWeekAgo
        );
        this.bookmarks = recent.sort((a, b) => b.dateAdded - a.dateAdded);
        this.renderBookmarks();
        this.updateStats();
    }
    
    filterAndRenderBookmarks() {
        let filtered = [...this.allBookmarks];
        
        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(bookmark => 
                bookmark.title.toLowerCase().includes(searchLower) ||
                bookmark.url.toLowerCase().includes(searchLower) ||
                bookmark.domain.toLowerCase().includes(searchLower) ||
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
            default:
                return (a, b) => b.dateAdded - a.dateAdded;
        }
    }
    
    renderBookmarks() {
        const container = document.getElementById('bookmarksContainer');
        const listContainer = document.getElementById('bookmarksList');
        const emptyState = document.getElementById('emptyState');
        
        if (this.bookmarks.length === 0) {
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        container.classList.remove('hidden');
        listContainer.classList.remove('hidden');
        
        // Always render list view
        this.renderList();
    }
    
    renderList() {
        const container = document.getElementById('bookmarksList');
        const html = this.bookmarks.map(bookmark => this.createListItemHTML(bookmark)).join('');
        container.innerHTML = html;
        
        // Add event listeners
        container.querySelectorAll('.refine-list-item').forEach(item => {
            const bookmarkId = item.dataset.id;
            const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
            
            item.addEventListener('click', (e) => {
                if (e.target.closest('.refine-list-actions')) return;
                this.openBookmark(bookmark.url);
            });
        });
        
        // Add action button listeners
        container.querySelectorAll('.refine-list-action').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = button.dataset.action;
                const bookmarkId = button.closest('.refine-list-item').dataset.id;
                const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
                this.handleBookmarkAction(action, bookmark);
            });
        });
        
        // Add favicon error handling
        container.querySelectorAll('.bookmark-favicon').forEach(img => {
            img.addEventListener('error', () => {
                img.classList.add('hidden');
            });
        });
    }
    
    
    createListItemHTML(bookmark) {
        const date = new Date(bookmark.dateAdded).toLocaleDateString();
        
        return `
            <div class="refine-list-item" data-id="${bookmark.id}">
                <div class="refine-list-favicon">
                    <img src="${bookmark.favicon}" alt="" class="bookmark-favicon">
                </div>
                <div class="refine-list-content">
                    <div class="refine-list-title">${this.escapeHtml(bookmark.title)}</div>
                    <div class="refine-list-url">${this.escapeHtml(bookmark.url)}</div>
                    <div class="refine-list-meta">
                        <span>${this.escapeHtml(bookmark.domain)}</span>
                        ${bookmark.folderPath ? `<span class="refine-list-folder">${this.escapeHtml(bookmark.folderPath)}</span>` : ''}
                        <span>${date}</span>
                    </div>
                </div>
                <div class="refine-list-actions">
                    <button class="refine-list-action" data-action="copy" title="Copy URL">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <button class="refine-list-action" data-action="edit" title="Edit bookmark">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="refine-list-action refine-list-action-danger" data-action="delete" title="Delete bookmark">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
    
    
    handleBookmarkAction(action, bookmark) {
        switch(action) {
            case 'copy':
                this.copyToClipboard(bookmark.url);
                break;
            case 'edit':
                this.showEditBookmarkDialog(bookmark);
                break;
            case 'delete':
                this.showDeleteBookmarkDialog(bookmark);
                break;
        }
    }
    
    openBookmark(url) {
        chrome.tabs.create({ url, active: false });
        this.showToast('Bookmark opened in new tab', 'success');
    }
    
    openGitHubRepository() {
        const gitHubUrl = 'https://github.com/parsabanaei/BookmarkX';
        chrome.tabs.create({ url: gitHubUrl, active: true });
        this.showToast('Opening BookmarkX repository...', 'success');
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('URL copied to clipboard', 'success');
        }).catch(() => {
            this.showToast('Failed to copy URL', 'error');
        });
    }
    
    // Selection functionality removed - not needed for list-only view
    
    updateStats() {
        const totalBadge = document.getElementById('totalBadge');
        const bookmarkCount = document.getElementById('bookmarkCount');
        
        totalBadge.textContent = this.allBookmarks.length;
        bookmarkCount.textContent = `${this.allBookmarks.length} bookmark${this.allBookmarks.length !== 1 ? 's' : ''}`;
    }
    
    updateFilteredStats() {
        const filteredCount = document.getElementById('filteredCount');
        const isFiltered = this.searchTerm || this.folderFilter || this.dateFilter;
        
        if (isFiltered) {
            filteredCount.textContent = `Showing ${this.bookmarks.length} result${this.bookmarks.length !== 1 ? 's' : ''}`;
            filteredCount.classList.remove('hidden');
        } else {
            filteredCount.classList.add('hidden');
        }
    }
    
    updateClearButton() {
        const clearBtn = document.getElementById('clearSearch');
        if (this.searchTerm) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    
    updateNavigation() {
        document.querySelectorAll('.refine-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (this.folderFilter) {
            const folderNavItems = document.querySelectorAll('#folderNav .refine-nav-item');
            folderNavItems.forEach(item => {
                const folderName = item.querySelector('span').textContent;
                if (this.folderFilter.includes(folderName)) {
                    item.classList.add('active');
                }
            });
        } else {
            document.querySelector('.refine-nav-item').classList.add('active');
        }
    }
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        this.saveSettings();
        // this.showToast(`Switched to ${this.currentTheme} theme`, 'success');
    }
    
    // View setting removed - always list view
    
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'k':
                case 'f':
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                    break;
                case 'r':
                    e.preventDefault();
                    this.loadBookmarks();
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('searchInput');
            if (searchInput.value) {
                searchInput.value = '';
                this.searchTerm = '';
                this.updateClearButton();
                this.filterAndRenderBookmarks();
            }
        }
    }
    
    
    
    showLoading() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('bookmarksContainer').classList.add('hidden');
    }
    
    hideLoading() {
        document.getElementById('loadingState').classList.add('hidden');
    }
    
    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorModal').classList.remove('hidden');
    }
    
    hideError() {
        document.getElementById('errorModal').classList.add('hidden');
    }
    
    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `refine-toast refine-toast-${type}`;
        toast.innerHTML = `
            <div class="refine-toast-content">
                <span>${this.escapeHtml(message)}</span>
                <button class="refine-toast-close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Add toast styles if not already present
        if (!document.querySelector('.refine-toast-container')) {
            const container = document.createElement('div');
            container.className = 'refine-toast-container';
            document.body.appendChild(container);
        }
        
        const container = document.querySelector('.refine-toast-container');
        container.appendChild(toast);
        
        // Auto dismiss
        setTimeout(() => {
            toast.remove();
        }, 4000);
        
        // Manual dismiss
        toast.querySelector('.refine-toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }
    
    initializeTooltips() {
        // Simple tooltip implementation
        document.querySelectorAll('[title]').forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'refine-tooltip';
                tooltip.textContent = e.target.title;
                document.body.appendChild(tooltip);
                
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = rect.bottom + 8 + 'px';
                
                e.target.removeAttribute('title');
                e.target.dataset.originalTitle = tooltip.textContent;
            });
            
            element.addEventListener('mouseleave', (e) => {
                const tooltip = document.querySelector('.refine-tooltip');
                if (tooltip) tooltip.remove();
                
                if (e.target.dataset.originalTitle) {
                    e.target.title = e.target.dataset.originalTitle;
                }
            });
        });
    }
    
    loadSettings() {
        const savedTheme = localStorage.getItem('bookmarkx-theme') || 'light';
        
        this.currentTheme = savedTheme;
        this.currentView = 'list'; // Always list view
        
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
    
    saveSettings() {
        localStorage.setItem('bookmarkx-theme', this.currentTheme);
        // View setting not needed - always list
    }

    // Add Bookmark Modal Functionality
    initAddBookmarkModal() {
        const modal = document.getElementById('addBookmarkModal');
        const closeBtn = document.getElementById('closeAddModal');
        const cancelBtn = document.getElementById('cancelAddBookmark');
        const overlay = modal.querySelector('.refine-modal-overlay');
        const form = document.getElementById('addBookmarkForm');

        // Close modal handlers
        const closeModal = () => {
            modal.classList.remove('show');
            this.resetAddBookmarkForm();
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeModal();
            }
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddBookmark();
        });

        // Real-time URL validation
        const urlInput = document.getElementById('bookmarkUrl');
        urlInput.addEventListener('input', this.debounce(() => {
            this.validateUrl(urlInput.value);
        }, 500));

        // Auto-fetch title when URL is valid
        urlInput.addEventListener('blur', () => {
            if (this.isValidUrl(urlInput.value)) {
                this.fetchPageTitle(urlInput.value);
            }
        });
    }

    showAddBookmarkDialog() {
        const modal = document.getElementById('addBookmarkModal');
        modal.classList.add('show');
        
        // Populate folders dropdown
        this.populateFoldersDropdown();
        
        // Focus on title input
        setTimeout(() => {
            document.getElementById('bookmarkTitle').focus();
        }, 100);
    }

    resetAddBookmarkForm() {
        const form = document.getElementById('addBookmarkForm');
        form.reset();
        
        // Clear error states
        document.querySelectorAll('.refine-form-group').forEach(group => {
            group.classList.remove('error');
        });
        document.querySelectorAll('.refine-form-error').forEach(error => {
            error.classList.remove('show');
            error.textContent = '';
        });
    }

    populateFoldersDropdown() {
        const select = document.getElementById('bookmarkFolder');
        select.innerHTML = '<option value="">Select folder (optional)</option>';
        
        // Add Bookmarks Bar
        const bookmarksBarOption = document.createElement('option');
        bookmarksBarOption.value = '1';
        bookmarksBarOption.textContent = 'Bookmarks Bar';
        select.appendChild(bookmarksBarOption);
        
        // Add Other Bookmarks
        const otherBookmarksOption = document.createElement('option');
        otherBookmarksOption.value = '2';
        otherBookmarksOption.textContent = 'Other Bookmarks';
        select.appendChild(otherBookmarksOption);
        
        // Add other folders
        this.folders.forEach((folder, id) => {
            if (id !== '1' && id !== '2') {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = folder.title;
                select.appendChild(option);
            }
        });
    }

    validateUrl(url) {
        const urlInput = document.getElementById('bookmarkUrl');
        const urlError = document.getElementById('urlError');
        const urlGroup = urlInput.closest('.refine-form-group');
        
        if (!url) {
            this.clearValidationError(urlGroup, urlError);
            return false;
        }
        
        if (!this.isValidUrl(url)) {
            this.showValidationError(urlGroup, urlError, 'Please enter a valid URL (e.g., https://example.com)');
            return false;
        }
        
        this.clearValidationError(urlGroup, urlError);
        return true;
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    async fetchPageTitle(url) {
        const titleInput = document.getElementById('bookmarkTitle');
        
        // Only auto-fill if title is empty
        if (titleInput.value.trim()) return;
        
        try {
            // For demonstration, we'll extract domain name as title
            // In a real implementation, you'd use chrome.tabs API or fetch the page
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            titleInput.value = `${domain.charAt(0).toUpperCase()}${domain.slice(1)}`;
        } catch (error) {
            console.log('Could not fetch page title:', error);
        }
    }

    showValidationError(group, errorElement, message) {
        group.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }

    clearValidationError(group, errorElement) {
        group.classList.remove('error');
        errorElement.classList.remove('show');
        errorElement.textContent = '';
    }

    async handleAddBookmark() {
        const title = document.getElementById('bookmarkTitle').value.trim();
        const url = document.getElementById('bookmarkUrl').value.trim();
        const folderId = document.getElementById('bookmarkFolder').value;
        
        // Validate required fields
        let hasErrors = false;
        
        if (!title) {
            this.showValidationError(
                document.getElementById('bookmarkTitle').closest('.refine-form-group'),
                document.getElementById('titleError'),
                'Title is required'
            );
            hasErrors = true;
        }
        
        if (!url) {
            this.showValidationError(
                document.getElementById('bookmarkUrl').closest('.refine-form-group'),
                document.getElementById('urlError'),
                'URL is required'
            );
            hasErrors = true;
        } else if (!this.isValidUrl(url)) {
            this.showValidationError(
                document.getElementById('bookmarkUrl').closest('.refine-form-group'),
                document.getElementById('urlError'),
                'Please enter a valid URL'
            );
            hasErrors = true;
        }
        
        if (hasErrors) return;
        
        try {
            // Create bookmark using Chrome API
            const bookmark = await chrome.bookmarks.create({
                title: title,
                url: url,
                parentId: folderId || '1' // Default to Bookmarks Bar
            });
            
            // Close modal
            document.getElementById('addBookmarkModal').classList.remove('show');
            this.resetAddBookmarkForm();
            
            // Refresh bookmarks
            await this.loadBookmarks();
            
            // Show success message
            this.showToast(`Bookmark "${title}" added successfully!`, 'success');
            
        } catch (error) {
            console.error('Error adding bookmark:', error);
            this.showToast('Failed to add bookmark. Please try again.', 'error');
        }
    }

    showToast(message, type = 'info') {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.className = `refine-toast refine-toast-${type}`;
        toast.textContent = message;
        
        // Toast styles
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: '1001',
            fontSize: '14px',
            fontWeight: '500',
            maxWidth: '400px',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease'
        });
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Delete Bookmark Modal Functionality
    initDeleteBookmarkModal() {
        const modal = document.getElementById('deleteBookmarkModal');
        const cancelBtn = document.getElementById('cancelDeleteBookmark');
        const confirmBtn = document.getElementById('confirmDeleteBookmark');
        const overlay = modal.querySelector('.refine-delete-modal-overlay');

        // Close modal handlers
        const closeModal = () => {
            modal.classList.remove('show');
            this.currentBookmarkToDelete = null;
        };

        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeModal();
            }
        });

        // Confirm delete
        confirmBtn.addEventListener('click', () => {
            if (this.currentBookmarkToDelete) {
                this.deleteBookmark(this.currentBookmarkToDelete);
            }
        });
    }

    showDeleteBookmarkDialog(bookmark) {
        this.currentBookmarkToDelete = bookmark;
        
        const modal = document.getElementById('deleteBookmarkModal');
        const bookmarkNameSpan = document.getElementById('deleteBookmarkName');
        
        bookmarkNameSpan.textContent = bookmark.title;
        modal.classList.add('show');
        
        // Focus on cancel button (safer default)
        setTimeout(() => {
            document.getElementById('cancelDeleteBookmark').focus();
        }, 100);
    }

    async deleteBookmark(bookmark) {
        try {
            // Delete bookmark using Chrome API
            await chrome.bookmarks.remove(bookmark.id);
            
            // Close modal
            document.getElementById('deleteBookmarkModal').classList.remove('show');
            this.currentBookmarkToDelete = null;
            
            // Refresh bookmarks
            await this.loadBookmarks();
            
            // Show success message
            this.showToast(`Bookmark "${bookmark.title}" deleted successfully`, 'success');
            
        } catch (error) {
            console.error('Error deleting bookmark:', error);
            this.showToast('Failed to delete bookmark. Please try again.', 'error');
        }
    }

    // Edit Bookmark Modal Functionality
    initEditBookmarkModal() {
        const modal = document.getElementById('editBookmarkModal');
        const closeBtn = document.getElementById('closeEditModal');
        const cancelBtn = document.getElementById('cancelEditBookmark');
        const overlay = modal.querySelector('.refine-modal-overlay');
        const form = document.getElementById('editBookmarkForm');

        // Close modal handlers
        const closeModal = () => {
            modal.classList.remove('show');
            this.resetEditBookmarkForm();
            this.currentBookmarkToEdit = null;
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeModal();
            }
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEditBookmark();
        });

        // Real-time title validation
        const titleInput = document.getElementById('editBookmarkTitle');
        titleInput.addEventListener('input', this.debounce(() => {
            this.validateEditTitle(titleInput.value);
        }, 300));
    }

    showEditBookmarkDialog(bookmark) {
        this.currentBookmarkToEdit = bookmark;
        
        const modal = document.getElementById('editBookmarkModal');
        const titleInput = document.getElementById('editBookmarkTitle');
        const urlInput = document.getElementById('editBookmarkUrl');
        
        // Populate form with current values
        titleInput.value = bookmark.title;
        urlInput.value = bookmark.url;
        
        modal.classList.add('show');
        
        // Focus on title input and select all text
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 100);
    }

    resetEditBookmarkForm() {
        const form = document.getElementById('editBookmarkForm');
        form.reset();
        
        // Clear error states
        document.querySelectorAll('.refine-form-group').forEach(group => {
            group.classList.remove('error');
        });
        document.querySelectorAll('.refine-form-error').forEach(error => {
            error.classList.remove('show');
            error.textContent = '';
        });
    }

    validateEditTitle(title) {
        const titleInput = document.getElementById('editBookmarkTitle');
        const titleError = document.getElementById('editTitleError');
        const titleGroup = titleInput.closest('.refine-form-group');
        
        if (!title || title.trim().length === 0) {
            this.showValidationError(titleGroup, titleError, 'Title is required');
            return false;
        }
        
        if (title.trim().length > 200) {
            this.showValidationError(titleGroup, titleError, 'Title must be less than 200 characters');
            return false;
        }
        
        this.clearValidationError(titleGroup, titleError);
        return true;
    }

    async handleEditBookmark() {
        const title = document.getElementById('editBookmarkTitle').value.trim();
        
        // Validate title
        if (!this.validateEditTitle(title)) {
            return;
        }
        
        // Check if title has actually changed
        if (title === this.currentBookmarkToEdit.title) {
            // No changes made, just close modal
            document.getElementById('editBookmarkModal').classList.remove('show');
            this.resetEditBookmarkForm();
            this.currentBookmarkToEdit = null;
            return;
        }
        
        try {
            // Update bookmark using Chrome API
            await chrome.bookmarks.update(this.currentBookmarkToEdit.id, {
                title: title
            });
            
            // Close modal
            document.getElementById('editBookmarkModal').classList.remove('show');
            this.resetEditBookmarkForm();
            this.currentBookmarkToEdit = null;
            
            // Refresh bookmarks
            await this.loadBookmarks();
            
            // Show success message
            this.showToast(`Bookmark title updated to "${title}"`, 'success');
            
        } catch (error) {
            console.error('Error updating bookmark:', error);
            this.showToast('Failed to update bookmark. Please try again.', 'error');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
    new RefineBookmarkManager();
});

// Add toast container styles dynamically
const toastStyles = `
.refine-toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.refine-toast {
    background: var(--refine-bg-base);
    border: 1px solid var(--refine-border-base);
    border-radius: var(--refine-radius-md);
    box-shadow: var(--refine-shadow-lg);
    padding: 12px 16px;
    min-width: 300px;
    max-width: 400px;
    animation: refine-toast-slide-in 0.3s ease;
}

.refine-toast-success {
    border-left: 4px solid var(--refine-success-500);
}

.refine-toast-error {
    border-left: 4px solid var(--refine-error-500);
}

.refine-toast-info {
    border-left: 4px solid var(--refine-primary-500);
}

.refine-toast-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.refine-toast-close {
    background: none;
    border: none;
    color: var(--refine-text-subtle);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.refine-toast-close:hover {
    background: var(--refine-bg-muted);
    color: var(--refine-text-base);
}

.refine-tooltip {
    position: absolute;
    background: var(--refine-gray-900);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 1001;
    pointer-events: none;
}

@keyframes refine-toast-slide-in {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;

// Inject toast styles
const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);
