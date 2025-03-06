# VistaKine JavaScript Architecture

This directory contains the JavaScript code for the VistaKine interactive physics textbook.

## Directory Structure

- `js/core/` - Core modules for the application
  - `main.js` - Entry point and module loader
  - `vistaKine-core.js` - Core utilities and shared functionality
  - `navigation-module.js` - Navigation functionality
  - `sidebar-module.js` - Sidebar functionality
  - `content-module.js` - Content loading and management
  - `ChapterManager.js` - Chapter management
  - `SceneManager.js` - Scene management

- `js/visualization/` - Visualization engine and related code
  - `visualization-engine.js` - 3D visualization engine

- `js/archive/` - Archived files from previous versions (for reference only)
  - `book-loader.js` - Old book loading functionality
  - `sidebar-resize.js` - Old sidebar resize functionality
  - `visualization-engine.js` - Backup copy of visualization engine

## Module System

VistaKine uses a modular architecture with a dependency-based loading system:

1. `main.js` initializes the `VistaKine.loader` which manages module loading
2. Core modules are loaded first, followed by feature modules
3. Each module registers with the `VistaKine` namespace
4. Modules can specify dependencies which are loaded automatically

## Debugging

For debugging issues:

1. Open browser console (F12) to view detailed logging
2. Check for any error messages in the console
3. The loader includes fallback initialization for robustness
4. Error messages will be displayed to users via toast notifications

## Cache Busting

To prevent caching issues, the main.js file includes a cache-busting parameter:
```html
<script src="js/core/main.js?_=1615824"></script>
```

Update this timestamp when making significant changes to force browsers to reload the latest version.

## Adding New Modules

To add a new module:

1. Create a new file in the appropriate directory
2. Register with the VistaKine namespace
3. Add the module path to `VistaKine.loader.modulePaths`
4. Specify dependencies in `VistaKine.loader.dependencies`
5. Call the module's init function when ready

Example module structure:
```javascript
// Register with VistaKine namespace
VistaKine.myModule = {
    initialized: false,

    init: function() {
        if (this.initialized) return;
        console.log('Initializing my module');

        // Module initialization code

        this.initialized = true;
    }
};

// Register with core if available
if (typeof VistaKine.registerModule === 'function') {
    VistaKine.registerModule('myModule', VistaKine.myModule);
}
```