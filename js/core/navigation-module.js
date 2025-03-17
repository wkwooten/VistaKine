/**
 * VistaKine Navigation Module
 *
 * This module manages all navigation-related functionality in the application, including:
 *
 * 1. USER NAVIGATION: Handles link clicks, hash changes, and direct URL navigation
 * 2. SECTION TRACKING: Uses IntersectionObserver to efficiently track visible sections
 * 3. STATE MANAGEMENT: Updates the central state with current section information
 * 4. RESPONSIVE BEHAVIOR: Provides device-specific navigation optimizations
 * 5. BOTTOM NAVIGATION: Implements prev/next navigation functionality
 *
 * Key architectural features:
 * - Uses efficient IntersectionObserver for scroll detection instead of scroll events
 * - Provides a scroll observer as backup for the IntersectionObserver
 * - Works with the centralized state system for reactive UI updates
 * - Handles both automatic (scroll) and manual (click) navigation
 */

// Ensure VistaKine namespace exists
window.VistaKine = window.VistaKine || {};

// Navigation module
VistaKine.navigation = {
    // Module state (only internal properties not duplicated in central state)
    state: {
        navInitialized: false,
        visibleSections: [],
        observer: null,
        pendingUpdate: null,
        isDirectNavigation: false,
        updateDebounceTime: 150,
        navigationLock: false,          // Add navigation lock flag
        navigationLockDuration: 1200    // Lock duration in milliseconds (1.2 seconds)
    },

    /**
     * Initialize navigation
     */
    init: function() {
        // Only initialize once
        if (this.state.navInitialized) {
            VistaKine.utils.log('Navigation already initialized');
            return;
        }

        VistaKine.utils.log('Initializing navigation module');

        // Set up the primary navigation system - IntersectionObserver only
        this.setupIntersectionObserver();

        // Set up event handlers for direct navigation
        this.setupHashChangeHandler();
        this.setupLinkClickHandler();

        // Initialize bottom navigation
        this.setupBottomNav();

        // Get initial section from the URL hash
        const hash = window.location.hash.substring(1);
        const initialSection = hash || 'cover';

        // Set initial navigation state
        if (initialSection) {
            this.setActiveSection(initialSection);

            // If the hash doesn't match the initial section, update it
            if (hash !== initialSection) {
                window.location.hash = '#' + initialSection;
            }
        }

        this.state.navInitialized = true;
        VistaKine.utils.log('Navigation module initialized');
    },

    /**
     * Set up all navigation links
     */
    setupLinks: function() {
        const navLinks = VistaKine.dom.getNavLinks();
        VistaKine.utils.log(`Setting up ${navLinks.length} navigation links`);

        navLinks.forEach(link => {
            // Remove any existing event listeners by cloning
            const newLink = link.cloneNode(true);
            if (link.parentNode) {
                link.parentNode.replaceChild(newLink, link);
            }

            // Add click handler
            newLink.addEventListener('click', VistaKine.navigation.handleLinkClick);
        });

        // Add section numbers if needed
        VistaKine.navigation.addSectionNumbers();
    },

    /**
     * Handle clicks on navigation links
     */
    handleLinkClick: function(e) {
        // Check if this is a navigation link (has href starting with #)
        const link = e.currentTarget;

        if (!link || !link.getAttribute('href') || !link.getAttribute('href').startsWith('#')) {
            return true; // Let the default behavior handle external links
        }

        // Get the target section ID
        const targetId = link.getAttribute('href').substring(1);
        if (!targetId) return true;

        e.preventDefault(); // Prevent default anchor behavior

        // Set the direct navigation flag to true for better scrolling behavior
        VistaKine.navigation.state.isDirectNavigation = true;

        // Log the navigation
        VistaKine.utils.log(`Navigation: Clicking link to ${targetId}`);

        // Determine if this is a subchapter link
        const isSubchapter = link.classList.contains('nav-subchapter');

        // Update URL hash (which will trigger hash change handler)
        window.location.hash = targetId;

        // For tablet/mobile views, close the sidebar after navigation
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && window.innerWidth <= 991) {
            sidebar.classList.remove('active');
        }

        return false;
    },

    /**
     * Handle initial URL hash to scroll to the right section
     */
    handleInitialHash: function() {
        let targetId = window.location.hash.substring(1); // Remove the #

        // Default to 'cover' if no hash
        if (!targetId) {
            targetId = 'cover';
            history.replaceState(null, null, '#cover');
        }

        VistaKine.utils.log(`Initial section from hash: ${targetId}`);

        // Use the helper method for consistent behavior
        setTimeout(() => {
            VistaKine.navigation.ensureSectionVisible(targetId);
        }, 500); // Slight delay to ensure DOM is ready
    },

    /**
     * Handle URL hash changes
     */
    handleHashChange: function() {
        const targetId = window.location.hash.substring(1);
        if (!targetId) return;

        VistaKine.utils.log(`Hash changed to: ${targetId}`);

        // Use the helper method for consistent behavior
        VistaKine.navigation.ensureSectionVisible(targetId);
    },

    /**
     * Set the active section and update the UI accordingly
     * @param {string} sectionId - The ID of the section to activate
     */
    setActiveSection: function(sectionId) {
        if (!sectionId) {
            VistaKine.utils.log('Cannot set active section: No section ID provided', 'error');
            return;
        }

        const previousSection = VistaKine.state.getCurrentSection();

        // Don't update if it's the same section
        if (sectionId === previousSection) {
            return;
        }

        VistaKine.utils.log(`Setting active section: ${sectionId} (was: ${previousSection})`, 'debug');

        // Update the state system first (single source of truth)
        VistaKine.state.setCurrentSection(sectionId);

        // Update the UI
        this.updateActiveLink(sectionId);

        // Trigger section change event for other modules
        document.dispatchEvent(new CustomEvent('sectionChanged', {
            detail: {
                newSection: sectionId,
                previousSection: previousSection
            }
        }));
    },

    /**
     * Update the active link in the navigation menu
     * @param {string} sectionId - The ID of the section to mark as active
     */
    updateActiveLink: function(sectionId) {
        if (!sectionId) {
            return;
        }

        VistaKine.utils.log(`Updating navigation for section: ${sectionId}`);

        // Remove active class from all nav links
        document.querySelectorAll('.nav-chapter.active, .nav-subchapter.active, .nav-chapter.parent-active').forEach(link => {
            link.classList.remove('active');
            link.classList.remove('parent-active');
        });

        // Set active class on matching links
        const selector = `.nav-chapter[href="#${sectionId}"], .nav-subchapter[href="#${sectionId}"]`;
        const activeLinks = document.querySelectorAll(selector);

        if (activeLinks.length > 0) {
            activeLinks.forEach(link => {
                link.classList.add('active');
            });

            // For subchapters, also mark the parent chapter
            if (sectionId.includes('-') && activeLinks[0]) {
                const subchapterLink = activeLinks[0];
                const parentList = subchapterLink.closest('.subchapter-list');

                if (parentList) {
                    const parentChapter = parentList.previousElementSibling;
                    if (parentChapter && parentChapter.classList.contains('nav-chapter')) {
                        parentChapter.classList.add('parent-active');
                    }
                }
            }
        } else if (sectionId.includes('chapter')) {
            // Extract chapter number for subchapters
            const chapterMatch = sectionId.match(/chapter(\d+)/i);
            if (chapterMatch) {
                const chapterNum = parseInt(chapterMatch[1]);
                const parentSelector = `.nav-chapter[href="#chapter${chapterNum}"], .nav-chapter[href="#chapter${chapterNum}-intro"]`;
                document.querySelectorAll(parentSelector).forEach(link => {
                    link.classList.add('active');
                });
            }
        }

        // Trigger any other UI updates from one central place
        this.updateBottomNav(sectionId);
        this.updateDocumentTitle(sectionId);

        // Trigger section management if content module is initialized
        if (VistaKine.state.isInitialized('content') &&
            typeof VistaKine.content.manageLoadedSections === 'function') {
            setTimeout(() => {
                VistaKine.content.manageLoadedSections(sectionId);
            }, 300);
        }
    },

    /**
     * Ensure a section's content is loaded
     */
    ensureSectionLoaded: function(sectionElement) {
        if (!sectionElement) return;

        const sectionId = sectionElement.id;

        // Check if already loaded
        if (VistaKine.state.loadedSections.has(sectionId)) {
            VistaKine.utils.log(`Section ${sectionId} already loaded`);
            return;
        }

        // Try to load the section content
        if (typeof VistaKine.content !== 'undefined' && VistaKine.content.loadSection) {
            VistaKine.utils.log(`Loading content for section: ${sectionId}`);
            VistaKine.content.loadSection(sectionElement);
        } else if (window.loadSectionContent) {
            // Fallback to window function if module not available
            VistaKine.utils.log(`Using global loadSectionContent for: ${sectionId}`);
            window.loadSectionContent(sectionElement);
        }
    },

    /**
     * Add section numbers to navigation items
     */
    addSectionNumbers: function() {
        const chapterLinks = document.querySelectorAll('.nav-chapter');

        // Skip the cover, about, and chapters pages
        for (let i = 3; i < chapterLinks.length; i++) {
            const link = chapterLinks[i];
            const chapterNum = i - 2; // Adjust numbering to start after special sections

            // Page numbers are no longer needed
            // We've removed this functionality

            // Create icon element
        }
    },

    /**
     * Setup bottom navigation functionality
     */
    setupBottomNav: function() {
        const prevNavBtn = document.querySelector('.prev-nav');
        const nextNavBtn = document.querySelector('.next-nav');

        if (!prevNavBtn || !nextNavBtn) {
            VistaKine.utils.log('Bottom navigation buttons not found', 'warn');
            return;
        }

        // Remove existing event listeners
        const newPrevBtn = prevNavBtn.cloneNode(true);
        const newNextBtn = nextNavBtn.cloneNode(true);

        prevNavBtn.parentNode.replaceChild(newPrevBtn, prevNavBtn);
        nextNavBtn.parentNode.replaceChild(newNextBtn, nextNavBtn);

        // Add new event listeners
        newPrevBtn.addEventListener('click', VistaKine.navigation.goToPrevious);
        newNextBtn.addEventListener('click', VistaKine.navigation.goToNext);
    },

    /**
     * Go to previous section
     */
    goToPrevious: function() {
        const navLinks = Array.from(document.querySelectorAll('.nav-chapter, .nav-subchapter'));
        const currentSection = VistaKine.navigation.state.currentSection;

        if (!currentSection || navLinks.length === 0) return;

        // Find current index
        const activeLink = document.querySelector(`.nav-chapter[href="#${currentSection}"], .nav-subchapter[href="#${currentSection}"]`);
        if (!activeLink) return;

        const currentIndex = navLinks.indexOf(activeLink);
        if (currentIndex > 0) {
            const prevLink = navLinks[currentIndex - 1];
            if (prevLink && prevLink.getAttribute('href')) {
                const targetId = prevLink.getAttribute('href').replace('#', '');
                VistaKine.utils.log(`Navigating to previous section: ${targetId}`);

                // Update URL
                window.location.hash = targetId;

                // Use the helper method for consistent behavior
                VistaKine.navigation.ensureSectionVisible(targetId);
            }
        }
    },

    /**
     * Go to next section
     */
    goToNext: function() {
        const navLinks = Array.from(document.querySelectorAll('.nav-chapter, .nav-subchapter'));
        const currentSection = VistaKine.navigation.state.currentSection;

        if (!currentSection || navLinks.length === 0) return;

        // Find current index
        const activeLink = document.querySelector(`.nav-chapter[href="#${currentSection}"], .nav-subchapter[href="#${currentSection}"]`);
        if (!activeLink) return;

        const currentIndex = navLinks.indexOf(activeLink);
        if (currentIndex < navLinks.length - 1) {
            const nextLink = navLinks[currentIndex + 1];
            if (nextLink && nextLink.getAttribute('href')) {
                const targetId = nextLink.getAttribute('href').replace('#', '');
                VistaKine.utils.log(`Navigating to next section: ${targetId}`);

                // Update URL
                window.location.hash = targetId;

                // Use the helper method for consistent behavior
                VistaKine.navigation.ensureSectionVisible(targetId);
            }
        }
    },

    /**
     * Update bottom navigation text and state
     */
    updateBottomNav: function(sectionId) {
        const currentSectionSpan = document.querySelector('.current-section-name');
        if (!currentSectionSpan) return;

        // Find the active link to get its text
        const activeLink = document.querySelector(`.nav-chapter[href="#${sectionId}"], .nav-subchapter[href="#${sectionId}"]`);
        if (activeLink) {
            // Get text but remove any numbers at the end (section numbers)
            let linkText = activeLink.textContent.trim();
            linkText = linkText.replace(/\d+$/, '').trim();

            // Update bottom navigation text
            currentSectionSpan.textContent = linkText;
        }
    },

    /**
     * Find the most visible section based on current visibility data
     * This is used by external callers who need to check visibility
     * @returns {Element|null} The most visible section or null
     */
    findVisibleSection: function() {
        // If we don't have any visible sections, return null
        if (!this.state.visibleSections || this.state.visibleSections.length === 0) {
            return null;
        }

        // Get current active section
        const currentSection = VistaKine.state.getCurrentSection();

        // Find the best section to return
        let bestSection = this.state.visibleSections[0]; // Most visible by default

        // Special handling for the cover section - prioritize it if very visible
        const coverSection = this.state.visibleSections.find(s => s.id === 'cover');
        if (coverSection && coverSection.ratio > 0.5) {
            bestSection = coverSection;
        }

        // Add slight preference for the current section to prevent flickering
        const currentSectionInView = this.state.visibleSections.find(s => s.id === currentSection);
        if (currentSectionInView &&
            currentSectionInView.ratio > 0.4 &&
            bestSection.ratio - currentSectionInView.ratio < 0.2) {
            bestSection = currentSectionInView;
        }

        return bestSection ? bestSection.element : null;
    },

    /**
     * Set up IntersectionObserver for section visibility detection
     */
    setupIntersectionObserver: function() {
        // Clear any existing observer
        if (this.state.observer) {
            this.state.observer.disconnect();
        }

        // Initialize state
        this.state.visibleSections = [];
        this.state.pendingUpdate = null;
        this.state.isDirectNavigation = false;

        const options = {
            root: null, // Use viewport
            rootMargin: '0px',
            threshold: [0.1, 0.5, 0.9] // Just enough thresholds to determine visibility levels
        };

        this.state.observer = new IntersectionObserver((entries) => {
            // Skip updates during navigation lock or direct navigation
            if (this.state.navigationLock || this.state.isDirectNavigation) {
                VistaKine.utils.log('Skipping intersection updates due to active navigation lock', 'debug');
                return;
            }

            // Process entries and update visibleSections
            entries.forEach(entry => {
                const sectionId = entry.target.id;
                const index = this.state.visibleSections.findIndex(s => s.id === sectionId);

                if (entry.isIntersecting) {
                    // Add or update section in the visible list
                    const visibilityScore = entry.intersectionRatio;

                    if (index === -1) {
                        this.state.visibleSections.push({
                            id: sectionId,
                            ratio: visibilityScore,
                            element: entry.target
                        });
                    } else {
                        this.state.visibleSections[index].ratio = visibilityScore;
                    }

                    // If section content isn't loaded yet, load it
                    if (VistaKine.state.isInitialized('content') &&
                        !VistaKine.state.isSectionLoaded(sectionId)) {
                        VistaKine.content.loadSection(entry.target);
                    }
                } else if (index !== -1) {
                    // Remove from visible list if no longer intersecting
                    this.state.visibleSections.splice(index, 1);
                }
            });

            // Sort visible sections by visibility ratio
            this.state.visibleSections.sort((a, b) => b.ratio - a.ratio);

            // Debounce the section update to prevent rapid changes
            if (this.state.pendingUpdate) {
                clearTimeout(this.state.pendingUpdate);
            }

            this.state.pendingUpdate = setTimeout(() => {
                this.updateActiveFromVisibleSections();
                this.state.pendingUpdate = null;
            }, this.state.updateDebounceTime);
        }, options);

        // Observe all sections
        const sections = VistaKine.dom.getSections();
        sections.forEach(section => {
            this.state.observer.observe(section);
        });

        VistaKine.utils.log(`IntersectionObserver set up with ${sections.length} sections`);
    },

    /**
     * Update active section based on visible sections
     */
    updateActiveFromVisibleSections: function() {
        // Skip updates if navigation is locked or if there's a direct navigation in progress
        if (this.state.navigationLock || this.state.isDirectNavigation) {
            VistaKine.utils.log('Skipping automatic section update due to navigation lock', 'debug');
            return;
        }

        // Get current active section from state
        const currentSection = VistaKine.state.getCurrentSection();

        // Find most visible section
        if (!this.state.visibleSections || this.state.visibleSections.length === 0) {
            return; // No visible sections to update from
        }

        // Find the best section to make active
        const bestSection = this.findBestVisibleSection();

        // Update if we have a valid section that's different from current
        if (bestSection && bestSection.id !== currentSection) {
            VistaKine.utils.log(`Auto-updating to section: ${bestSection.id} (visibility: ${bestSection.ratio.toFixed(2)})`, 'debug');
            this.setActiveSection(bestSection.id);
        }
    },

    /**
     * Find the best section to make active based on visibility
     * @returns {Object|null} Best section object or null if none found
     */
    findBestVisibleSection: function() {
        if (!this.state.visibleSections || this.state.visibleSections.length === 0) {
            return null;
        }

        // Get current active section
        const currentSection = VistaKine.state.getCurrentSection();

        // Start with the most visible section as default
        let bestSection = this.state.visibleSections[0];

        // Special handling for the cover section - prioritize it if very visible
        const coverSection = this.state.visibleSections.find(s => s.id === 'cover');
        if (coverSection && coverSection.ratio > 0.5) {
            bestSection = coverSection;
        }

        // Add slight preference for the current section to prevent flickering
        // This creates stability by requiring a significant change to switch sections
        const currentSectionInView = this.state.visibleSections.find(s => s.id === currentSection);
        if (currentSectionInView &&
            currentSectionInView.ratio > 0.4 &&
            bestSection.ratio - currentSectionInView.ratio < 0.2) {
            bestSection = currentSectionInView;
        }

        return bestSection;
    },

    /**
     * Ensure a section is visible to the user
     * Used for direct navigation (links, hash changes)
     * @param {string} sectionId - ID of the section to display
     */
    ensureSectionVisible: function(sectionId) {
        if (!sectionId) {
            VistaKine.utils.log('Cannot navigate: No section ID provided', 'error');
            return;
        }

        const section = document.getElementById(sectionId);
        if (!section) {
            VistaKine.utils.log(`Cannot navigate: Section "${sectionId}" not found`, 'error');
            return;
        }

        VistaKine.utils.log(`Direct navigation to section: ${sectionId}`);

        // Set navigation lock to prioritize user intent
        this.state.navigationLock = true;
        VistaKine.utils.log(`Navigation lock activated for ${this.state.navigationLockDuration}ms - user intent prioritized`, 'info');

        // Set direct navigation flag to temporarily pause automatic updates
        this.state.isDirectNavigation = true;

        // Ensure the section is loaded
        if (VistaKine.state.isInitialized('content') && !VistaKine.state.isSectionLoaded(sectionId)) {
            VistaKine.content.loadSection(section);
        }

        // Update active section immediately
        this.setActiveSection(sectionId);

        // Scroll to the section
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // After navigation completes, re-enable automatic updates
        setTimeout(() => {
            this.state.isDirectNavigation = false;

            // Load adjacent sections for smoother experience
            if (VistaKine.state.isInitialized('content')) {
                this.loadAdjacentSections(sectionId);
            }

            // Release the navigation lock after the specified duration
            setTimeout(() => {
                VistaKine.utils.log('Navigation lock released - resuming normal operation', 'info');
                this.state.navigationLock = false;
            }, this.state.navigationLockDuration - 800); // Subtract the time already waited

        }, 800); // Allow time for smooth scroll to complete
    },

    /**
     * Load content for sections adjacent to the current one
     * @param {string} sectionId - ID of the current section
     */
    loadAdjacentSections: function(sectionId) {
        const allSections = Array.from(VistaKine.dom.getSections());
        const currentIndex = allSections.findIndex(section => section.id === sectionId);

        if (currentIndex === -1) return;

        // Preload previous and next sections if they exist
        [-1, 1].forEach(offset => {
            const adjacentIndex = currentIndex + offset;
            if (adjacentIndex >= 0 && adjacentIndex < allSections.length) {
                const adjacentSection = allSections[adjacentIndex];
                if (!VistaKine.state.isSectionLoaded(adjacentSection.id)) {
                    VistaKine.utils.log(`Preloading adjacent section: ${adjacentSection.id}`, 'debug');
                    VistaKine.content.loadSection(adjacentSection);
                }
            }
        });
    },

    /**
     * Update the document title
     */
    updateDocumentTitle: function(sectionId) {
        if (!sectionId) return;

        // Find the active link to get its text
        const activeLink = document.querySelector(`.nav-chapter[href="#${sectionId}"], .nav-subchapter[href="#${sectionId}"]`);
        if (activeLink) {
            // Get text but remove any numbers at the end (section numbers)
            let linkText = activeLink.textContent.trim();
            linkText = linkText.replace(/\d+$/, '').trim();

            // Update document title
            document.title = linkText;
        }
    },

    /**
     * Set up the hash change handler
     * This handles direct URL navigation and the browser back/forward buttons
     */
    setupHashChangeHandler: function() {
        window.addEventListener('hashchange', function(e) {
            const hash = window.location.hash.substring(1);
            if (hash) {
                VistaKine.utils.log(`Hash changed to: ${hash}`);
                VistaKine.navigation.ensureSectionVisible(hash);
            }
        });

        VistaKine.utils.log('Hash change handler set up');
    },

    /**
     * Set up handler for navigation link clicks
     */
    setupLinkClickHandler: function() {
        // Store reference to this for use in event handlers
        const self = this;

        // Select all navigation links
        const navLinks = document.querySelectorAll('.nav-chapter, .nav-subchapter');

        // Add click event handler to each link
        navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                // Get target section ID from link href
                const href = link.getAttribute('href');
                if (!href || !href.startsWith('#')) return;

                const targetId = href.substring(1);

                // Prevent default behavior to handle navigation in JS
                event.preventDefault();

                // Update URL hash (this will trigger hashchange)
                window.location.hash = targetId;

                // Set navigation lock to prioritize user intent
                self.state.navigationLock = true;

                // Use the helper method to handle navigation
                self.ensureSectionVisible(targetId);
            });
        });

        // Also handle the bottom navigation buttons
        const prevButton = document.querySelector('.prev-nav');
        const nextButton = document.querySelector('.next-nav');

        if (prevButton) {
            prevButton.addEventListener('click', () => {
                // Set navigation lock to prioritize user intent
                self.state.navigationLock = true;
                self.goToPrevious();
            });
        }

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                // Set navigation lock to prioritize user intent
                self.state.navigationLock = true;
                self.goToNext();
            });
        }

        VistaKine.utils.log('Navigation link handlers set up');
    },

    /**
     * Reset the navigation state
     * For backward compatibility - recenter's the current section
     */
    resetNavigationState: function() {
        VistaKine.utils.log('Navigation reset requested');

        // Simply re-focus on the current section
        const currentSection = VistaKine.state.getCurrentSection();
        if (currentSection) {
            this.ensureSectionVisible(currentSection);
        }
    },
};

// Initialize when core is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if core is initialized before proceeding
    const initInterval = setInterval(function() {
        if (window.VistaKine && VistaKine.state && VistaKine.state.isInitialized('core')) {
            clearInterval(initInterval);
            VistaKine.navigation.init();
        }
    }, 50);
});