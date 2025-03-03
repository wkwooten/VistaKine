/**
 * Navigation.js
 * Handles the sidebar navigation functionality across all pages.
 * Includes resize functionality, state persistence, and mobile responsiveness.
 */
class Navigation {
    /**
     * Initialize the navigation
     */
    constructor() {
        // Configuration
        this.config = {
            minWidth: 100,
            maxWidth: 600,
            defaultWidth: 280,
            collapseThreshold: 80,
            snapPoints: [150, 280, 350]
        };

        // State
        this.state = {
            isResizing: false,
            isMobile: window.innerWidth <= 768
        };

        // Initialize DOM elements with safe access
        this.initElements();

        // If essential elements are missing, bail out
        if (!this.elements.nav) {
            console.error('Navigation element not found. Navigation disabled.');
            return;
        }

        // Create the resize handle and related UI elements
        this.createResizeHandle();

        // Initialize event listeners and behaviors
        this.initEventListeners();

        // Apply initial state based on saved preferences or device type
        this.applyInitialState();

        console.log('Navigation initialized successfully');
    }

    /**
     * Initialize and safely access DOM elements
     */
    initElements() {
        this.elements = {
            nav: document.getElementById('chapter-nav'),
            showNavToggle: document.getElementById('show-nav-toggle')
        };

        // Only try to get container if nav exists
        if (this.elements.nav) {
            this.elements.container = this.elements.nav.querySelector('.u-container');
        }

        // Log missing elements as warnings
        if (!this.elements.nav) console.error('Navigation element #chapter-nav not found');
        if (!this.elements.showNavToggle) console.warn('Navigation toggle button not found');
        if (this.elements.nav && !this.elements.container) console.warn('Navigation container not found');
    }

    /**
     * Create the resize handle with the pull tab
     */
    createResizeHandle() {
        // Remove any existing handle
        const existingHandle = this.elements.nav.querySelector('.resize-handle');
        let existingPullTab = null;

        if (existingHandle) {
            existingPullTab = existingHandle.querySelector('.pull-tab');
            existingHandle.remove();
        }

        // Create new handle
        this.elements.handle = document.createElement('div');
        this.elements.handle.className = 'resize-handle';
        this.elements.handle.setAttribute('aria-label', 'Resize navigation panel');
        this.elements.handle.setAttribute('role', 'slider');
        this.elements.nav.appendChild(this.elements.handle);

        // Create or reuse pull tab
        if (existingPullTab) {
            this.elements.pullTab = existingPullTab;
            this.elements.handle.appendChild(this.elements.pullTab);
        } else {
            this.elements.pullTab = document.createElement('div');
            this.elements.pullTab.className = 'pull-tab';
            this.elements.handle.appendChild(this.elements.pullTab);
        }
    }

    /**
     * Initialize all event listeners
     */
    initEventListeners() {
        // Bind event handlers to preserve 'this' context
        this.boundHandlers = {
            startResize: this.startResize.bind(this),
            handleResize: this.handleResize.bind(this),
            stopResize: this.stopResize.bind(this),
            startTouchResize: this.startTouchResize.bind(this),
            handleTouchResize: this.handleTouchResize.bind(this),
            handleWindowResize: this.handleWindowResize.bind(this),
            toggleNavigation: this.toggleNavigation.bind(this)
        };

        // Mouse events for resize
        this.elements.handle.addEventListener('mousedown', this.boundHandlers.startResize);
        document.addEventListener('mousemove', this.boundHandlers.handleResize);
        document.addEventListener('mouseup', this.boundHandlers.stopResize);

        // Touch events for resize
        this.elements.handle.addEventListener('touchstart', this.boundHandlers.startTouchResize, { passive: false });
        document.addEventListener('touchmove', this.boundHandlers.handleTouchResize, { passive: false });
        document.addEventListener('touchend', this.boundHandlers.stopResize);
        document.addEventListener('touchcancel', this.boundHandlers.stopResize);

        // Double click to reset width
        this.elements.handle.addEventListener('dblclick', () => {
            if (this.elements.nav.classList.contains('collapsed')) {
                this.expand();
            } else {
                this.setWidth(this.config.defaultWidth);
            }
        });

        // Toggle button for mobile
        if (this.elements.showNavToggle) {
            this.elements.showNavToggle.addEventListener('click', this.boundHandlers.toggleNavigation);
        }

        // Window resize event
        window.addEventListener('resize', this.boundHandlers.handleWindowResize);

        // Setup navigation links behavior
        this.setupNavigationLinks();
    }

