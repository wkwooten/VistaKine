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
            const contentElement = section.querySelector('.section-wrapper');
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
     * This is now a lightweight version that relies on the navigation module's observer
     */
    setupScrollObserver: function() {
        console.log('[Content] Using navigation observer exclusively, disabling content scroll observer');

        // Subscribe to navigation state changes instead of using our own observer
        VistaKine.state.subscribe('navigation.currentSection', (path, newSectionId, oldSectionId) => {
            console.log(`[Content] Detected section change from central state: ${oldSectionId} -> ${newSectionId}`);

            if (newSectionId) {
                const section = document.getElementById(newSectionId);
                if (section && !VistaKine.state.isSectionLoaded(newSectionId)) {
                    console.log(`[Content] Loading section ${newSectionId} due to state change`);
                    this.loadSection(section);
                }
            }
        });

        // Also subscribe to the visible sections array changes
        VistaKine.state.subscribe('navigation.visibleSections', (path, newValue) => {
            if (!newValue || !Array.isArray(newValue) || newValue.length === 0) return;

            // Check if any visible sections need to be loaded
            for (const visSection of newValue) {
                if (visSection && visSection.id && !VistaKine.state.isSectionLoaded(visSection.id)) {
                    const section = document.getElementById(visSection.id);
                    if (section) {
                        console.log(`[Content] Loading visible section ${visSection.id}`);
                        this.loadSection(section);
                    }
                }
            }
        });

        /* Disabling the old scroll event listener - using navigation observer instead
        window.addEventListener('scroll', function() {
            ...existing scroll handler code...
        });
        */
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

        // Check if navigation is locked first
        if (VistaKine.navigation &&
            VistaKine.navigation.state &&
            VistaKine.navigation.state.navigationLock) {
            console.log(`[Content] Deferring load of ${sectionId} due to navigation lock`);

            // Schedule for after lock release
            setTimeout(() => {
                // Check if it's still needed after the lock is released
                if (!VistaKine.state.isSectionLoaded(sectionId)) {
                    console.log(`[Content] Attempting deferred load of ${sectionId} after navigation lock released`);
                    this.loadSection(section);
                }
            }, VistaKine.navigation.state.navigationLockDuration + 100);
            return false;
        }

        // Check if we're already loading this section
        if (VistaKine.state.get(`content.pendingRequests.${sectionId}`)) {
            console.log(`[Content] Section ${sectionId} is already being loaded, skipping duplicate request`);
            return false;
        }

        const contentElement = section.querySelector('.section-wrapper');

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
        const contentElement = section.querySelector('.section-wrapper');
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
        console.log('[Content] Showing debug panel');

        // Check if debug panel already exists
        let debugPanel = document.querySelector('#vistakine-debug-panel');

        if (!debugPanel) {
            // Create debug panel
            debugPanel = document.createElement('div');
            debugPanel.id = 'vistakine-debug-panel';
            debugPanel.className = 'vistakine-debug-panel';

            // Create panel content
            debugPanel.innerHTML = `
                <div class="debug-panel-header">
                    <h3>VistaKine Debug Panel</h3>
                    <button class="debug-panel-close">×</button>
                </div>
                <div class="debug-panel-content">
                    <div class="debug-section">
                        <h4>Navigation State</h4>
                        <div id="debug-nav-state" class="debug-info"></div>
                    </div>
                    <div class="debug-section">
                        <h4>Loaded Sections</h4>
                        <div id="debug-loaded-sections" class="debug-info"></div>
                    </div>
                    <div class="debug-section">
                        <h4>Observer Stats</h4>
                        <div id="debug-observer-stats" class="debug-info"></div>
                    </div>
                    <div class="debug-section">
                        <h4>Performance</h4>
                        <div id="debug-performance" class="debug-info"></div>
                    </div>
                </div>
            `;

            // Add panel styles
            const style = document.createElement('style');
            style.textContent = `
                .vistakine-debug-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 350px;
                    background: rgba(20, 20, 20, 0.9);
                    border: 1px solid #444;
                    border-radius: 6px;
                    color: #fff;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    max-height: 500px;
                    overflow-y: auto;
                    transition: opacity 0.3s ease;
                }

                .debug-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: #333;
                    border-bottom: 1px solid #555;
                    border-radius: 6px 6px 0 0;
                }

                .debug-panel-header h3 {
                    margin: 0;
                    font-size: 14px;
                    color: #fff;
                }

                .debug-panel-close {
                    background: none;
                    border: none;
                    color: #aaa;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0 4px;
                }

                .debug-panel-close:hover {
                    color: #fff;
                }

                .debug-panel-content {
                    padding: 10px;
                }

                .debug-section {
                    margin-bottom: 12px;
                }

                .debug-section h4 {
                    margin: 0 0 4px 0;
                    font-size: 12px;
                    color: #88ccff;
                    border-bottom: 1px solid #444;
                    padding-bottom: 4px;
                }

                .debug-info {
                    font-family: monospace;
                    white-space: pre-wrap;
                    font-size: 11px;
                    line-height: 1.3;
                    margin-bottom: 8px;
                    color: #ddd;
                }

                .debug-highlight {
                    color: #ffcc33;
                }

                .debug-error {
                    color: #ff6666;
                }

                .debug-success {
                    color: #66cc66;
                }

                :root.dark-theme .vistakine-debug-panel {
                    background: rgba(30, 30, 30, 0.95);
                    border: 1px solid #555;
                }
            `;

            document.head.appendChild(style);
            document.body.appendChild(debugPanel);

            // Add close button event
            const closeButton = debugPanel.querySelector('.debug-panel-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    this.hideDebugPanel();
                    // Also update the settings toggle
                    if (VistaKine.settings) {
                        VistaKine.settings.set('development.showDebugPanel', false, false);
                    }
                });
            }
        } else {
            // Show existing panel
            debugPanel.style.display = 'block';
        }

        // Start updating the debug panel
        this.startDebugUpdates();
    },

    /**
     * Hide the debug panel
     */
    hideDebugPanel: function() {
        console.log('[Content] Hiding debug panel');

        const debugPanel = document.querySelector('#vistakine-debug-panel');
        if (debugPanel) {
            debugPanel.style.display = 'none';
        }

        // Stop update interval if it exists
        if (this.debugUpdateInterval) {
            clearInterval(this.debugUpdateInterval);
            this.debugUpdateInterval = null;
        }
    },

    /**
     * Start periodic updates of debug information
     */
    startDebugUpdates: function() {
        // Stop any existing interval
        if (this.debugUpdateInterval) {
            clearInterval(this.debugUpdateInterval);
        }

        // Update immediately
        this.updateDebugPanel();

        // Set up interval for updates
        this.debugUpdateInterval = setInterval(() => {
            this.updateDebugPanel();
        }, 500); // Update every 500ms
    },

    /**
     * Update debug panel with current information
     */
    updateDebugPanel: function() {
        const navStateEl = document.getElementById('debug-nav-state');
        const loadedSectionsEl = document.getElementById('debug-loaded-sections');
        const observerStatsEl = document.getElementById('debug-observer-stats');
        const performanceEl = document.getElementById('debug-performance');

        if (!navStateEl || !loadedSectionsEl || !observerStatsEl || !performanceEl) return;

        // Update navigation state
        const currentSection = VistaKine.state.getCurrentSection() || 'none';
        const isLocked = VistaKine.navigation && VistaKine.navigation.state ?
                        VistaKine.navigation.state.navigationLock : false;
        const isDirectNav = VistaKine.navigation && VistaKine.navigation.state ?
                            VistaKine.navigation.state.isDirectNavigation : false;

        navStateEl.innerHTML = `
            <div>Current Section: <span class="debug-highlight">${currentSection}</span></div>
            <div>Navigation Lock: <span class="${isLocked ? 'debug-error' : 'debug-success'}">${isLocked}</span></div>
            <div>Direct Navigation: <span class="${isDirectNav ? 'debug-highlight' : ''}">${isDirectNav}</span></div>
        `;

        // Update loaded sections
        const loadedSections = VistaKine.state.getLoadedSections() || [];
        loadedSectionsEl.innerHTML = `
            <div>Total Loaded: <span class="debug-highlight">${loadedSections.length}</span></div>
            <div>${loadedSections.map(s => `<span class="debug-success">✓</span> ${s}`).join('<br>')}</div>
        `;

        // Update observer stats
        let visibleSections = [];
        if (VistaKine.navigation && VistaKine.navigation.state) {
            visibleSections = VistaKine.navigation.state.visibleSections || [];
        }

        observerStatsEl.innerHTML = `
            <div>Visible Sections: <span class="debug-highlight">${visibleSections.length}</span></div>
            ${visibleSections.map(s => `<div>${s.id}: ${(s.ratio * 100).toFixed(1)}%</div>`).join('')}
        `;

        // Update performance metrics
        const loadStartTime = window.vistaKineInitTime || 0;
        const currentTime = Date.now();
        const timeSinceLoad = currentTime - loadStartTime;

        // Get last observer processing time if available
        let lastProcessingTime = 'N/A';
        if (window.lastObserverProcessingTime) {
            lastProcessingTime = `${window.lastObserverProcessingTime.toFixed(2)}ms`;
        }

        performanceEl.innerHTML = `
            <div>Session Duration: <span class="debug-highlight">${(timeSinceLoad / 1000).toFixed(1)}s</span></div>
            <div>Last Observer Process: <span class="${parseFloat(lastProcessingTime) > 50 ? 'debug-error' : 'debug-success'}">${lastProcessingTime}</span></div>
            <div>Memory: <span class="debug-highlight">${this.getMemoryUsage()}</span></div>
        `;
    },

    /**
     * Get memory usage info if available
     */
    getMemoryUsage: function() {
        if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            const usedHeap = (memory.usedJSHeapSize / 1048576).toFixed(1); // Convert to MB
            const totalHeap = (memory.totalJSHeapSize / 1048576).toFixed(1);
            return `${usedHeap}MB / ${totalHeap}MB`;
        }
        return 'Not available';
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
