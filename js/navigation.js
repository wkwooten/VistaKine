/**
 * Navigation.js
 * Simple navigation handler for sidebar resizing and toggling.
 */
class Navigation {
    constructor() {
        // Basic configuration
        this.config = {
            minWidth: 100,
            maxWidth: 600,
            defaultWidth: 280
        };

        // Initialize elements
        this.nav = document.getElementById('chapter-nav');
        this.container = this.nav ? this.nav.querySelector('.u-container') : null;
        this.isMobile = window.innerWidth <= 768;

        // Exit if we can't find the navigation
        if (!this.nav) {
            console.error('Navigation element not found');
            return;
        }

        // Create resize handle with pull tab
        this.createResizeHandle();

        // Set up event listeners
        this.setupEventListeners();

        // Initialize navigation (expanded on desktop, collapsed on mobile)
        this.initializeNavigation();
    }

    /**
     * Create the resize handle with pull tab
     */
    createResizeHandle() {
        // Remove any existing handle
        const existingHandle = this.nav.querySelector('.resize-handle');
        if (existingHandle) {
            existingHandle.remove();
        }

        // Create new handle
        this.handle = document.createElement('div');
        this.handle.className = 'resize-handle';
        this.handle.setAttribute('aria-label', 'Resize navigation panel');
        this.nav.appendChild(this.handle);

        // Create pull tab
        this.pullTab = document.createElement('div');
        this.pullTab.className = 'pull-tab';
        this.handle.appendChild(this.pullTab);
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Mouse events for resize
        this.handle.addEventListener('mousedown', this.startResize.bind(this));
        document.addEventListener('mousemove', this.handleResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));

        // Touch events for resize
        this.handle.addEventListener('touchstart', this.startTouchResize.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchResize.bind(this), { passive: false });
        document.addEventListener('touchend', this.stopResize.bind(this));

        // Pull tab click to toggle
        this.pullTab.addEventListener('click', this.toggleNavigation.bind(this));

        // Window resize event
        window.addEventListener('resize', this.handleWindowResize.bind(this));
    }

    /**
     * Initialize navigation state
     */
    initializeNavigation() {
        // Make navigation visible by default on both mobile and desktop
        if (this.isMobile) {
            // For mobile, use fixed width since fit-content might make it too wide
            this.nav.style.width = `${this.config.defaultWidth}px`;
            this.nav.classList.remove('collapsed');
            document.body.classList.remove('nav-collapsed');
        } else {
            // For desktop, start with fit-content
            this.nav.style.width = 'fit-content';
            this.nav.classList.remove('collapsed');
            document.body.classList.remove('nav-collapsed');
        }
    }

    /**
     * Handle window resize
     */
    handleWindowResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;

        // If switching between views, we no longer auto-collapse
        // This allows the navigation to remain in its current state when switching device sizes
    }

    /**
     * Start resize with mouse
     */
    startResize(e) {
        e.preventDefault();
        this.isResizing = true;
        this.startX = e.clientX;
        this.startWidth = this.nav.offsetWidth;
        document.body.classList.add('resizing');
        this.handle.classList.add('active');
    }

    /**
     * Start resize with touch
     */
    startTouchResize(e) {
        e.preventDefault();
        this.isResizing = true;
        this.startX = e.touches[0].clientX;
        this.startWidth = this.nav.offsetWidth;
        document.body.classList.add('resizing');
        this.handle.classList.add('active');
    }

    /**
     * Handle mouse movement during resize
     */
    handleResize(e) {
        if (!this.isResizing) return;
        this.resize(e.clientX);
    }

    /**
     * Handle touch movement during resize
     */
    handleTouchResize(e) {
        if (!this.isResizing) return;
        e.preventDefault();
        this.resize(e.touches[0].clientX);
    }

    /**
     * Resize the navigation
     */
    resize(clientX) {
        // Calculate new width
        let newWidth = this.startWidth + (clientX - this.startX);

        // Enforce min/max constraints
        newWidth = Math.max(0, Math.min(newWidth, this.config.maxWidth));

        // If nearly collapsed, snap to collapsed
        if (newWidth < 50) {
            this.collapse();
            return;
        }

        // Set the width directly
        this.nav.style.width = `${newWidth}px`;
        this.nav.classList.remove('collapsed');
        document.body.classList.remove('nav-collapsed');
    }

    /**
     * Stop resize operation
     */
    stopResize() {
        if (!this.isResizing) return;
        this.isResizing = false;
        document.body.classList.remove('resizing');
        this.handle.classList.remove('active');
    }

    /**
     * Toggle navigation between collapsed and expanded
     */
    toggleNavigation(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (this.nav.classList.contains('collapsed')) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * Collapse the navigation
     */
    collapse() {
        this.nav.style.width = '0';
        this.nav.classList.add('collapsed');
        document.body.classList.add('nav-collapsed');
    }

    /**
     * Expand the navigation
     */
    expand() {
        this.nav.style.width = `${this.config.defaultWidth}px`;
        this.nav.classList.remove('collapsed');
        document.body.classList.remove('nav-collapsed');
    }
}

export default Navigation;