    /**
     * Toggle navigation open/closed
     * @param {Event} e - Click event
     */
    toggleNavigation(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (this.elements.nav.classList.contains('collapsed')) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * Handle window resize events
     */
    handleWindowResize() {
        const wasMobile = this.state.isMobile;
        this.state.isMobile = window.innerWidth <= 768;

        // If switching between mobile and desktop views
        if (wasMobile !== this.state.isMobile) {
            if (wasMobile && !this.state.isMobile) {
                // Mobile → Desktop
                if (this.getStoredState('nav-collapsed') !== 'true') {
                    this.expand();
                }
            } else {
                // Desktop → Mobile
                this.collapse();
            }
        }
    }

    /**
     * Setup all links in the navigation to preserve state across pages
     */
    setupNavigationLinks() {
        if (!this.elements.nav) return;

        const navLinks = this.elements.nav.querySelectorAll('a');
        navLinks.forEach(link => {
            // Function to handle link clicks
            const handler = () => {
                // If on mobile, collapse navigation after selecting a link
                if (this.state.isMobile) {
                    setTimeout(() => this.collapse(), 150);
                }
            };

            // Mark as processed and add listener
            link.setAttribute('data-nav-handler', 'true');
            link.addEventListener('click', handler);
        });
    }

    /**
     * Apply initial navigation state based on device and saved preferences
     */
    applyInitialState() {
        try {
            // Get saved state
            const savedCollapsed = this.getStoredState('nav-collapsed');
            const savedWidth = this.getStoredState('nav-width');

            // On desktop, restore width if available
            if (!this.state.isMobile) {
                const width = savedWidth ? parseInt(savedWidth) : this.config.defaultWidth;
                if (!isNaN(width)) {
                    this.elements.nav.style.width = `${width}px`;
                }
            }

            // Apply collapsed/expanded state
            if (this.state.isMobile || savedCollapsed === 'true') {
                this.collapse(false); // Don't save state when applying initial state
            } else {
                this.expand(false);   // Don't save state when applying initial state
            }
        } catch (err) {
            console.error('Error applying initial navigation state:', err);
            // Fallback to sensible defaults
            if (this.state.isMobile) {
                this.collapse(false);
            } else {
                this.expand(false);
            }
        }
    }

    /**
     * Start resize operation with mouse
     * @param {MouseEvent} e - Mouse event
     */
    startResize(e) {
        e.preventDefault();
        this.state.isResizing = true;
        this.state.startX = e.clientX;
        this.state.startWidth = this.elements.nav.offsetWidth;
        document.body.classList.add('resizing');
        this.elements.handle.classList.add('active');
    }

    /**
     * Start resize operation with touch
     * @param {TouchEvent} e - Touch event
     */
    startTouchResize(e) {
        e.preventDefault();
        this.state.isResizing = true;
        this.state.startX = e.touches[0].clientX;
        this.state.startWidth = this.elements.nav.offsetWidth;
        document.body.classList.add('resizing');
        this.elements.handle.classList.add('active');
    }

    /**
     * Handle mouse movement during resize
     * @param {MouseEvent} e - Mouse event
     */
    handleResize(e) {
        if (!this.state.isResizing) return;
        this.processResize(e.clientX);
    }

    /**
     * Handle touch movement during resize
     * @param {TouchEvent} e - Touch event
     */
    handleTouchResize(e) {
        if (!this.state.isResizing) return;
        e.preventDefault();
        this.processResize(e.touches[0].clientX);
    }

    /**
     * Process resize operation based on current position
     * @param {number} clientX - Current X position
     */
    processResize(clientX) {
        // Calculate new width
        let newWidth = this.state.startWidth + (clientX - this.state.startX);

        // Enforce min/max constraints
        newWidth = Math.max(0, Math.min(newWidth, this.config.maxWidth));

        // Check for snapping (hold shift to bypass)
        const shiftKey = window.event && window.event.shiftKey;
        if (!shiftKey) {
            for (const snapPoint of this.config.snapPoints) {
                if (Math.abs(newWidth - snapPoint) < 15) {
                    newWidth = snapPoint;
                    break;
                }
            }
        }

        // Handle opacity when close to collapse threshold
        if (newWidth < this.config.collapseThreshold + 100 && this.elements.container) {
            const opacity = Math.max(0, Math.min(1, (newWidth - this.config.collapseThreshold) / 100));
            this.elements.container.style.opacity = opacity.toFixed(2);
        } else if (this.elements.container) {
            this.elements.container.style.opacity = '1';
        }

        // Set the new width
        this.setWidth(newWidth);
    }

    /**
     * End resize operation
     */
    stopResize() {
        if (!this.state.isResizing) return;

        this.state.isResizing = false;
        document.body.classList.remove('resizing');
        if (this.elements.handle) {
            this.elements.handle.classList.remove('active');
        }

        // Snap decision on release
        const currentWidth = this.elements.nav.offsetWidth;

        // Fully collapse if width is very small
        if (currentWidth < 30) {
            this.collapse();
        }
        // Snap to min width if smaller than threshold but not collapsed
        else if (currentWidth < this.config.collapseThreshold) {
            this.setWidth(this.config.minWidth);
            if (this.elements.container) {
                this.elements.container.style.opacity = '1';
            }
        }
    }

    /**
     * Set the navigation width
     * @param {number} width - New width in pixels
     */
    setWidth(width) {
        if (!this.elements.nav) return;

        // Handle different width scenarios
        if (width < 30) {
            // Collapse completely
            this.elements.nav.style.width = '0';
            this.elements.nav.classList.add('collapsed');
            document.body.classList.add('nav-collapsed');

            // No inline styling - all handled by CSS via the 'collapsed' class
        } else {
            // Apply width
            this.elements.nav.style.width = `${width}px`;
            this.elements.nav.classList.remove('collapsed');
            document.body.classList.remove('nav-collapsed');

            // No inline styling - all handled by CSS
        }

        // Save the width to localStorage
        this.saveState('nav-width', width);
    }

    /**
     * Collapse the navigation
     * @param {boolean} saveState - Whether to save state to localStorage
     */
    collapse(saveState = true) {
        if (!this.elements.nav) return;

        this.elements.nav.classList.add('collapsed');
        document.body.classList.add('nav-collapsed');
        this.elements.nav.style.width = '0';

        if (this.elements.container) {
            this.elements.container.style.opacity = '1';
        }

        // Ensure toggle button is visible
        if (this.elements.showNavToggle) {
            this.elements.showNavToggle.style.display = 'flex';
        }

        // Save state
        if (saveState) {
            this.saveState('nav-collapsed', 'true');
        }
    }

    /**
     * Expand the navigation
     * @param {boolean} saveState - Whether to save state to localStorage
     * @param {number} width - Width to expand to (defaults to saved width or default)
     */
    expand(saveState = true, width) {
        if (!this.elements.nav) return;

        this.elements.nav.classList.remove('collapsed');
        document.body.classList.remove('nav-collapsed');

        // Determine width to use
        let targetWidth = width;
        if (!targetWidth) {
            const savedWidth = this.getStoredState('nav-width');
            targetWidth = savedWidth ? parseInt(savedWidth) : this.config.defaultWidth;
            if (isNaN(targetWidth)) targetWidth = this.config.defaultWidth;
        }

        this.setWidth(targetWidth);

        if (this.elements.container) {
            this.elements.container.style.opacity = '1';
        }

        // Save state
        if (saveState) {
            this.saveState('nav-collapsed', 'false');
        }
    }

    /**
     * Save a state value to localStorage with error handling
     * @param {string} key - The key to store
     * @param {string|number} value - The value to store
     */
    saveState(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`Could not save navigation state "${key}" to localStorage:`, e);
        }
    }

    /**
     * Get a state value from localStorage with error handling
     * @param {string} key - The key to retrieve
     * @returns {string|null} The stored value or null
     */
    getStoredState(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn(`Could not retrieve navigation state "${key}" from localStorage:`, e);
            return null;
        }
    }
}

export default Navigation;