class Navigation {
    constructor() {
        this.nav = document.getElementById('chapter-nav');
        this.container = this.nav.querySelector('.u-container');
        this.showNavToggle = document.getElementById('show-nav-toggle');
        this.isResizing = false;
        this.minWidth = 100;
        this.maxWidth = 600;
        this.defaultWidth = 280;
        this.collapseThreshold = 80; // Collapse fully when dragged below this width
        this.snapPoints = [150, 280, 350]; // Updated snap points to include new default
        this.isMobile = window.innerWidth <= 768;

        // Create resize handle
        this.handle = document.createElement('div');
        this.handle.className = 'resize-handle';
        this.handle.setAttribute('aria-label', 'Resize navigation panel');
        this.handle.setAttribute('role', 'slider');
        this.nav.appendChild(this.handle);

        // Create a visual pull tab inside the resize handle
        this.pullTab = document.createElement('div');
        this.pullTab.className = 'pull-tab';
        this.handle.appendChild(this.pullTab);

        this.init();
    }

    init() {
        // Mouse events
        this.handle.addEventListener('mousedown', this.startResize.bind(this));
        document.addEventListener('mousemove', this.handleResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));

        // Touch events with improved handling
        this.handle.addEventListener('touchstart', this.startTouchResize.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchResize.bind(this), { passive: false });
        document.addEventListener('touchend', this.stopResize.bind(this));
        document.addEventListener('touchcancel', this.stopResize.bind(this));

        // Double click to reset width
        this.handle.addEventListener('dblclick', () => {
            if (this.nav.classList.contains('collapsed')) {
                this.expand();
            } else {
                this.setWidth(this.defaultWidth);
            }
        });

        // Show nav toggle click
        this.showNavToggle.addEventListener('click', () => {
            this.expand();
        });

        // Update isMobile on window resize
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
        });
    }

    startTouchResize(e) {
        // Prevent default to avoid scrolling while resizing
        e.preventDefault();
        this.isResizing = true;
        this.startX = e.touches[0].clientX;
        this.startWidth = this.nav.offsetWidth;
        document.body.classList.add('resizing');

        // Add feedback class for better visual cues
        this.handle.classList.add('active');
    }

    handleTouchResize(e) {
        if (!this.isResizing) return;

        // Prevent scrolling during resize
        e.preventDefault();

        // Get current touch position
        const touchX = e.touches[0].clientX;
        this.processResize(touchX);
    }

    startResize(e) {
        this.isResizing = true;
        this.startX = e.clientX;
        this.startWidth = this.nav.offsetWidth;
        document.body.classList.add('resizing');
        this.handle.classList.add('active');
        e.preventDefault();
    }

    handleResize(e) {
        if (!this.isResizing) return;
        this.processResize(e.clientX);
    }

    processResize(clientX) {
        // Direct width setting for more responsive feel
        let newWidth = Math.min(Math.max(0, clientX), this.maxWidth);

        // Check if we're near a snap point (within 15px)
        const shiftKey = window.event && window.event.shiftKey;
        if (!shiftKey) { // Hold shift to bypass snapping
            for (const snapPoint of this.snapPoints) {
                if (Math.abs(newWidth - snapPoint) < 15) {
                    newWidth = snapPoint;
                    break;
                }
            }
        }

        // If we're below collapse threshold, gradually fade out content
        if (newWidth < this.collapseThreshold + 100) {
            // Calculate opacity based on how close we are to collapse threshold
            let opacity = (newWidth - this.collapseThreshold) / 100;
            opacity = Math.max(0, Math.min(1, opacity)); // Clamp between 0 and 1
            this.container.style.opacity = opacity.toFixed(2);
        } else {
            this.container.style.opacity = '1';
        }

        // Set the new width
        this.setWidth(newWidth);
    }

    stopResize() {
        if (!this.isResizing) return;

        this.isResizing = false;
        document.body.classList.remove('resizing');
        this.handle.classList.remove('active');

        // Snap decision on release
        const currentWidth = this.nav.offsetWidth;

        // Fully collapse if width is very small
        if (currentWidth < 30) {
            this.collapse();
        }
        // Snap to min width if smaller than threshold but not collapsed
        else if (currentWidth < this.collapseThreshold) {
            this.setWidth(this.minWidth);
            this.container.style.opacity = '1';
        }
    }

    collapse() {
        this.nav.classList.add('collapsed');
        document.body.classList.add('nav-collapsed');
        this.nav.style.width = '0';
        this.container.style.opacity = '1'; // Reset opacity for next expand

        // Make sure show nav toggle is visible
        this.showNavToggle.style.display = 'flex';
    }

    expand(width = this.defaultWidth) {
        this.nav.classList.remove('collapsed');
        document.body.classList.remove('nav-collapsed');
        this.setWidth(width);
        this.container.style.opacity = '1';
    }

    setWidth(width) {
        // Handle collapsing and expanding
        if (width < this.collapseThreshold) {
            // When width is very small, collapse completely
            if (width < 30) {
                this.nav.style.width = '0';
                this.nav.classList.add('collapsed');
                document.body.classList.add('nav-collapsed');

                // Keep pull tab visible even when collapsed for easier reopening
                if (this.pullTab) {
                    this.pullTab.style.opacity = '0.6';
                    this.pullTab.style.right = '-8px'; // Position it at the edge when collapsed
                }
            } else {
                this.nav.style.width = `${width}px`;
                this.nav.classList.remove('collapsed');
                document.body.classList.remove('nav-collapsed');

                // Reset pull tab position when not collapsed
                if (this.pullTab) {
                    this.pullTab.style.right = '1px';
                }
            }
        } else {
            // Normal resizing
            this.nav.style.width = `${width}px`;
            this.nav.classList.remove('collapsed');
            document.body.classList.remove('nav-collapsed');

            // Reset pull tab position
            if (this.pullTab) {
                this.pullTab.style.right = '1px';
            }
        }
    }
}

export default Navigation;