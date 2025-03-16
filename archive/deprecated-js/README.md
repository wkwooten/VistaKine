# Archived JavaScript Files

This directory contains archived JavaScript files that were part of the original VistaKine implementation before the codebase was refactored to use a modular architecture.

## Files

- `sidebar-resize.js` - Original sidebar functionality (now replaced by `js/core/sidebar-module.js`)
- `book-loader.js` - Original content loading and navigation (now split into `js/core/content-module.js` and `js/core/navigation-module.js`)
- `visualization-engine.js` - Original visualization engine (referenced in the new modular architecture but not yet refactored)

## Reason for Archiving

These files were archived as part of a major refactoring effort to improve code organization, maintainability, and robustness. The new modular architecture separates concerns into distinct modules with clear dependencies and initialization sequences.

## Date of Archiving

Archived on: March 2025

## Note

These files are kept for reference purposes only and are no longer in active use. Please refer to the new modular implementation in the `js/core/` directory for the current codebase.