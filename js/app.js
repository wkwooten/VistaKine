import { SceneManager } from './core/SceneManager.js';
import { ChapterManager } from './core/ChapterManager.js';
import Navigation from './navigation.js';

class App {
    constructor() {
        // Initialize navigation first as it's needed on all pages
        this.navigation = new Navigation();

        // Check if we're on a page that needs 3D scenes
        if (document.getElementById('scene-container')) {
            this.sceneManager = new SceneManager('scene-container');
        } else {
            console.log('No scene container found. Skipping 3D initialization.');
            // Create a stub SceneManager to prevent errors
            this.sceneManager = {
                onWindowResize: () => {},
                update: () => {}
            };
        }

        // Initialize chapter manager for chapter content
        if (document.getElementById('chapter-list') && document.getElementById('content-container')) {
            this.chapterManager = new ChapterManager('chapter-list', 'content-container');
        } else {
            console.log('No chapter content container found. Skipping chapter manager initialization.');
            // Create a stub ChapterManager to prevent errors
            this.chapterManager = {
                update: () => {}
            };
        }

        this.init();
    }

    init() {
        // Start animation loop if needed
        if (this.sceneManager.update) {
            this.animate();
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.sceneManager.onWindowResize) {
                this.sceneManager.onWindowResize();
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.sceneManager.update();
    }
}

// Start the application when the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    new App();
});