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

        // Ensure the navigation has the correct overflow property
        this.nav.style.overflow = 'visible';

        // Create resize handle with pull tab
        this.createResizeHandle();

        // Set up event listeners
        this.setupEventListeners();

        // Initialize navigation (expanded on desktop and mobile)
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
            // For mobile, use fixed width but ensure it doesn't exceed screen width
            this.nav.style.width = `${this.config.defaultWidth}px`;
            this.nav.style.maxWidth = '100vw';

            // Make sure container is expanded
            if (this.container) {
                this.container.classList.remove('collapsed');
                this.container.style.opacity = '1';
                this.container.style.width = '100%';
                this.container.style.pointerEvents = 'auto';
            }

            document.body.classList.remove('nav-collapsed');
        } else {
            // For desktop, start with fit-content
            this.nav.style.width = 'fit-content';

            // Make sure container is expanded
            if (this.container) {
                this.container.classList.remove('collapsed');
                this.container.style.opacity = '1';
                this.container.style.width = '100%';
                this.container.style.pointerEvents = 'auto';
            }

            document.body.classList.remove('nav-collapsed');
        }
    }

    /**
     * Handle window resize
     */
    handleWindowResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;

        // Update maxWidth when switching between mobile and desktop
        if (wasMobile !== this.isMobile) {
            if (this.isMobile) {
                this.nav.style.maxWidth = '100vw';
            } else {
                this.nav.style.maxWidth = '';
            }
        }
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
        newWidth = Math.max(20, Math.min(newWidth, this.config.maxWidth));

        // Set the width directly
        this.nav.style.width = `${newWidth}px`;

        // Calculate opacity based on width - fade out content as width gets smaller
        if (this.container) {
            // Gradual opacity transition based on width
            // Start fading when width is below 150px
            if (newWidth < 150) {
                // Calculate opacity: 0 at 50px width, 1 at 150px width
                const containerOpacity = Math.max(0, (newWidth - 50) / 100);
                this.container.style.opacity = containerOpacity.toFixed(2);

                // Only hide visibility when opacity is very low
                if (containerOpacity < 0.1) {
                    this.container.style.visibility = 'hidden';
                } else {
                    this.container.style.visibility = 'visible';
                }

                // Set overflow-x to hidden when width gets small to prevent content overflow
                this.container.style.overflowX = 'hidden';
            } else {
                // Fully visible when width is 150px or more
                this.container.style.opacity = '1';
                this.container.style.visibility = 'visible';
                this.container.style.overflowX = 'hidden';
            }
        }

        // If width is very small, apply collapsed styles to container
        if (newWidth <= 20) {
            if (this.container && !this.container.classList.contains('collapsed')) {
                // First fade out and reduce width
                this.container.style.opacity = '0';
                this.container.style.visibility = 'hidden';
                this.container.style.width = '0';
                this.container.style.padding = '0';
                this.container.style.pointerEvents = 'none';
                document.body.classList.add('nav-collapsed');

                // Add collapsed class after a small delay
                setTimeout(() => {
                    this.container.classList.add('collapsed');
                }, 50); // Shorter delay for faster collapse
            }
        } else {
            // Otherwise ensure container is expanded
            if (this.container && this.container.classList.contains('collapsed')) {
                // Remove collapsed class first to restore overflow
                this.container.classList.remove('collapsed');

                // Then set properties to expand
                this.container.style.width = '100%';
                this.container.style.padding = '';
                this.container.style.pointerEvents = 'auto';

                // Only make content visible once width is substantial enough
                if (newWidth >= 50) {
                    const containerOpacity = Math.max(0, (newWidth - 50) / 100);
                    this.container.style.opacity = containerOpacity.toFixed(2);
                    if (containerOpacity > 0.1) {
                        this.container.style.visibility = 'visible';
                    }
                }

                document.body.classList.remove('nav-collapsed');
            }
        }
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
     * Expand the navigation panel
     */
    expand() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        // Immediately update internal state
        this.isCollapsed = false;

        // Set width based on device
        const targetWidth = this.isMobile ? '280px' : this.lastWidth || '280px';

        // First make the nav wider - this triggers the transition
        this.nav.style.width = targetWidth;

        // Make container visible BEFORE removing collapsed class
        const container = this.nav.querySelector('.u-container');
        if (container) {
            // Reset any inline styles that might be affecting content sizing
            container.style.removeProperty('width');
            container.style.removeProperty('padding');
            container.style.opacity = '0'; // Start invisible
            container.style.visibility = 'visible'; // But make it visible in DOM

            // Slight delay to allow the width change to take effect
            setTimeout(() => {
                // Now fade it in
                container.style.opacity = '1';
                // Remove collapsed class to restore normal sizing
                container.classList.remove('collapsed');
                // Set proper overflow to allow content to be visible
                container.style.overflow = 'visible';
                container.style.overflowY = 'auto';
                container.style.overflowX = 'hidden';

                // Update body class
                document.body.classList.remove('nav-collapsed');

                // Reset animation state
                setTimeout(() => {
                    this.isAnimating = false;
                    // Ensure content is properly sized
                    container.style.removeProperty('transform');
                    container.style.removeProperty('width');
                    container.style.width = 'auto'; // Force fit-content behavior
                }, 350); // Match transition time
            }, 50);
        } else {
            document.body.classList.remove('nav-collapsed');
            setTimeout(() => this.isAnimating = false, 350);
        }
    }

    /**
     * Toggle navigation open/closed
     */
    toggleNavigation(e) {
        if (e) e.preventDefault();
        if (this.isAnimating) return;

        // Get the current visible state by checking multiple properties
        const container = this.nav.querySelector('.u-container');
        const isCurrentlyCollapsed = container &&
            (container.classList.contains('collapsed') ||
             container.style.visibility === 'hidden' ||
             parseFloat(container.style.opacity || '1') < 0.1 ||
             parseInt(this.nav.style.width || '280') <= 30);

        if (isCurrentlyCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * Collapse the navigation
     */
    collapse() {
        // Set width to collapsed state
        this.nav.style.width = '20px';

        // Apply collapsed state to container
        if (this.container) {
            // First fade out content
            this.container.style.opacity = '0';
            this.container.style.visibility = 'hidden';

            // Then collapse the container
            this.container.style.width = '0';
            this.container.style.padding = '0';
            this.container.style.pointerEvents = 'none';

            // Add collapsed class
            this.container.classList.add('collapsed');
        }

        // Update body class for content adjustment
        document.body.classList.add('nav-collapsed');
    }
}

export default Navigation;