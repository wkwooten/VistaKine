/**
 * VistaKine Navigation Module
 * Handles all navigation-related functionality in a centralized way
 */

// Ensure VistaKine namespace exists
window.VistaKine = window.VistaKine || {};

// Navigation module
VistaKine.navigation = {
    // State
    state: {
        currentSection: null,
        navInitialized: false
    },

    /**
     * Initialize navigation
     */
    init: function() {
        if (VistaKine.navigation.state.navInitialized) {
            VistaKine.utils.log('Navigation already initialized', 'warn');
            return;
        }

        VistaKine.utils.log('Initializing navigation module');

        // Setup navigation links
        VistaKine.navigation.setupLinks();

        // Setup bottom navigation
        VistaKine.navigation.setupBottomNav();

        // Handle initial hash
        VistaKine.navigation.handleInitialHash();

        // Listen for hash changes
        window.addEventListener('hashchange', VistaKine.navigation.handleHashChange);

        // Mark as initialized
        VistaKine.navigation.state.navInitialized = true;
        VistaKine.state.initialized.navigation = true;

        VistaKine.utils.log('Navigation initialized successfully', 'success');
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
            newLink.addEventListener('click', VistaKine.navigation.handleNavClick);
        });

        // Add section numbers if needed
        VistaKine.navigation.addSectionNumbers();
    },

    /**
     * Handle navigation link clicks
     */
    handleNavClick: function(e) {
        const href = this.getAttribute('href');
        if (!href || !href.startsWith('#')) return;

        const targetId = href.substring(1);
        VistaKine.utils.log(`Navigation link clicked: ${targetId}`);

        const targetSection = VistaKine.dom.getSection(targetId);
        if (!targetSection) {
            VistaKine.utils.log(`Target section #${targetId} not found`, 'warn');
            return;
        }

        // Prevent default only after confirming target exists
        e.preventDefault();

        // Scroll to the section
        targetSection.scrollIntoView({ behavior: 'smooth' });

        // Update URL without causing a jump
        history.pushState(null, null, href);

        // Update active section
        VistaKine.navigation.setActiveSection(targetId);

        // On mobile, close the sidebar
        if (VistaKine.utils.isMobileDevice() || VistaKine.utils.isTabletDevice()) {
            const sidebar = VistaKine.dom.getSidebar();
            if (sidebar) {
                sidebar.classList.remove('active');
            }
        }

        // Force load the content if needed
        VistaKine.navigation.ensureSectionLoaded(targetSection);
    },

    /**
     * Handle initial URL hash to scroll to the right section
     */
    handleInitialHash: function() {
        let targetId = window.location.hash.substring(1); // Remove the #

        // Default to 'cover' if no hash
        if (!targetId) {
            targetId = 'cover';
        }

        VistaKine.utils.log(`Initial hash: ${targetId}`);

        // Scroll to the section
        const targetSection = VistaKine.dom.getSection(targetId);
        if (targetSection) {
            // Slight delay to ensure everything is ready
            setTimeout(() => {
                targetSection.scrollIntoView({ behavior: 'auto' });
                VistaKine.navigation.setActiveSection(targetId);

                // Ensure content is loaded
                VistaKine.navigation.ensureSectionLoaded(targetSection);
            }, 100);
        } else {
            VistaKine.utils.log(`Target section #${targetId} not found`, 'warn');
        }
    },

    /**
     * Handle URL hash changes
     */
    handleHashChange: function() {
        const targetId = window.location.hash.substring(1);
        if (!targetId) return;

        VistaKine.utils.log(`Hash changed to: ${targetId}`);
        VistaKine.navigation.setActiveSection(targetId);
    },

    /**
     * Set the active section and update UI
     */
    setActiveSection: function(sectionId) {
        if (VistaKine.navigation.state.currentSection === sectionId) return;

        VistaKine.utils.log(`Setting active section: ${sectionId}`);
        VistaKine.navigation.state.currentSection = sectionId;

        // Update active class on sections
        document.querySelectorAll('.section-container').forEach(section => {
            section.classList.remove('active');
        });

        const activeSection = VistaKine.dom.getSection(sectionId);
        if (activeSection) {
            activeSection.classList.add('active');
        }

        // Update active links in navigation
        VistaKine.navigation.updateActiveNavLinks(sectionId);

        // Update bottom navigation text
        VistaKine.navigation.updateBottomNavigation(sectionId);

        // Update state
        VistaKine.state.activeSection = sectionId;
    },

    /**
     * Update the active links in the navigation
     */
    updateActiveNavLinks: function(sectionId) {
        // Remove active class from all nav links
        document.querySelectorAll('.nav-chapter, .nav-subchapter').forEach(link => {
            link.classList.remove('active');
        });

        // Set active class on matching links
        const selector = `.nav-chapter[href="#${sectionId}"], .nav-subchapter[href="#${sectionId}"]`;
        const activeLinks = document.querySelectorAll(selector);

        activeLinks.forEach(link => {
            link.classList.add('active');

            // If it's a subchapter, also activate its parent chapter
            if (link.classList.contains('nav-subchapter')) {
                const parentList = link.closest('.subchapter-list');
                if (parentList) {
                    const parentChapter = parentList.previousElementSibling;
                    if (parentChapter && parentChapter.classList.contains('nav-chapter')) {
                        parentChapter.classList.add('parent-active');
                    }
                }
            }
        });
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

            // Check if page number already exists
            if (!link.querySelector('.page-num')) {
                const pageNum = document.createElement('span');
                pageNum.className = 'page-num';

                // Create icon element
                const icon = document.createElement('i');
                icon.className = 'ph ph-hash';

                // Add icon and number to the page number element
                pageNum.appendChild(icon);
                pageNum.appendChild(document.createTextNode(chapterNum));

                link.appendChild(pageNum);
            }
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

                // Manually handle navigation to ensure proper loading
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                    VistaKine.navigation.setActiveSection(targetId);
                    VistaKine.navigation.ensureSectionLoaded(targetSection);
                }
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

                // Manually handle navigation to ensure proper loading
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                    VistaKine.navigation.setActiveSection(targetId);
                    VistaKine.navigation.ensureSectionLoaded(targetSection);
                }
            }
        }
    },

    /**
     * Update bottom navigation text and state
     */
    updateBottomNavigation: function(sectionId) {
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
     * Find the currently visible section in the viewport
     */
    findVisibleSection: function() {
        const sections = VistaKine.dom.getSections();
        if (!sections || sections.length === 0) return null;

        // Find the section that occupies the most viewport space
        let bestSection = null;
        let bestVisibleArea = 0;

        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Calculate visible area
            const top = Math.max(0, rect.top);
            const bottom = Math.min(viewportHeight, rect.bottom);
            const visibleHeight = Math.max(0, bottom - top);

            if (visibleHeight > bestVisibleArea) {
                bestVisibleArea = visibleHeight;
                bestSection = section;
            }
        });

        return bestSection;
    }
};

// Initialize when core is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if core is initialized before proceeding
    const initInterval = setInterval(function() {
        if (window.VistaKine && VistaKine.state && VistaKine.state.initialized.core) {
            clearInterval(initInterval);
            VistaKine.navigation.init();
        }
    }, 50);
});