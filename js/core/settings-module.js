/**
 * VistaKine Settings Module
 *
 * Manages application settings with the following capabilities:
 *
 * 1. PERSISTENCE: Stores settings in localStorage for a consistent experience
 * 2. CATEGORIES: Organizes settings into logical groups (performance, appearance, accessibility)
 * 3. DEFAULTS: Provides reasonable defaults with auto-detection where possible
 * 4. REAL-TIME UPDATES: Changes take effect immediately without requiring refresh
 * 5. EXTENSIBILITY: New settings can be easily added by other modules
 *
 * The settings panel is triggered from the sidebar and allows users to:
 * - Adjust performance settings (physics detail, render quality)
 * - Customize appearance (theme, font size, contrast)
 * - Configure accessibility options (reduced motion, high contrast)
 * - Reset all settings to defaults
 */

// Ensure VistaKine namespace exists
window.VistaKine = window.VistaKine || {};

// Settings module
VistaKine.settings = {
    // Settings panel elements
    elements: {
        panel: null,
        overlay: null,
        closeButton: null
    },

    // Default settings
    defaults: {
        performance: {
            renderQuality: 'auto', // auto, low, medium, high
            enablePostProcessing: true
        },
        appearance: {
            theme: 'light', // light, dark, auto
            enableAnimations: true
        },
        accessibility: {
            reducedMotion: false,
            highContrast: false,
            fontSize: 'medium' // small, medium, large - moved from appearance
        },
        development: {
            showDebugPanel: false, // Toggle for the debug panel
            physicsQuality: 'auto', // auto, low, medium, high - moved from performance
            physicsDebug: false, // Show physics collision shapes
            maxObjects: 100 // maximum number of physics objects
        }
    },

    // Current settings (populated on init)
    current: {},

    /**
     * Initialize settings module
     */
    init: function() {
        if (VistaKine.state.isInitialized('settings')) {
            console.warn('Settings already initialized');
            return;
        }

        console.log('Initializing settings module');

        // Load settings from localStorage or use defaults
        this.loadSettings();

        // Create settings panel if it doesn't exist
        this.createSettingsPanel();

        // Set up event listeners
        this.setupEventListeners();

        // Apply initial settings
        this.applySettings();

        // Mark as initialized
        VistaKine.state.setInitialized('settings');
        console.log('Settings initialized successfully');
    },

    /**
     * Load settings from localStorage or use defaults
     */
    loadSettings: function() {
        try {
            const savedSettings = localStorage.getItem('vistaKineSettings');
            if (savedSettings) {
                // Parse saved settings
                const parsedSettings = JSON.parse(savedSettings);

                // Merge with defaults (to ensure any new settings are included)
                this.current = this.deepMerge(this.deepClone(this.defaults), parsedSettings);
            } else {
                // Use defaults
                this.current = this.deepClone(this.defaults);

                // Try to detect system preferences for certain settings
                this.detectSystemPreferences();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Fall back to defaults
            this.current = this.deepClone(this.defaults);
        }
    },

    /**
     * Save settings to localStorage
     */
    saveSettings: function() {
        try {
            localStorage.setItem('vistaKineSettings', JSON.stringify(this.current));
            console.log('Settings saved');

            // Dispatch event for other modules
            const event = new CustomEvent('vistakine:settingsUpdated', {
                bubbles: true,
                cancelable: true,
                detail: { settings: this.current }
            });
            document.dispatchEvent(event);
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    },

    /**
     * Reset settings to defaults
     */
    resetSettings: function() {
        this.current = this.deepClone(this.defaults);
        this.detectSystemPreferences();
        this.saveSettings();
        this.applySettings();
        this.updateSettingsUI();
    },

    /**
     * Apply current settings
     */
    applySettings: function() {
        this.applyPerformanceSettings();
        this.applyAppearanceSettings();
        this.applyAccessibilitySettings();
        this.applyDevelopmentSettings();
    },

    /**
     * Apply performance settings
     */
    applyPerformanceSettings: function() {
        const settings = this.current.performance;

        // Apply render quality
        if (VistaKine.renderer) {
            switch (settings.renderQuality) {
                case 'low':
                    // Lower render quality (disable effects, reduce resolution)
                    VistaKine.renderer.setQuality('low');
                    break;
                case 'medium':
                    VistaKine.renderer.setQuality('medium');
                    break;
                case 'high':
                    VistaKine.renderer.setQuality('high');
                    break;
            }
        }

        // Apply post-processing setting
        if (VistaKine.renderer && typeof VistaKine.renderer.setPostProcessing === 'function') {
            VistaKine.renderer.setPostProcessing(settings.enablePostProcessing);
        }
    },

    /**
     * Apply appearance settings
     */
    applyAppearanceSettings: function() {
        const settings = this.current.appearance;

        // Apply theme
        this.applyTheme(settings.theme);

        // Apply animations setting
        document.body.classList.toggle('disable-animations', !settings.enableAnimations);
    },

    /**
     * Apply accessibility settings
     */
    applyAccessibilitySettings: function() {
        const settings = this.current.accessibility;

        // Apply reduced motion
        document.body.classList.toggle('reduced-motion', settings.reducedMotion);

        // Apply high contrast
        document.body.classList.toggle('high-contrast', settings.highContrast);

        // Apply font size - moved from appearance
        this.applyFontSize(settings.fontSize);
    },

    /**
     * Apply theme
     */
    applyTheme: function(theme) {
        // Remove existing theme classes
        document.body.classList.remove('theme-light', 'theme-dark', 'dark-theme', 'light-theme');

        // If auto, detect system preference
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.remove('dark-theme', 'light-theme');
            document.documentElement.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
            document.body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
        } else {
            // Apply specified theme
            document.body.classList.add(`theme-${theme}`);
            document.documentElement.classList.remove('dark-theme', 'light-theme');
            document.documentElement.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
        }
    },

    /**
     * Apply font size
     */
    applyFontSize: function(size) {
        // Remove existing font size classes
        document.body.classList.remove('font-small', 'font-medium', 'font-large');

        // Apply specified font size
        document.body.classList.add(`font-${size}`);
    },

    /**
     * Detect system preferences
     */
    detectSystemPreferences: function() {
        // Detect preferred color scheme
        if (window.matchMedia) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                this.current.appearance.theme = 'dark';
            }

            // Detect prefers-reduced-motion
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReducedMotion) {
                this.current.accessibility.reducedMotion = true;
                this.current.appearance.enableAnimations = false;
            }
        }
    },

    /**
     * Detect device capabilities for performance settings
     */
    detectDeviceCapabilities: function() {
        // Simple detection based on user agent and screen size
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowEndDevice = isMobile && window.screen.width < 768;
        const isHighEndDevice = !isMobile && window.devicePixelRatio > 1;

        // Set physics quality based on device capability
        if (this.current.development.physicsQuality === 'auto') {
            if (isLowEndDevice) {
                this.current.development.physicsQuality = 'low';
            } else if (isHighEndDevice) {
                this.current.development.physicsQuality = 'high';
            } else {
                this.current.development.physicsQuality = 'medium';
            }
        }

        // Set render quality based on device capability
        if (this.current.performance.renderQuality === 'auto') {
            if (isLowEndDevice) {
                this.current.performance.renderQuality = 'low';
                this.current.performance.enablePostProcessing = false;
            } else if (isHighEndDevice) {
                this.current.performance.renderQuality = 'high';
            } else {
                this.current.performance.renderQuality = 'medium';
            }
        }
    },

    /**
     * Apply development settings
     */
    applyDevelopmentSettings: function() {
        const settings = this.current.development;

        // Toggle debug panel
        if (settings.showDebugPanel) {
            if (VistaKine.content && typeof VistaKine.content.showDebugPanel === 'function') {
                VistaKine.content.showDebugPanel();
            }
        } else {
            if (VistaKine.content && typeof VistaKine.content.hideDebugPanel === 'function') {
                VistaKine.content.hideDebugPanel();
            }
        }

        // Apply physics quality - moved from performance
        if (VistaKine.physics) {
            switch (settings.physicsQuality) {
                case 'low':
                    VistaKine.physics.setQuality('low');
                    break;
                case 'medium':
                    VistaKine.physics.setQuality('medium');
                    break;
                case 'high':
                    VistaKine.physics.setQuality('high');
                    break;
            }
        }

        // Apply physics debug setting
        const playground = VistaKine.visualizationEngine?.getActivePlayground();
        if (playground && typeof playground.togglePhysicsDebug === 'function') {
            playground.togglePhysicsDebug(settings.physicsDebug);
        }
    },

    /**
     * Create settings panel
     */
    createSettingsPanel: function() {
        // Check if settings panel already exists
        const existingPanel = document.querySelector('.settings-panel');
        if (existingPanel) {
            this.elements.panel = existingPanel;
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'settings-overlay';
        document.body.appendChild(overlay);
        this.elements.overlay = overlay;

        // Create panel
        const panel = document.createElement('div');
        panel.className = 'settings-panel';
        document.body.appendChild(panel);
        this.elements.panel = panel;

        // Create panel content
        panel.innerHTML = `
            <div class="settings-panel-header">
                <h2>Settings</h2>
                <button class="settings-panel-close" aria-label="Close settings">
                    <i class="ph ph-x"></i>
                </button>
            </div>
            <div class="settings-panel-content">
                <!-- Performance Section -->
                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <i class="ph ph-gauge"></i>
                        Performance
                    </h3>

                    <!-- Render Quality -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Visual Quality</h4>
                        </div>
                        <div class="settings-item-description">
                            Higher quality includes effects like shadows and reflections.
                        </div>
                        <select class="settings-select" id="render-quality">
                            <option value="auto">Auto-detect</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    <!-- Post Processing -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Visual Effects</h4>
                            <label class="toggle-switch">
                                <input type="checkbox" id="post-processing">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="settings-item-description">
                            Enable visual effects like bloom, ambient occlusion, and anti-aliasing.
                        </div>
                    </div>
                </div>

                <!-- Appearance Section -->
                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <i class="ph ph-paint-brush"></i>
                        Appearance
                    </h3>

                    <!-- Theme -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Theme</h4>
                        </div>
                        <select class="settings-select" id="theme">
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="auto">System Default</option>
                        </select>
                    </div>

                    <!-- Animations -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Enable Animations</h4>
                            <label class="toggle-switch">
                                <input type="checkbox" id="enable-animations">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="settings-item-description">
                            Enable transition animations throughout the application.
                        </div>
                    </div>
                </div>

                <!-- Accessibility Section -->
                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <i class="ph ph-accessibility"></i>
                        Accessibility
                    </h3>

                    <!-- Font Size (moved from Appearance) -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Font Size</h4>
                        </div>
                        <div class="settings-item-description">
                            Adjust text size throughout the application for better readability.
                        </div>
                        <select class="settings-select" id="font-size">
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </div>

                    <!-- Reduced Motion -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Reduced Motion</h4>
                            <label class="toggle-switch">
                                <input type="checkbox" id="reduced-motion">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="settings-item-description">
                            Minimizes animations and motion effects throughout the application.
                        </div>
                    </div>

                    <!-- High Contrast -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">High Contrast</h4>
                            <label class="toggle-switch">
                                <input type="checkbox" id="high-contrast">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="settings-item-description">
                            Increases contrast between text and background for better readability.
                        </div>
                    </div>
                </div>

                <!-- Development Section -->
                <div class="settings-section">
                    <h3 class="settings-section-title">
                        <i class="ph ph-code"></i>
                        Development
                    </h3>

                    <!-- Physics Quality (moved from Performance) -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Physics Quality</h4>
                        </div>
                        <div class="settings-item-description">
                            Higher quality simulates more accurate physics but uses more CPU.
                        </div>
                        <select class="settings-select" id="physics-quality">
                            <option value="auto">Auto-detect</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    <!-- Physics Debug Visualization (moved from Performance) -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Physics Debug View</h4>
                            <label class="toggle-switch">
                                <input type="checkbox" id="physics-debug">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="settings-item-description">
                            Show physics collision shapes and debug information.
                        </div>
                    </div>

                    <!-- Max Objects (moved from Performance) -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Maximum Physics Objects</h4>
                            <span id="max-objects-value">100</span>
                        </div>
                        <input type="range" class="range-slider" id="max-objects"
                               min="25" max="500" step="25" value="100">
                        <div class="range-value-display">
                            <span>25</span>
                            <span>500</span>
                        </div>
                    </div>

                    <!-- Debug Panel -->
                    <div class="settings-item">
                        <div class="settings-item-header">
                            <h4 class="settings-item-title">Debug Panel</h4>
                            <label class="toggle-switch">
                                <input type="checkbox" id="debug-panel">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="settings-item-description">
                            Show performance and content loading information for development.
                        </div>
                    </div>
                </div>
            </div>
            <div class="settings-panel-footer">
                <button class="reset-button">Reset to Defaults</button>
            </div>
        `;

        // Store references to important elements
        this.elements.closeButton = panel.querySelector('.settings-panel-close');

        // Event listeners
        this.setupInputListeners();

        // Debug Panel Toggle
        const debugPanel = this.elements.panel.querySelector('#debug-panel');
        if (debugPanel) {
            debugPanel.addEventListener('change', () => {
                this.updateSetting('development.showDebugPanel', debugPanel.checked);
            });
        }
    },

    /**
     * Set up event listeners for settings panel
     */
    setupEventListeners: function() {
        // Settings panel open event
        document.addEventListener('vistakine:openSettings', this.openPanel.bind(this));

        // Close button event
        if (this.elements.closeButton) {
            this.elements.closeButton.addEventListener('click', this.closePanel.bind(this));
        }

        // Overlay click to close
        if (this.elements.overlay) {
            this.elements.overlay.addEventListener('click', this.closePanel.bind(this));
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPanelOpen()) {
                this.closePanel();
            }
        });

        // Save button
        const saveButton = this.elements.panel?.querySelector('.save-button');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.updateSettingsFromInputs();
                this.saveSettings();
                this.applySettings();
                this.closePanel();
            });
        }

        // Reset button
        const resetButton = this.elements.panel?.querySelector('.reset-button');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                if (confirm('Reset all settings to defaults?')) {
                    this.resetSettings();
                }
            });
        }

        // Set up listeners for inputs and selects
        this.setupInputListeners();
    },

    /**
     * Set up input listeners for settings changes
     */
    setupInputListeners: function() {
        if (!this.elements.panel) return;

        // Render Quality
        const renderQuality = this.elements.panel.querySelector('#render-quality');
        if (renderQuality) {
            renderQuality.addEventListener('change', () => {
                this.updateSetting('performance.renderQuality', renderQuality.value);
            });
        }

        // Post Processing
        const postProcessing = this.elements.panel.querySelector('#post-processing');
        if (postProcessing) {
            postProcessing.addEventListener('change', () => {
                this.updateSetting('performance.enablePostProcessing', postProcessing.checked);
            });
        }

        // Theme
        const theme = this.elements.panel.querySelector('#theme');
        if (theme) {
            theme.addEventListener('change', () => {
                this.updateSetting('appearance.theme', theme.value);
                this.applyTheme(theme.value);
            });
        }

        // Animations
        const enableAnimations = this.elements.panel.querySelector('#enable-animations');
        if (enableAnimations) {
            enableAnimations.addEventListener('change', () => {
                this.updateSetting('appearance.enableAnimations', enableAnimations.checked);
                document.body.classList.toggle('disable-animations', !enableAnimations.checked);
            });
        }

        // Font Size (now in Accessibility)
        const fontSize = this.elements.panel.querySelector('#font-size');
        if (fontSize) {
            fontSize.addEventListener('change', () => {
                this.updateSetting('accessibility.fontSize', fontSize.value);
                this.applyFontSize(fontSize.value);
            });
        }

        // Reduced Motion
        const reducedMotion = this.elements.panel.querySelector('#reduced-motion');
        if (reducedMotion) {
            reducedMotion.addEventListener('change', () => {
                this.updateSetting('accessibility.reducedMotion', reducedMotion.checked);
                document.body.classList.toggle('reduced-motion', reducedMotion.checked);
            });
        }

        // High Contrast
        const highContrast = this.elements.panel.querySelector('#high-contrast');
        if (highContrast) {
            highContrast.addEventListener('change', () => {
                this.updateSetting('accessibility.highContrast', highContrast.checked);
                document.body.classList.toggle('high-contrast', highContrast.checked);
            });
        }

        // Physics Quality (now in Development)
        const physicsQuality = this.elements.panel.querySelector('#physics-quality');
        if (physicsQuality) {
            physicsQuality.addEventListener('change', () => {
                this.updateSetting('development.physicsQuality', physicsQuality.value);
            });
        }

        // Physics Debug (now in Development)
        const physicsDebug = this.elements.panel.querySelector('#physics-debug');
        if (physicsDebug) {
            physicsDebug.addEventListener('change', () => {
                this.updateSetting('development.physicsDebug', physicsDebug.checked);
            });
        }

        // Max Objects (now in Development)
        const maxObjects = this.elements.panel.querySelector('#max-objects');
        const maxObjectsValue = this.elements.panel.querySelector('#max-objects-value');
        if (maxObjects && maxObjectsValue) {
            maxObjects.addEventListener('input', () => {
                maxObjectsValue.textContent = maxObjects.value;
                this.updateSetting('development.maxObjects', parseInt(maxObjects.value));
            });
        }

        // Debug Panel
        const debugPanel = this.elements.panel.querySelector('#debug-panel');
        if (debugPanel) {
            debugPanel.addEventListener('change', () => {
                this.updateSetting('development.showDebugPanel', debugPanel.checked);
            });
        }
    },

    /**
     * Update a specific setting
     *
     * @param {string} path - Path to the setting (e.g. 'performance.physicsQuality')
     * @param {any} value - New value for the setting
     */
    updateSetting: function(path, value) {
        const parts = path.split('.');
        let current = this.current;

        // Navigate to the nested property
        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
        }

        // Update the value
        current[parts[parts.length - 1]] = value;
    },

    /**
     * Update settings from UI inputs
     */
    updateSettingsFromInputs: function() {
        if (!this.elements.panel) return;

        // Performance settings
        const renderQuality = this.elements.panel.querySelector('#render-quality');
        if (renderQuality) {
            this.current.performance.renderQuality = renderQuality.value;
        }

        const postProcessing = this.elements.panel.querySelector('#post-processing');
        if (postProcessing) {
            this.current.performance.enablePostProcessing = postProcessing.checked;
        }

        // Appearance settings
        const theme = this.elements.panel.querySelector('#theme');
        if (theme) {
            this.current.appearance.theme = theme.value;
        }

        const enableAnimations = this.elements.panel.querySelector('#enable-animations');
        if (enableAnimations) {
            this.current.appearance.enableAnimations = enableAnimations.checked;
        }

        // Accessibility settings
        const reducedMotion = this.elements.panel.querySelector('#reduced-motion');
        if (reducedMotion) {
            this.current.accessibility.reducedMotion = reducedMotion.checked;
        }

        const highContrast = this.elements.panel.querySelector('#high-contrast');
        if (highContrast) {
            this.current.accessibility.highContrast = highContrast.checked;
        }

        const fontSize = this.elements.panel.querySelector('#font-size');
        if (fontSize) {
            this.current.accessibility.fontSize = fontSize.value;
        }

        // Development settings
        const debugPanel = this.elements.panel.querySelector('#debug-panel');
        if (debugPanel) {
            this.current.development.showDebugPanel = debugPanel.checked;
        }

        const physicsQuality = this.elements.panel.querySelector('#physics-quality');
        if (physicsQuality) {
            this.current.development.physicsQuality = physicsQuality.value;
        }

        const physicsDebug = this.elements.panel.querySelector('#physics-debug');
        if (physicsDebug) {
            this.current.development.physicsDebug = physicsDebug.checked;
        }

        const maxObjects = this.elements.panel.querySelector('#max-objects');
        if (maxObjects) {
            this.current.development.maxObjects = parseInt(maxObjects.value);
        }
    },

    /**
     * Update UI to reflect current settings
     */
    updateSettingsUI: function() {
        if (!this.elements.panel) return;

        // Performance settings
        const renderQuality = this.elements.panel.querySelector('#render-quality');
        if (renderQuality) {
            renderQuality.value = this.current.performance.renderQuality;
        }

        const postProcessing = this.elements.panel.querySelector('#post-processing');
        if (postProcessing) {
            postProcessing.checked = this.current.performance.enablePostProcessing;
        }

        // Appearance settings
        const theme = this.elements.panel.querySelector('#theme');
        if (theme) {
            theme.value = this.current.appearance.theme;
        }

        const enableAnimations = this.elements.panel.querySelector('#enable-animations');
        if (enableAnimations) {
            enableAnimations.checked = this.current.appearance.enableAnimations;
        }

        // Accessibility settings
        const reducedMotion = this.elements.panel.querySelector('#reduced-motion');
        if (reducedMotion) {
            reducedMotion.checked = this.current.accessibility.reducedMotion;
        }

        const highContrast = this.elements.panel.querySelector('#high-contrast');
        if (highContrast) {
            highContrast.checked = this.current.accessibility.highContrast;
        }

        const fontSize = this.elements.panel.querySelector('#font-size');
        if (fontSize) {
            fontSize.value = this.current.accessibility.fontSize;
        }

        // Development settings
        const debugPanel = this.elements.panel.querySelector('#debug-panel');
        if (debugPanel) {
            debugPanel.checked = this.current.development.showDebugPanel;
        }

        const physicsQuality = this.elements.panel.querySelector('#physics-quality');
        if (physicsQuality) {
            physicsQuality.value = this.current.development.physicsQuality;
        }

        const physicsDebug = this.elements.panel.querySelector('#physics-debug');
        if (physicsDebug) {
            physicsDebug.checked = this.current.development.physicsDebug;
        }

        const maxObjectsValue = this.elements.panel.querySelector('#max-objects-value');
        if (maxObjectsValue) {
            maxObjectsValue.textContent = this.current.development.maxObjects;
        }

        const maxObjects = this.elements.panel.querySelector('#max-objects');
        if (maxObjects) {
            maxObjects.value = this.current.development.maxObjects;
        }
    },

    /**
     * Open settings panel
     */
    openPanel: function() {
        if (!this.elements.panel || !this.elements.overlay) return;

        // Update UI with current settings
        this.updateSettingsUI();

        // Show panel and overlay
        this.elements.panel.classList.add('open');
        this.elements.overlay.classList.add('visible');

        // Update state if available
        if (VistaKine.state && typeof VistaKine.state.set === 'function') {
            VistaKine.state.set('ui.settings.isOpen', true);
        }
    },

    /**
     * Close settings panel
     */
    closePanel: function() {
        if (!this.elements.panel || !this.elements.overlay) return;

        // Hide panel and overlay
        this.elements.panel.classList.remove('open');
        this.elements.overlay.classList.remove('visible');

        // Update state if available
        if (VistaKine.state && typeof VistaKine.state.set === 'function') {
            VistaKine.state.set('ui.settings.isOpen', false);
        }
    },

    /**
     * Check if settings panel is open
     *
     * @returns {boolean} True if panel is open
     */
    isPanelOpen: function() {
        return this.elements.panel?.classList.contains('open') || false;
    },

    /**
     * Get a specific setting
     *
     * @param {string} path - Path to the setting (e.g. 'performance.physicsQuality')
     * @param {any} defaultValue - Default value if setting not found
     * @returns {any} The setting value or default if not found
     */
    get: function(path, defaultValue) {
        const parts = path.split('.');
        let current = this.current;

        // Navigate to the nested property
        for (let i = 0; i < parts.length; i++) {
            if (current[parts[i]] === undefined) {
                return defaultValue;
            }
            current = current[parts[i]];
        }

        return current;
    },

    /**
     * Set a specific setting
     *
     * @param {string} path - Path to the setting (e.g. 'performance.physicsQuality')
     * @param {any} value - New value for the setting
     * @param {boolean} apply - Whether to apply the setting immediately (default: true)
     * @param {boolean} save - Whether to save settings after update (default: true)
     */
    set: function(path, value, apply = true, save = true) {
        this.updateSetting(path, value);

        if (apply) {
            this.applySettings();
        }

        if (save) {
            this.saveSettings();
        }
    },

    /**
     * Deep clone an object (for creating copies of settings objects)
     *
     * @param {object} obj - Object to clone
     * @returns {object} Cloned object
     */
    deepClone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Deep merge two objects
     *
     * @param {object} target - Target object
     * @param {object} source - Source object
     * @returns {object} Merged object
     */
    deepMerge: function(target, source) {
        const output = { ...target };

        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }

        return output;
    },

    /**
     * Check if value is an object
     *
     * @param {any} item - Value to check
     * @returns {boolean} True if value is an object
     */
    isObject: function(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
};

// Initialize settings when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if we need to initialize now or wait for the loader
    if (window.VistaKine && window.VistaKine.loader) {
        console.log('Settings module loaded, waiting for loader');
    } else {
        console.log('Initializing settings directly');
        // Check for required dependencies
        if (!window.VistaKine.state) {
            console.warn('State module not found, creating minimal implementation');
            window.VistaKine.state = {
                isInitialized: () => false,
                setInitialized: () => {},
                get: (key, defaultValue) => defaultValue,
                set: () => {}
            };
        }

        // Initialize device detection if not available
        if (!window.VistaKine.device) {
            console.warn('Device module not found, creating minimal implementation');
            window.VistaKine.device = {
                isMobile: () => window.innerWidth < 768,
                isTablet: () => window.innerWidth >= 768 && window.innerWidth < 992
            };
        }

        VistaKine.settings.init();
    }
});
