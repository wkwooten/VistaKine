/**
 * VistaKine Content Module
 *
 * Responsible for the dynamic loading and management of educational content.
 * This module is the heart of the book's content system, handling:
 *
 * 1. CONTENT LOADING: Dynamically loads HTML content for sections as needed
 * 2. LAZY LOADING: Implements efficient loading strategies to minimize initial load time
 * 3. ERROR HANDLING: Provides robust error recovery with multiple fallback strategies
 * 4. PROGRESS TRACKING: Manages reading progress indicators
 * 5. SECTION MANAGEMENT: Coordinates with navigation to ensure content is available when needed
 * 6. MEMORY OPTIMIZATION: Limits the number of simultaneously loaded sections to improve performance
 *
 * Design principles:
 * - Progressive enhancement: Core content loads first, then enhances with visualizations
 * - Resilient loading: Multiple path strategies ensure content loads despite environment changes
 * - Responsive loading: Device-specific optimizations for mobile, tablet and desktop
 * - Performance optimization: Limits loaded sections to maintain performance
 */

// Ensure VistaKine namespace exists
window.VistaKine = window.VistaKine || {};

// Content module
VistaKine.content = {
    // State
    state: {
        observer: null,
        contentInitialized: false,
        lastHistoryUpdate: null
    },

    // Configuration
    config: {
        // Maximum number of sections to keep loaded at once
        // This helps manage memory usage and improve performance
        maxLoadedSections: 5,

        // Essential sections that should never be unloaded
        // These are core sections that are frequently accessed
        essentialSections: ['cover', 'about', 'chapters'],

        // Minimum distance from current section for unloading
        // Sections this many positions away from the current one are eligible for unloading
        unloadDistance: 3
    },

    /**
     * Initialize content loading functionality
     *
     * Sets up the content management system including:
     * - Initial content loading for visible sections
     * - Backup content loading for critical sections
     * - Scroll observation for content visibility
     * - Reading progress indicators
     * - State change subscriptions
     * - Section management for performance optimization
     */
    init: function() {
        if (VistaKine.state.isInitialized('content')) {
            VistaKine.utils.log('Content module already initialized', 'warn');
            return;
        }

        VistaKine.utils.log('Initializing content module');

        // Mark all sections as unloaded FIRST - before we start loading any content
        this.initializeSectionStates();

        // Adjust the maximum loaded sections based on device capabilities
        if (VistaKine.device.isMobile()) {
            // Mobile devices have limited memory, so reduce the max loaded sections
            this.config.maxLoadedSections = 3;
            this.config.unloadDistance = 2;
            VistaKine.utils.log('Mobile device detected - reducing max loaded sections to 3', 'info');
        } else if (VistaKine.device.isTablet()) {
            // Tablets have moderate capabilities
            this.config.maxLoadedSections = 4;
            VistaKine.utils.log('Tablet device detected - setting max loaded sections to 4', 'info');
        } else {
            // Desktop devices can handle more sections
            this.config.maxLoadedSections = 5;
            VistaKine.utils.log('Desktop device detected - setting max loaded sections to 5', 'info');
        }

        // No need to setup a separate lazy loading observer - using navigation's observer

        // Load the initial visible section immediately
        VistaKine.content.loadInitialSection();

        // Load the cover section if it's not already loaded (this is a fail-safe)
        VistaKine.content.loadInitialContent();

        // Set up scroll observer for section visibility as backup
        VistaKine.content.setupScrollObserver();

        // Setup progress indicator if enabled
        if (VistaKine.config.features.progressIndicator) {
            VistaKine.content.setupProgressIndicator();
        }

        // Mark as initialized
        VistaKine.state.setInitialized('content');

        // Subscribe to section changes to ensure content is loaded
        VistaKine.state.subscribe('navigation.currentSection', function(path, newSectionId) {
            if (newSectionId) {
                const sectionElement = document.getElementById(newSectionId);
                if (sectionElement && !VistaKine.state.isSectionLoaded(newSectionId)) {
                    VistaKine.content.loadSection(sectionElement);
                }
            }
        });

        // Create debug panel for testing
        this.createDebugPanel();

        VistaKine.utils.log('Content module initialized successfully', 'success');
    },

    /**
     * Initialize all section states by marking unloaded sections
     * This ensures all sections have the correct classes before any content loads
     */
    initializeSectionStates: function() {
        // Get all sections
        const sections = VistaKine.dom.getSections();

        // Mark all sections as unloaded initially
        sections.forEach(section => {
            // Add the unloaded class to all sections by default
            section.classList.add('unloaded');

            // Get the content element
            const contentElement = section.querySelector('.section-content');
            if (contentElement) {
                // Update the loading placeholder with a friendly title
                const loadingPlaceholder = contentElement.querySelector('.loading-placeholder');
                if (loadingPlaceholder) {
                    const sectionTitle = this.getSectionTitle(section.id);
                    loadingPlaceholder.textContent = `${sectionTitle} (ready to load)`;
                }
            }
        });

        VistaKine.utils.log('All sections marked as unloaded during initialization', 'info');
    },

    /**
     * Set up Intersection Observer for lazy loading
     * Note: This method is kept for reference but is no longer used
     * We now use the navigation module's observer to avoid duplication
     */
    setupLazyLoading: function() {
        // This functionality has been moved to the navigation module
        VistaKine.utils.log('Lazy loading now uses navigation module observer for efficiency', 'info');
    },

    /**
     * Load the initial visible section immediately
     */
    loadInitialSection: function() {
        const initialSection = VistaKine.navigation.findVisibleSection();

        if (initialSection) {
            VistaKine.utils.log(`Loading initial section ${initialSection.id} immediately`);
            VistaKine.content.loadSection(initialSection);
        } else {
            VistaKine.utils.log('No visible section found for immediate loading', 'warn');

            // Fallback: load the first section
            const sections = VistaKine.dom.getSections();
            const firstSection = sections[0];

            if (firstSection) {
                VistaKine.utils.log(`Fallback: Loading first section ${firstSection.id}`);
                VistaKine.content.loadSection(firstSection);
            }
        }
    },

    /**
     * Set up an observer to detect which section is visible while scrolling
     */
    setupScrollObserver: function() {
        // Check device type using centralized utilities
        const isTablet = VistaKine.device.isTablet();

        // Use properly throttled scroll event as a backup for the IntersectionObserver
        let lastScrollTime = 0;
        const scrollThreshold = isTablet ? 350 : 250; // Increased throttling for tablets
        let scrollTimer = null;
        let isScrolling = false;

        window.addEventListener('scroll', function() {
            const now = Date.now();
            isScrolling = true;

            // First, cancel any pending scroll timer to avoid stacking updates
            if (scrollTimer) {
                clearTimeout(scrollTimer);
            }

            // Only process scroll when scrolling stops or after threshold time
            scrollTimer = setTimeout(() => {
                // Only do the expensive check if enough time has passed since last processed scroll
                if (now - lastScrollTime > scrollThreshold) {
                    lastScrollTime = now;

                    // Use requestAnimationFrame to avoid layout thrashing
                    window.requestAnimationFrame(function() {
                        // Only process if we're not in the middle of a direct navigation
                        if (VistaKine.navigation && VistaKine.navigation.state &&
                            VistaKine.navigation.state.isDirectNavigation) {
                            return;
                        }

                        // Prefer to use the Observer-detected section if available
                        let visibleSection = null;

                        if (VistaKine.navigation.state.visibleSections &&
                            VistaKine.navigation.state.visibleSections.length > 0) {
                            // Get the top section from the IntersectionObserver data
                            visibleSection = VistaKine.navigation.state.visibleSections[0].element;
                        } else {
                            // Fallback to the old method
                            visibleSection = VistaKine.navigation.findVisibleSection();
                        }

                        if (visibleSection && visibleSection.id) {
                            // Only update the active section if it's different from current
                            if (VistaKine.navigation.state.currentSection !== visibleSection.id) {
                                VistaKine.utils.log(`Scroll event detected section change: ${visibleSection.id}`, 'debug');
                                VistaKine.navigation.setActiveSection(visibleSection.id);
                            }
                        }

                        // Flag that we're done scrolling
                        isScrolling = false;
                    });
                }
            }, isTablet ? 200 : 100); // Short timeout before checking - longer for tablets
        });
    },

    /**
     * Set up the reading progress indicator
     */
    setupProgressIndicator: function() {
        const progressBar = document.getElementById('reading-progress');

        if (!progressBar) {
            VistaKine.utils.log('Reading progress indicator element not found', 'warn');
            return;
        }

        // Update progress on scroll
        window.addEventListener('scroll', () => {
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight - windowHeight;
            const progress = (scrollPosition / documentHeight) * 100;

            progressBar.style.width = `${progress}%`;
        }, { passive: true });
    },

    /**
     * Load content for a section
     *
     * This is the primary method for loading section content. It handles:
     * - Checking if content is already loaded
     * - Loading from the correct source based on environment
     * - Displaying appropriate loading indicators
     * - Updating state when loading completes
     * - Handling errors with user feedback
     *
     * The method uses an async approach with promise handling to manage the
     * asynchronous nature of content loading while maintaining a clean API.
     *
     * @param {HTMLElement} section - The section element to load content for
     * @returns {Promise<boolean>} - Success or failure of the loading operation
     */
    loadSection: function(section) {
        if (!section) {
            VistaKine.utils.log('No section provided to loadSection', 'error');
            return false;
        }

        const sectionId = section.id;
        const contentElement = section.querySelector('.section-content');

        if (!contentElement) {
            VistaKine.utils.log(`Section ${sectionId} has no content element`, 'error');
            return false;
        }

        // Check if already loaded using the central state
        if (VistaKine.state.isSectionLoaded(sectionId)) {
            VistaKine.utils.log(`Section ${sectionId} already loaded, skipping`);
            return true;
        }

        const contentPath = contentElement.getAttribute('data-src');
        if (!contentPath) {
            VistaKine.utils.log(`Section ${sectionId} has no data-src attribute`, 'error');
            return false;
        }

        VistaKine.utils.log(`Loading content for section ${sectionId} from ${contentPath}`);

        // Add loading class to section container but don't remove unloaded yet
        // to preserve background color during transition
        section.classList.add('loading');

        // Hide any existing placeholders immediately
        const existingPlaceholder = contentElement.querySelector('.loading-placeholder');
        if (existingPlaceholder) {
            existingPlaceholder.style.opacity = '0';
        }

        // Create a loading indicator if it doesn't exist
        let loadingElement = existingPlaceholder;
        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.className = 'loading-placeholder';
            loadingElement.textContent = `Loading ${sectionId}...`;
            loadingElement.style.opacity = '0'; // Start invisible
            contentElement.appendChild(loadingElement);
        }

        // Show loading state
        contentElement.classList.add('loading');

        // Add to pending requests
        VistaKine.state.set(`content.pendingRequests.${sectionId}`, Date.now());

        return VistaKine.content.fetchSectionContent(contentPath, sectionId)
            .then(htmlContent => {
                // Success! Insert the content
                contentElement.innerHTML = htmlContent;

                // Mark as loaded in the central state
                VistaKine.state.addLoadedSection(sectionId);

                // Remove from pending requests
                VistaKine.state.set(`content.pendingRequests.${sectionId}`, null);

                // Manage loaded sections to stay within limits
                VistaKine.content.manageLoadedSections(sectionId);

                // Initialize Three.js if available
                if (typeof VistaKine.visualization !== 'undefined') {
                    if (typeof VistaKine.visualization.initializeScene === 'function') {
                        console.log(`Initializing visualization for section ${sectionId}`);
                        VistaKine.visualization.initializeScene(section);
                    } else if (typeof VistaKine.visualization.scanForContainers === 'function') {
                        console.log(`Scanning for visualizations in section ${sectionId}`);
                        VistaKine.visualization.scanForContainers();
                    }
                }

                // First ensure the new content is ready but invisible
                contentElement.style.opacity = '0';

                // Force a relayout/repaint to ensure content is visible
                contentElement.style.display = 'none';
                contentElement.offsetHeight; // Force a reflow
                contentElement.style.display = '';

                // Fade in the content smoothly
                setTimeout(() => {
                    // Now remove loading class and add loaded class
                    section.classList.remove('loading');
                    section.classList.add('loaded');
                    contentElement.classList.remove('loading');

                    // Only remove unloaded class after content is ready
                    section.classList.remove('unloaded');

                    // Remove height data attribute as we now have actual content
                    if (section.hasAttribute('data-section-height')) {
                        VistaKine.utils.log(`Removing stored height for section ${sectionId}`, 'debug');
                        section.removeAttribute('data-section-height');
                    }

                    contentElement.style.opacity = '1';

                    // Calculate reading time if applicable
                    VistaKine.content.calculateReadingTime(section);

                    // Update debug panel
                    this.updateDebugPanel();

                    // Remove custom properties when content is loaded
                    section.style.removeProperty('--section-height');
                    section.style.removeProperty('--section-color');
                }, 50);

                // Dispatch section-loaded event
                const sectionLoadedEvent = new CustomEvent('section-loaded', {
                    detail: {
                        sectionId: sectionId,
                        timestamp: Date.now(),
                        loaded: true,
                        sectionElement: section
                    }
                });
                document.dispatchEvent(sectionLoadedEvent);

                VistaKine.utils.log(`Section ${sectionId} loaded successfully`, 'success');

                return true;
            })
            .catch(error => {
                // Handle errors
                section.classList.remove('loading');
                section.classList.add('load-error');
                contentElement.classList.remove('loading');

                VistaKine.utils.log(`Error loading section ${sectionId}: ${error.message}`, 'error');

                // Create error message
                const errorMsg = `
                    <div class="error-indicator">
                        <h3>Error Loading Content</h3>
                        <p>There was a problem loading content for section "${sectionId}".</p>
                        <div class="error-message">${error.message}</div>
                        <button onclick="VistaKine.content.retryLoadSection('${sectionId}')">Retry</button>
                    </div>
                `;
                contentElement.innerHTML = errorMsg;

                // Remove from pending requests
                VistaKine.state.set(`content.pendingRequests.${sectionId}`, null);

                // Update debug panel
                this.updateDebugPanel();

                return false;
            });
    },

    /**
     * Fetch section content with multiple fallback strategies
     */
    fetchSectionContent: function(contentPath, sectionId) {
        // Determine environment
        const isGitHubPages = VistaKine.state.isGitHubPages;

        // Create a copy of the original path
        const originalPath = contentPath;

        // Simple absolute path for local development
        const localPath = contentPath.startsWith('/') ? contentPath : '/' + contentPath;

        // Use cache busting to avoid caching issues
        const cacheBuster = `?_=${Date.now()}`;

        // Create paths to try based on environment
        const pathsToTry = [];

        if (isGitHubPages) {
            // GitHub Pages paths
            pathsToTry.push(
                VistaKine.utils.getResourcePath(contentPath) + cacheBuster,
                VistaKine.utils.getResourcePath(contentPath),
                contentPath + cacheBuster,
                contentPath
            );
        } else {
            // Local development paths
            pathsToTry.push(
                originalPath + cacheBuster,
                originalPath,
                contentPath.replace(/^\//, ''),
                localPath + cacheBuster,
                localPath
            );
        }

        // Common fallbacks for both environments
        pathsToTry.push(
            new URL(contentPath.replace(/^\/+/, ''), window.location.origin).href,
            contentPath.replace(/^\/+/, '')
        );

        // Log the paths
        VistaKine.utils.log(`Trying to fetch content for ${sectionId} with ${pathsToTry.length} possible paths`);

        // Try each path until one works
        return VistaKine.content.tryPaths(pathsToTry, 0, sectionId);
    },

    /**
     * Recursively try paths until one succeeds or all fail
     */
    tryPaths: function(paths, index, sectionId) {
        if (index >= paths.length) {
            return Promise.reject(new Error(`Failed to load content for ${sectionId} after trying ${paths.length} paths`));
        }

        const path = paths[index];
        VistaKine.utils.log(`Trying path ${index + 1}/${paths.length}: ${path}`);

        // Fetch options to prevent caching
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Accept': 'text/html',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        };

        return fetch(path, fetchOptions)
            .then(response => {
                if (response.ok) {
                    VistaKine.utils.log(`Path succeeded: ${path}`, 'success');
                    return response.text();
                }

                VistaKine.utils.log(`Path failed with status ${response.status}: ${path}`, 'warn');
                // Try next path
                return VistaKine.content.tryPaths(paths, index + 1, sectionId);
            })
            .catch(error => {
                VistaKine.utils.log(`Error fetching ${path}: ${error.message}`, 'warn');
                // Try next path
                return VistaKine.content.tryPaths(paths, index + 1, sectionId);
            });
    },

    /**
     * Calculate reading time for a section's content
     */
    calculateReadingTime: function(section) {
        if (!section) return;

        // Find the reading time element
        const readingTimeElement = section.querySelector('.reading-time span');
        if (!readingTimeElement) return;

        // Find the text content (usually in a .section-text element)
        const textContent = section.querySelector('.section-text') || section;

        if (textContent) {
            // Average reading speed (words per minute)
            const wordsPerMinute = 200;

            // Get text content
            const text = textContent.textContent || textContent.innerText;

            // Count words (roughly)
            const wordCount = text.trim().split(/\s+/).length;

            // Calculate reading time in minutes
            const readingTime = Math.ceil(wordCount / wordsPerMinute);

            // Update the reading time element
            readingTimeElement.textContent = readingTime < 1 ? '< 1 min read' : readingTime + ' min read';

            VistaKine.utils.log(`Calculated reading time for ${section.id}: ${readingTimeElement.textContent}`);
        }
    },

    /**
     * Load the cover and critical initial content to ensure the page isn't empty
     */
    loadInitialContent: function() {
        // Always try to load the cover section
        const coverSection = document.getElementById('cover');
        if (coverSection && !VistaKine.state.isSectionLoaded('cover')) {
            VistaKine.utils.log('Loading cover section as a failsafe');
            VistaKine.content.loadSection(coverSection);
        }

        // Also try to load the about section for quick access
        const aboutSection = document.getElementById('about');
        if (aboutSection && !VistaKine.state.isSectionLoaded('about')) {
            VistaKine.utils.log('Loading about section as a failsafe');
            VistaKine.content.loadSection(aboutSection);
        }

        // Also load chapters section
        const chaptersSection = document.getElementById('chapters');
        if (chaptersSection && !VistaKine.state.isSectionLoaded('chapters')) {
            VistaKine.utils.log('Loading chapters section as a failsafe');
            VistaKine.content.loadSection(chaptersSection);
        }
    },

    /**
     * Unload a section to free up memory
     *
     * This method safely unloads a section by:
     * 1. Removing its content
     * 2. Disposing of any associated resources (visualizations, etc.)
     * 3. Updating the state system to mark it as unloaded
     * 4. Putting a lightweight placeholder in its place
     *
     * @param {string} sectionId - ID of the section to unload
     * @returns {boolean} - Whether the section was successfully unloaded
     */
    unloadSection: function(sectionId) {
        // Don't unload essential sections
        if (this.config.essentialSections.includes(sectionId)) {
            VistaKine.utils.log(`Section ${sectionId} is essential and won't be unloaded`, 'debug');
            return false;
        }

        // Get the section element
        const section = document.getElementById(sectionId);
        if (!section) {
            VistaKine.utils.log(`Section ${sectionId} not found, cannot unload`, 'warn');
            return false;
        }

        // Get the content element
        const contentElement = section.querySelector('.section-content');
        if (!contentElement) {
            VistaKine.utils.log(`Section ${sectionId} has no content element`, 'warn');
            return false;
        }

        // Check if it's actually loaded
        if (!VistaKine.state.isSectionLoaded(sectionId)) {
            VistaKine.utils.log(`Section ${sectionId} is not loaded`, 'debug');
            return false;
        }

        VistaKine.utils.log(`Unloading section: ${sectionId}`, 'info');

        // Clean up any visualizations
        if (typeof VistaKine.visualization !== 'undefined' &&
            typeof VistaKine.visualization.cleanupScene === 'function') {
            VistaKine.utils.log(`Cleaning up visualizations for section ${sectionId}`);
            VistaKine.visualization.cleanupScene(section);
        }

        // Get the source for later reloading
        const contentPath = contentElement.getAttribute('data-src');

        // Replace content with placeholder that matches initial unloaded state
        const sectionTitle = this.getSectionTitle(sectionId);
        contentElement.innerHTML = `<div class="loading-placeholder">${sectionTitle} (ready to load)</div>`;

        // Add unloaded class to section container
        section.classList.add('unloaded');
        section.classList.remove('loaded');

        // Mark as unloaded in state
        VistaKine.state.removeLoadedSection(sectionId);

        // Dispatch unload event
        const sectionUnloadedEvent = new CustomEvent('section-unloaded', {
            detail: {
                sectionId: sectionId,
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(sectionUnloadedEvent);

        // Update debug panel
        this.updateDebugPanel();

        VistaKine.utils.log(`Section ${sectionId} unloaded successfully`, 'success');
        return true;
    },

    /**
     * Get a user-friendly title for a section based on its ID
     * @param {string} sectionId - The ID of the section
     * @returns {string} A user-friendly title for the section
     */
    getSectionTitle: function(sectionId) {
        // Special sections
        if (sectionId === 'cover') return 'Cover Page';
        if (sectionId === 'about') return 'About Section';
        if (sectionId === 'chapters') return 'Chapters Overview';

        // Chapter sections
        if (sectionId.includes('chapter')) {
            // Extract chapter number if possible
            const match = sectionId.match(/chapter(\d+)(?:-(\w+))?/i);
            if (match) {
                const chapterNum = match[1];
                const subSection = match[2];

                // If there's a subsection
                if (subSection) {
                    return `Chapter ${chapterNum}: ${this.formatSubsectionName(subSection)}`;
                }

                return `Chapter ${chapterNum}`;
            }

            return "Chapter Section";
        }

        // Default fallback
        return `Section: ${sectionId}`;
    },

    /**
     * Format a subsection name to be more readable
     * @param {string} name - The subsection name from the ID
     * @returns {string} A formatted subsection name
     */
    formatSubsectionName: function(name) {
        if (!name) return '';

        // Handle common subsection names
        if (name === 'intro') return 'Introduction';
        if (name === 'summary') return 'Summary';

        // General formatting: convert to title case
        return name.split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    },

    /**
     * Manage loaded sections to stay within the maximum limit
     *
     * This method:
     * 1. Checks if we've exceeded the maximum number of loaded sections
     * 2. If so, identifies which sections are furthest from the current section
     * 3. Unloads those sections while preserving essential ones
     * 4. Prioritizes currently visible sections in the viewport
     *
     * @param {string} currentSectionId - The currently active section ID
     */
    manageLoadedSections: function(currentSectionId) {
        if (!currentSectionId) {
            currentSectionId = VistaKine.state.getCurrentSection();
        }

        // Get all loaded sections
        const loadedSections = VistaKine.state.getLoadedSections();

        // If we're under the limit, nothing to do
        if (loadedSections.length <= this.config.maxLoadedSections) {
            return;
        }

        VistaKine.utils.log(`Managing loaded sections: ${loadedSections.length} loaded, max is ${this.config.maxLoadedSections}`, 'info');

        // Get current visible sections from navigation if available
        let visibleSectionIds = [];
        if (VistaKine.navigation &&
            VistaKine.navigation.state &&
            VistaKine.navigation.state.visibleSections) {
            visibleSectionIds = VistaKine.navigation.state.visibleSections
                .map(section => section.id);
            VistaKine.utils.log(`Current visible sections: ${visibleSectionIds.join(', ')}`, 'debug');
        }

        // Get all sections in document order for distance calculation
        const allSections = Array.from(VistaKine.dom.getSections()).map(section => section.id);

        // Find the index of the current section
        const currentIndex = allSections.indexOf(currentSectionId);

        // Calculate distance from current section for each loaded section
        const sectionsWithDistance = loadedSections.map(sectionId => {
            // Essential sections get infinite negative distance (to keep them)
            if (this.config.essentialSections.includes(sectionId)) {
                return { id: sectionId, distance: -Infinity };
            }

            // Currently visible sections in viewport get high priority (negative distance)
            if (visibleSectionIds.includes(sectionId)) {
                return { id: sectionId, distance: -100 }; // Large negative value to prioritize
            }

            const index = allSections.indexOf(sectionId);
            const distance = index !== -1 ? Math.abs(index - currentIndex) : Infinity;
            return { id: sectionId, distance: distance };
        });

        // Sort by distance (farthest first)
        sectionsWithDistance.sort((a, b) => b.distance - a.distance);

        // Unload sections until we're at the limit, starting with farthest
        const sectionsToUnload = sectionsWithDistance.slice(0, loadedSections.length - this.config.maxLoadedSections);

        // Only unload sections beyond our unload distance
        for (const section of sectionsToUnload) {
            if (section.distance >= this.config.unloadDistance) {
                VistaKine.utils.log(`Unloading distant section ${section.id} (distance: ${section.distance})`, 'debug');
                this.unloadSection(section.id);
            }
        }

        // Update debug panel if it exists
        this.updateDebugPanel();
    },

    /**
     * Create and show a debug panel to visualize section loading
     * Used during development and testing to monitor section loading/unloading
     */
    createDebugPanel: function() {
        // Check if panel already exists
        if (document.getElementById('vk-debug-panel')) {
            return;
        }

        // Create panel element
        const panel = document.createElement('div');
        panel.id = 'vk-debug-panel';
        panel.className = 'vk-debug-panel';

        // Style the panel
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            max-height: 300px;
            overflow-y: auto;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            display: none; /* Hidden by default */
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            border-bottom: 1px solid #666;
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
        `;
        header.innerHTML = `
            <span>VistaKine Debug Panel</span>
            <button id="vk-debug-close" style="background: none; border: none; color: #fff; cursor: pointer;">×</button>
        `;

        // Create content container
        const content = document.createElement('div');
        content.id = 'vk-debug-content';

        // Add elements to the DOM
        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // Add close button event listener
        document.getElementById('vk-debug-close').addEventListener('click', () => {
            this.hideDebugPanel();

            // If we're using the settings integration, update the settings value
            if (VistaKine.settings && VistaKine.settings.current && VistaKine.settings.current.development) {
                VistaKine.settings.current.development.showDebugPanel = false;

                // Update the checkbox in the settings panel if it exists
                const debugPanelCheckbox = document.getElementById('debug-panel');
                if (debugPanelCheckbox) {
                    debugPanelCheckbox.checked = false;
                }

                // Save settings
                if (typeof VistaKine.settings.saveSettings === 'function') {
                    VistaKine.settings.saveSettings();
                }
            }
        });

        // Create toggle button (now hidden by default - accessible via settings)
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'vk-debug-toggle';
        toggleBtn.textContent = 'Debug';
        toggleBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
            z-index: 9998;
            display: none; /* Hidden by default */
        `;

        // Add toggle button to DOM
        document.body.appendChild(toggleBtn);

        // Toggle button event listener
        toggleBtn.addEventListener('click', () => {
            this.showDebugPanel();
        });

        // Initial update
        this.updateDebugPanel();

        // Set up auto-refresh every second
        setInterval(() => this.updateDebugPanel(), 1000);
    },

    /**
     * Show the debug panel
     */
    showDebugPanel: function() {
        const panel = document.getElementById('vk-debug-panel');
        const toggleBtn = document.getElementById('vk-debug-toggle');

        if (panel) {
            panel.style.display = 'block';
        }

        if (toggleBtn) {
            toggleBtn.style.display = 'none';
        }
    },

    /**
     * Hide the debug panel
     */
    hideDebugPanel: function() {
        const panel = document.getElementById('vk-debug-panel');
        const toggleBtn = document.getElementById('vk-debug-toggle');

        if (panel) {
            panel.style.display = 'none';
        }

        if (toggleBtn) {
            toggleBtn.style.display = 'none'; // Keep toggle hidden for settings integration
        }
    },

    /**
     * Update the debug panel with current system state
     */
    updateDebugPanel: function() {
        const content = document.getElementById('vk-debug-content');
        if (!content) return;

        // Get data from the centralized state system
        const loadedSections = VistaKine.state.getLoadedSections();
        const currentSection = VistaKine.state.getCurrentSection();

        // Get visible sections from the navigation module
        let visibleSections = [];
        if (VistaKine.navigation && VistaKine.navigation.state) {
            visibleSections = VistaKine.navigation.state.visibleSections || [];
        }

        // Sort visible sections by visibility ratio for display
        const sortedVisibleSections = [...visibleSections].sort((a, b) => b.ratio - a.ratio);

        // Get all sections and indicate which are loaded/unloaded
        const allSections = Array.from(VistaKine.dom.getSections()).map(section => section.id);
        const unloadedSections = allSections.filter(id => !loadedSections.includes(id));

        // Format section list with indicators
        const loadedSectionsList = loadedSections.map(sectionId => {
            const isCurrent = sectionId === currentSection;
            const visibleSection = visibleSections.find(s => s.id === sectionId);
            const isVisible = visibleSection !== undefined;
            const isEssential = this.config.essentialSections.includes(sectionId);

            let indicators = '';
            if (isCurrent) indicators += ' <span style="color: #ffcc00;">⭐</span>';
            if (isVisible) {
                const ratio = visibleSection.ratio.toFixed(2);
                indicators += ` <span style="color: #00ccff;">👁️ ${ratio}</span>`;
            }
            if (isEssential) indicators += ' <span style="color: #ff6666;">🔒</span>';

            return `<li><span style="color: #66ff66;">▣</span> ${sectionId}${indicators}</li>`;
        }).join('');

        // Format unloaded sections list
        const unloadedSectionsList = unloadedSections.map(sectionId => {
            return `<li><span style="color: #999;">□</span> ${sectionId}</li>`;
        }).join('');

        // Get memory information if performance API is available
        let memoryInfo = '';
        if (window.performance && performance.memory) {
            const memory = performance.memory;
            const totalMB = Math.round(memory.totalJSHeapSize / (1024 * 1024));
            const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
            const limitMB = Math.round(memory.jsHeapSizeLimit / (1024 * 1024));

            memoryInfo = `
                <div><span style="color: #999;">JS Heap:</span> ${usedMB}MB / ${totalMB}MB (Limit: ${limitMB}MB)</div>
            `;
        } else {
            // Fallback to rough estimation
            const memoryUsage = loadedSections.length * 300; // Very rough estimate in KB
            memoryInfo = `<div><span style="color: #999;">Est. Memory:</span> ~${memoryUsage} KB</div>`;
        }

        // Create list of visible sections with visibility ratio
        const visibleSectionsList = sortedVisibleSections.length > 0
            ? sortedVisibleSections.map(s => `${s.id} (${s.ratio.toFixed(2)})`).join(', ')
            : 'none';

        // Show direct navigation status
        const directNavStatus = VistaKine.navigation &&
                               VistaKine.navigation.state &&
                               VistaKine.navigation.state.isDirectNavigation
            ? '<span style="color: #ffcc00;">ACTIVE</span>'
            : '<span style="color: #999;">inactive</span>';

        // Update content
        content.innerHTML = `
            <div style="margin-bottom: 10px;">
                <div><span style="color: #999;">Current:</span> ${currentSection || 'none'}</div>
                <div>
                    <span style="color: #999;">Status:</span>
                    <span style="${loadedSections.length > this.config.maxLoadedSections ? 'color: #ff6666;' : 'color: #66ff66;'}">
                        ${loadedSections.length}/${this.config.maxLoadedSections} loaded
                    </span>
                </div>
                ${memoryInfo}
                <div style="margin-top: 5px;">
                    <span style="color: #999;">Visible sections:</span>
                    <span style="color: #00ccff;">${visibleSectionsList}</span>
                </div>
                <div style="margin-top: 3px;">
                    <span style="color: #999;">Direct navigation:</span> ${directNavStatus}
                </div>
                <div style="margin-top: 5px;">
                    <button onclick="VistaKine.navigation.ensureSectionVisible(VistaKine.state.getCurrentSection())" style="background: #333; color: #fff; border: 1px solid #666; padding: 2px 5px; font-size: 10px; cursor: pointer; border-radius: 3px;">
                        Recenter Current Section
                    </button>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="color: #999; margin-bottom: 5px;">Loaded Sections:</div>
                <div style="margin-left: 10px;">
                    <ul style="list-style: none; padding-left: 0;">
                        ${loadedSectionsList}
                    </ul>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="color: #999; margin-bottom: 5px; cursor: pointer;" onclick="document.getElementById('vk-unloaded-list').style.display = document.getElementById('vk-unloaded-list').style.display === 'none' ? 'block' : 'none';">
                    Unloaded Sections (${unloadedSections.length}) <span style="font-size: 10px;">▼</span>
                </div>
                <div id="vk-unloaded-list" style="margin-left: 10px; display: none;">
                    <ul style="list-style: none; padding-left: 0;">
                        ${unloadedSectionsList}
                    </ul>
                </div>
            </div>
            <div style="margin-top: 10px; font-size: 10px; color: #666; text-align: center;">
                Last updated: ${new Date().toLocaleTimeString()}
            </div>
        `;
    },

    /**
     * Retry loading a section after a failure
     * @param {string} sectionId - ID of the section to retry loading
     */
    retryLoadSection: function(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) {
            VistaKine.utils.log(`Cannot retry: Section ${sectionId} not found`, 'error');
            return false;
        }

        VistaKine.utils.log(`Retrying load for section ${sectionId}`, 'info');

        // Remove error state
        section.classList.remove('load-error');

        // Try loading again
        return this.loadSection(section);
    }
};

// Initialize when core and navigation are ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if necessary modules are initialized before proceeding
    const initInterval = setInterval(function() {
        if (window.VistaKine &&
            VistaKine.state &&
            VistaKine.state.initialized.core &&
            VistaKine.state.initialized.navigation) {

            clearInterval(initInterval);
            VistaKine.content.init();
        }
    }, 50);
});