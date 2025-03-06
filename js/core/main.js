/**
 * VistaKine Main Entry Point
 * Orchestrates the loading and initialization of all modules
 */

// Create the VistaKine namespace if it doesn't exist
if (!window.VistaKine) {
    window.VistaKine = {};
}

// Module loader system
// This is the central system for loading all VistaKine modules
VistaKine.loader = {
    loadedModules: new Set(),
    failedModules: new Set(),
    loadAttempts: {},
    initReady: false,
    debugMode: true, // Set to true for detailed console logging

    // Module paths configuration
    modulePaths: {
        'core': 'js/core/vistaKine-core.js',
        'navigation': 'js/core/navigation-module.js',
        'sidebar': 'js/core/sidebar-module.js',
        'content': 'js/core/content-module.js',
        'visualization': 'js/visualization/visualization-engine.js'
    },

    // Module dependencies
    dependencies: {
        'navigation': ['core'],
        'sidebar': ['core', 'navigation'],
        'content': ['core', 'navigation'],
        'visualization': ['core', 'content']
    },

    // Main initialization method
    init: function() {
        console.log('VistaKine loader initializing');
        this.debugMode && console.log('Module loading sequence starting');

        // Print available modules
        this.debugMode && console.log('Available module paths:', Object.keys(this.modulePaths).join(', '));

        try {
            // First load the core module, then load the other modules
            this.loadModule('core', function() {
                this.debugMode && console.log('Core module loaded, proceeding with remaining modules');

                // Load the rest of the modules
                this.loadModule('navigation');
                this.loadModule('sidebar');
                this.loadModule('content');
                this.loadModule('visualization', () => {
                    // After visualization is loaded, check if it initialized properly
                    if (VistaKine.visualization && VistaKine.visualization.initialized) {
                        console.log('Visualization module loaded and initialized successfully');

                        // Check if initial sections need visualization
                        if (VistaKine.visualization.scanForContainers) {
                            console.log('Scanning for initial visualization containers');
                            VistaKine.visualization.scanForContainers();
                        }
                    } else {
                        console.warn('Visualization module loaded but not properly initialized');
                    }
                });

                // Set up fallback initialization for robustness
                this.setupFallbackInitialization();
            }.bind(this));
        } catch (error) {
            console.error('Fatal error during initialization:', error);
            this.showErrorMessage('A critical error occurred during initialization. Please check the console for details.');
        }
    },

    // Load a module by name with optional callback
    loadModule: function(moduleName, callback) {
        // Record load attempt
        this.loadAttempts[moduleName] = (this.loadAttempts[moduleName] || 0) + 1;

        // Check if the module is already loaded
        if (this.loadedModules.has(moduleName)) {
            this.debugMode && console.log(`Module '${moduleName}' already loaded, skipping`);
            if (callback) callback();
            return;
        }

        // Check dependencies first
        this.debugMode && console.log(`Loading module: ${moduleName}`);

        try {
            const modulePath = this.modulePaths[moduleName];
            if (!modulePath) {
                throw new Error(`Module path not defined for '${moduleName}'`);
            }

            // Check and load dependencies first
            const deps = this.dependencies[moduleName] || [];
            this.loadDependencies(deps, () => {
                this.debugMode && console.log(`Dependencies for '${moduleName}' satisfied, loading module from ${modulePath}`);

                // Create script element
                const script = document.createElement('script');
                script.src = modulePath + '?_=' + (window.vistaKineInitTime || Date.now());
                script.async = false;

                // Handle success
                script.onload = () => {
                    this.debugMode && console.log(`Module '${moduleName}' loaded successfully`);
                    this.loadedModules.add(moduleName);

                    // Special handling for visualization module
                    if (moduleName === 'visualization' && typeof VistaKine.visualization === 'object') {
                        // Initialize the visualization module
                        this.debugMode && console.log('Initializing visualization module after load');
                        try {
                            if (typeof VistaKine.visualization.init === 'function') {
                                VistaKine.visualization.init();
                            }
                        } catch (initError) {
                            console.error('Error initializing visualization module:', initError);
                        }
                    }

                    if (callback) callback();
                };

                // Handle errors
                script.onerror = (e) => {
                    console.error(`Failed to load module '${moduleName}' from ${modulePath}`, e);
                    this.failedModules.add(moduleName);

                    // Try a different path if this is the visualization module
                    if (moduleName === 'visualization' && this.loadAttempts[moduleName] === 1) {
                        console.log('Attempting to load visualization module from archive...');
                        this.modulePaths.visualization = 'js/archive/visualization-engine.js';
                        setTimeout(() => this.loadModule(moduleName, callback), 100);
                    } else {
                        this.showErrorMessage(`Failed to load module '${moduleName}'. Check the console for details.`);
                        if (callback) callback(new Error(`Failed to load module '${moduleName}'`));
                    }
                };

                // Append to document
                document.head.appendChild(script);
            });
        } catch (error) {
            console.error(`Error loading module '${moduleName}':`, error);
            this.failedModules.add(moduleName);
            this.showErrorMessage(`Error loading module '${moduleName}': ${error.message}`);
            if (callback) callback(error);
        }
    },

    // Load all dependencies for a module
    loadDependencies: function(dependencies, callback) {
        if (!dependencies || dependencies.length === 0) {
            callback();
            return;
        }

        let loaded = 0;
        const checkDone = () => {
            loaded++;
            if (loaded === dependencies.length) {
                callback();
            }
        };

        this.debugMode && console.log(`Loading dependencies: ${dependencies.join(', ')}`);
        dependencies.forEach(dep => {
            if (this.loadedModules.has(dep)) {
                checkDone();
            } else {
                this.loadModule(dep, checkDone);
            }
        });
    },

    // Set up fallback initialization after a timeout
    setupFallbackInitialization: function() {
        setTimeout(() => {
            if (this.initReady) return;

            console.log('Fallback initialization triggered');

            // Check if we need to initialize any core components
            if (typeof VistaKine.content === 'object' && typeof VistaKine.content.init === 'function' && !VistaKine.content.initialized) {
                console.log('Initializing content module from fallback');
                try {
                    VistaKine.content.init();
                } catch (e) {
                    console.error('Error during content fallback initialization', e);
                }
            }

            if (typeof VistaKine.sidebar === 'object' && typeof VistaKine.sidebar.init === 'function' && !VistaKine.sidebar.initialized) {
                console.log('Initializing sidebar module from fallback');
                try {
                    VistaKine.sidebar.init();
                } catch (e) {
                    console.error('Error during sidebar fallback initialization', e);
                }
            }

            if (typeof VistaKine.navigation === 'object' && typeof VistaKine.navigation.init === 'function' && !VistaKine.navigation.initialized) {
                console.log('Initializing navigation module from fallback');
                try {
                    VistaKine.navigation.init();
                } catch (e) {
                    console.error('Error during navigation fallback initialization', e);
                }
            }

            this.initReady = true;
        }, 2000);
    },

    // Display an error message to the user
    showErrorMessage: function(message) {
        console.error('VistaKine Error:', message);

        // Create a user-friendly error toast
        const toast = document.createElement('div');
        toast.className = 'vistaKine-error-toast';
        toast.innerHTML = `
            <div class="error-content">
                <div class="error-title">VistaKine Error</div>
                <div class="error-message">${message}</div>
                <div class="error-actions">
                    <button onclick="location.reload()">Reload Page</button>
                    <button onclick="this.parentNode.parentNode.parentNode.remove()">Dismiss</button>
                </div>
            </div>
        `;

        // Add styles for the toast
        const style = document.createElement('style');
        style.textContent = `
            .vistaKine-error-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #fff;
                border-left: 4px solid #f44336;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                padding: 15px;
                z-index: 10000;
                max-width: 350px;
                font-family: Arial, sans-serif;
            }
            .vistaKine-error-toast .error-title {
                font-weight: bold;
                margin-bottom: 8px;
                color: #f44336;
            }
            .vistaKine-error-toast .error-message {
                margin-bottom: 12px;
                color: #333;
            }
            .vistaKine-error-toast .error-actions {
                display: flex;
                justify-content: flex-end;
            }
            .vistaKine-error-toast button {
                background: #f1f1f1;
                border: none;
                padding: 5px 10px;
                margin-left: 8px;
                cursor: pointer;
                font-size: 13px;
            }
            .vistaKine-error-toast button:hover {
                background: #e0e0e0;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(toast);

        // Remove after 15 seconds
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.remove();
            }
        }, 15000);
    }
};

// Initialize the loader when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Store global initialization timestamp
    window.vistaKineInitTime = Date.now();

    console.log('------------------ VistaKine Initialization Start ------------------');
    console.log('DOM Content Loaded at:', new Date().toISOString());
    console.log('User Agent:', navigator.userAgent);
    console.log('Document Path:', window.location.pathname);

    // First, check if we're on GitHub Pages and need to set up the environment
    if (window.location.hostname.endsWith('github.io') ||
        window.location.hostname.endsWith('githubusercontent.com')) {

        // Define GitHub Pages configuration if it doesn't exist
        if (!window.vistaKineConfig) {
            console.log('Setting up GitHub Pages configuration');

            // Extract repository name from URL
            const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
            const repoName = pathParts.length > 0 ? pathParts[0] : '';

            window.vistaKineConfig = {
                isGitHubPages: true,
                repoName: repoName,
                debug: true,
                getResourcePath: function(path) {
                    // Strip leading slashes
                    const cleanPath = path.replace(/^\/+/, '');

                    // Add repo name if needed
                    if (this.repoName && !cleanPath.startsWith(this.repoName + '/')) {
                        return `/${this.repoName}/${cleanPath}`;
                    }

                    return '/' + cleanPath;
                }
            };

            console.log('GitHub Pages configuration:', window.vistaKineConfig);
        }
    } else {
        console.log('Local environment detected');
    }

    // Start the loader after a small delay to ensure everything is ready
    setTimeout(function() {
        console.log('Starting loader initialization');
        VistaKine.loader.init();
    }, 50);
});