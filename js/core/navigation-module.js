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
        navInitialized: false,
        visibleSections: [],
        isDirectNavigation: false,
        scrollTimeout: null
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

        // DISABLED FOR TESTING - Start
        // Setup navigation links
        VistaKine.navigation.setupLinks();

        // Setup bottom navigation
        // VistaKine.navigation.setupBottomNav();

        // Set up the Intersection Observer for efficient section visibility detection
        // VistaKine.navigation.setupIntersectionObserver();

        // Handle initial hash
        // VistaKine.navigation.handleInitialHash();

        // Listen for hash changes
        // window.addEventListener('hashchange', VistaKine.navigation.handleHashChange);
        // DISABLED FOR TESTING - End

        // Mark as initialized
        VistaKine.navigation.state.navInitialized = true;
        VistaKine.state.initialized.navigation = true;

        VistaKine.utils.log('Navigation initialized successfully (TESTING MODE - scroll/hash features disabled)', 'success');
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
     * Set the active section and update UI
     */
    setActiveSection: function(sectionId) {
        // Skip if the section is already active
        if (VistaKine.navigation.state.currentSection === sectionId) return;

        // Handle null or empty section ID
        if (!sectionId) {
            VistaKine.utils.log('Cannot set active section: Invalid section ID', 'warn');
            return;
        }

        VistaKine.utils.log(`Setting active section: ${sectionId}`);

        // Store the previous section for debugging
        const previousSection = VistaKine.navigation.state.currentSection;

        // Check if we're transitioning between chapters
        const isChapterTransition = isBetweenChapters(previousSection, sectionId);
        if (isChapterTransition) {
            VistaKine.utils.log(`Chapter transition detected: ${previousSection} → ${sectionId}`, 'debug');
        }

        // Update state immediately
        VistaKine.navigation.state.currentSection = sectionId;
        VistaKine.state.activeSection = sectionId;

        // Update active class on sections
        document.querySelectorAll('.section-container').forEach(section => {
            section.classList.remove('active');
        });

        const activeSection = VistaKine.dom.getSection(sectionId);
        if (activeSection) {
            activeSection.classList.add('active');
        }

        // Update active links in navigation with enhanced chapter handling
        VistaKine.navigation.updateActiveNavLinks(sectionId);

        // Update bottom navigation text
        VistaKine.navigation.updateBottomNavigation(sectionId);

        // Helper function to check if transition is between chapters
        function isBetweenChapters(prev, current) {
            if (!prev || !current) return false;

            // Parse chapter numbers from section IDs
            const prevChapter = getChapterNumber(prev);
            const currChapter = getChapterNumber(current);

            // If different chapter numbers, it's a chapter transition
            return prevChapter !== currChapter;
        }

        // Helper to extract chapter number from section ID
        function getChapterNumber(sectionId) {
            // Handle common chapter ID patterns
            if (sectionId.includes('chapter')) {
                const match = sectionId.match(/chapter(\d+)/i);
                return match ? parseInt(match[1]) : null;
            }
            return null;
        }
    },

    /**
     * Update the active links in the navigation
     */
    updateActiveNavLinks: function(sectionId) {
        // Skip if invalid sectionId
        if (!sectionId) return;

        // Check device type
        const isMobile = window.matchMedia('(max-width: 479px)').matches;
        const isTablet = window.matchMedia('(min-width: 480px) and (max-width: 991px)').matches;

        // Store current scroll position of sidebar to restore it later if needed
        const sidebarNav = document.querySelector('.sidebar-nav');
        const currentScrollTop = sidebarNav ? sidebarNav.scrollTop : 0;

        // Remove active class from all nav links but keep track of previously active ones
        const previouslyActive = [];
        document.querySelectorAll('.nav-chapter.active, .nav-subchapter.active, .nav-chapter.parent-active').forEach(link => {
            previouslyActive.push(link.getAttribute('href'));
            link.classList.remove('active');
            link.classList.remove('parent-active');
        });

        // Check if we're dealing with a chapter or sub-chapter
        const isChapter = sectionId.includes('chapter') && !sectionId.includes('-');

        // Set active class on matching links
        const selector = `.nav-chapter[href="#${sectionId}"], .nav-subchapter[href="#${sectionId}"]`;
        const activeLinks = document.querySelectorAll(selector);

        if (activeLinks.length === 0) {
            VistaKine.utils.log(`No navigation links found for section: ${sectionId}`, 'warn');

            // If we're between chapters, try to find the nearest chapter
            if (sectionId.includes('chapter')) {
                // Extract chapter number or prefix
                let chapterPrefix = null;

                // Try to extract chapter prefix (e.g., "chapter1" from "chapter1-intro")
                const matchPrefix = sectionId.match(/^(chapter\d+)/i);
                if (matchPrefix) {
                    chapterPrefix = matchPrefix[1];
                    // Try to find the chapter link using the prefix
                    const chapterLink = document.querySelector(`.nav-chapter[href="#${chapterPrefix}"]`);
                    if (chapterLink) {
                        VistaKine.utils.log(`Found chapter link for ${sectionId} using prefix ${chapterPrefix}`, 'debug');
                        chapterLink.classList.add('active');

                        // Also try to find the subchapter if this is a subchapter
                        if (sectionId !== chapterPrefix) {
                            const subchapterLink = document.querySelector(`.nav-subchapter[href="#${sectionId}"]`);
                            if (subchapterLink) {
                                subchapterLink.classList.add('active');
                            }
                        }
                    }
                }
            }
            return;
        }

        // Modified scrollIntoView behavior for improved performance
        const handleScrollIntoView = () => {
            const activeLink = document.querySelector(`${selector}.active`);
            if (!activeLink || !sidebarNav) return;

            // Get sidebar state (expanded, mini-collapsed, etc.)
            const sidebar = document.querySelector('.sidebar');
            const sidebarState = sidebar ?
                (sidebar.classList.contains('mini-collapsed') ? 'mini' :
                 sidebar.classList.contains('active') ? 'active' : 'normal') : 'normal';

            // Calculate if link is out of view
            const linkRect = activeLink.getBoundingClientRect();
            const navRect = sidebarNav.getBoundingClientRect();

            // Only scroll into view if substantially out of view
            // This prevents small jumps when scrolling between nearby sections
            const isSubstantiallyOutOfView =
                linkRect.top < navRect.top - 20 ||
                linkRect.bottom > navRect.bottom + 20;

            // Different behavior based on device
            const isDirectNavigation = VistaKine.navigation.state.isDirectNavigation || false;

            // For mobile, we want more aggressive scrolling to ensure the active link is visible
            // even during normal scrolling, but with a higher threshold to prevent constant jumps
            if ((isSubstantiallyOutOfView && (!isTablet || isDirectNavigation)) ||
                (isMobile && Math.abs(linkRect.top - navRect.top) > 100)) {

                // Use requestAnimationFrame for smoother scrolling
                requestAnimationFrame(() => {
                    // Use a better scroll position that keeps context visible
                    const scrollBlock = isMobile ? 'center' : isTablet ? 'center' : 'nearest';
                    const scrollBehavior = isDirectNavigation ? 'smooth' : isMobile ? 'smooth' : 'auto';

                    // For mobile, only scroll if the sidebar is actually visible
                    if (!isMobile || (isMobile && sidebar && sidebar.classList.contains('active'))) {
                        activeLink.scrollIntoView({
                            behavior: scrollBehavior,
                            block: scrollBlock
                        });
                    }

                    // Reset direct navigation flag
                    VistaKine.navigation.state.isDirectNavigation = false;
                });
            }
        };

        // Only handle scroll into view after a small delay to avoid performance issues
        // This is especially important on tablets and mobile
        clearTimeout(VistaKine.navigation.state.scrollTimeout);
        VistaKine.navigation.state.scrollTimeout = setTimeout(
            handleScrollIntoView,
            isMobile ? 150 : isTablet ? 100 : 50
        );

        // Ensure active links are updated immediately
        if (activeLinks.length > 0) {
            activeLinks.forEach(link => {
                link.classList.add('active');

                // If it's a subchapter, also activate its parent chapter
                if (link.classList.contains('nav-subchapter')) {
                    const parentList = link.closest('.subchapter-list');
                    if (parentList) {
                        const parentChapter = parentList.previousElementSibling;
                        if (parentChapter && parentChapter.classList.contains('nav-chapter')) {
                            parentChapter.classList.add('parent-active');

                            // Handle mobile/tablet mini-collapsed mode
                            if (isMobile || isTablet) {
                                const sidebar = document.querySelector('.sidebar');
                                if (sidebar && (sidebar.classList.contains('mini-collapsed') || isMobile)) {
                                    // Ensure parent chapter is visibly marked on mobile
                                    parentChapter.style.backgroundColor = 'var(--active-bg)';

                                    // For mobile, ensure subchapter list is visible when parent is active
                                    if (isMobile && parentList) {
                                        parentList.style.display = 'flex';
                                        parentList.style.maxHeight = 'none';
                                        parentList.style.opacity = '1';
                                        parentList.style.visibility = 'visible';
                                    }
                                }
                            }
                        }
                    }
                }
            });
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

        // Check if we have cached information from IntersectionObserver
        if (VistaKine.navigation.state.visibleSections &&
            VistaKine.navigation.state.visibleSections.length > 0) {
            // Return the section with the highest intersection ratio
            return VistaKine.navigation.state.visibleSections[0].element;
        }

        // Fallback to the old method if observer isn't working
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
    },

    /**
     * Set up Intersection Observer for more efficient section detection
     */
    setupIntersectionObserver: function() {
        // Keep track of visible sections
        VistaKine.navigation.state.visibleSections = [];

        // Determine device type for optimized settings
        const isMobile = window.matchMedia('(max-width: 479px)').matches;
        const isTablet = window.matchMedia('(min-width: 480px) and (max-width: 991px)').matches;

        // Create the observer with settings optimized for device type
        const options = {
            root: null, // viewport
            // Different margins based on device type
            rootMargin: isMobile ?
                '50px 0px -5% 0px' : // Mobile has smaller margins (smaller screen)
                isTablet ?
                '100px 0px -5% 0px' : // Tablet margins
                '150px 0px -10% 0px', // Desktop margins
            // More granular thresholds for better detection
            threshold: isMobile || isTablet ?
                [0, 0.05, 0.1, 0.2, 0.3, 0.5] : // Fewer thresholds for mobile/tablet (better performance)
                [0, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5] // Desktop thresholds
        };

        // Track last section update time to prevent too frequent updates
        let lastUpdateTime = 0;
        const updateThrottleMs = isMobile ? 400 : isTablet ? 300 : 150; // More throttling on smaller devices

        VistaKine.navigation.observer = new IntersectionObserver((entries) => {
            // Flag to determine if we need to update the UI
            let hasChanges = false;

            // Current time to check for throttling
            const now = Date.now();

            // Skip processing if we've updated too recently (throttle)
            if (now - lastUpdateTime < updateThrottleMs) {
                return;
            }

            // Update our list of visible sections
            entries.forEach(entry => {
                // Only log significant intersection changes
                if (entry.isIntersecting) {
                    VistaKine.utils.log(`Section ${entry.target.id} is visible with ratio: ${entry.intersectionRatio.toFixed(3)}`, 'debug');
                }

                // Threshold is lower on mobile/tablet to ensure we catch sections
                const visibilityThreshold = isMobile ? 0.03 : isTablet ? 0.02 : 0.005;

                // Add to visible sections if intersecting with sufficient visibility
                if (entry.isIntersecting && entry.intersectionRatio > visibilityThreshold) {
                    // Check if this section is already in our visibleSections array
                    const existingIndex = VistaKine.navigation.state.visibleSections.findIndex(
                        item => item.element === entry.target
                    );

                    if (existingIndex >= 0) {
                        // Update the ratio
                        const oldRatio = VistaKine.navigation.state.visibleSections[existingIndex].ratio;
                        const newRatio = entry.intersectionRatio;

                        // Only mark as changed if the ratio changed significantly
                        // Use a higher threshold for tablets to prevent flickering
                        const changeThreshold = isTablet ? 0.05 : 0.02;

                        if (Math.abs(oldRatio - newRatio) > changeThreshold) {
                            VistaKine.navigation.state.visibleSections[existingIndex].ratio = newRatio;
                            hasChanges = true;
                        }
                    } else {
                        // Add to array
                        VistaKine.navigation.state.visibleSections.push({
                            element: entry.target,
                            ratio: entry.intersectionRatio,
                            id: entry.target.id
                        });
                        hasChanges = true;
                    }
                } else if (!entry.isIntersecting) {
                    // Remove from visible sections if not intersecting
                    const initialLength = VistaKine.navigation.state.visibleSections.length;
                    VistaKine.navigation.state.visibleSections = VistaKine.navigation.state.visibleSections.filter(
                        item => item.element !== entry.target
                    );
                    // If we removed something, mark as changed
                    if (initialLength !== VistaKine.navigation.state.visibleSections.length) {
                        hasChanges = true;
                    }
                }
            });

            // Only update UI if we have visible sections
            if (hasChanges) {
                // If no sections are visible enough, keep the current active section
                // This prevents losing the active state during transitions
                if (VistaKine.navigation.state.visibleSections.length === 0) {
                    VistaKine.utils.log("No sections visible enough, maintaining current active section", "debug");
                    // Do nothing - keep current active section
                } else {
                    // Sort sections by their intersection ratio (highest first)
                    VistaKine.navigation.state.visibleSections.sort((a, b) => b.ratio - a.ratio);

                    // Select the highest visible section
                    const topSection = VistaKine.navigation.state.visibleSections[0];

                    // Only update if we have a viable candidate and it's different from current
                    if (topSection.id && topSection.id !== VistaKine.navigation.state.currentSection) {
                        VistaKine.utils.log(`Observer detected new section: ${topSection.id} with ratio: ${topSection.ratio.toFixed(3)}`);

                        // Update navigation directly here for immediate feedback
                        VistaKine.navigation.setActiveSection(topSection.id);

                        // Update last update time
                        lastUpdateTime = now;
                    }
                }
            }
        }, options);

        // Observe all sections
        const sections = VistaKine.dom.getSections();
        sections.forEach(section => {
            if (section.id) { // Only observe sections with IDs
                VistaKine.navigation.observer.observe(section);
            }
        });

        VistaKine.utils.log(`IntersectionObserver set up, tracking ${sections.length} sections`);
    },

    /**
     * Helper method to ensure a section becomes visible to the Observer
     * when navigating to it directly via links
     */
    ensureSectionVisible: function(sectionId) {
        // Find the section element
        const section = document.getElementById(sectionId);
        if (!section) return;

        // First, scroll to it to make it visible
        section.scrollIntoView({ behavior: 'smooth' });

        // Wait a short time for the scroll to complete
        setTimeout(() => {
            // Directly update the active section immediately
            VistaKine.navigation.setActiveSection(sectionId);

            // Ensure content is loaded
            VistaKine.content.loadSection(section);

            // Manually add to visibleSections with high ratio to ensure it's selected
            const existingIndex = VistaKine.navigation.state.visibleSections.findIndex(
                item => item.element === section
            );

            if (existingIndex >= 0) {
                VistaKine.navigation.state.visibleSections[existingIndex].ratio = 1.0;
            } else {
                VistaKine.navigation.state.visibleSections.push({
                    element: section,
                    ratio: 1.0,
                    id: sectionId
                });
            }

            // Sort to ensure this section is at the top
            VistaKine.navigation.state.visibleSections.sort((a, b) => b.ratio - a.ratio);

            VistaKine.utils.log(`Manually ensured section ${sectionId} is visible to Observer`);
        }, 300);
    },
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