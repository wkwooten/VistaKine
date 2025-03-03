import { SceneManager } from './core/SceneManager.js';
import { ChapterManager } from './core/ChapterManager.js';
import Navigation from './navigation.js';

class App {
    constructor() {
        this.sceneManager = new SceneManager('scene-container');
        this.chapterManager = new ChapterManager('chapter-list', 'content-container');
        this.navigation = new Navigation();

        this.init();
    }

    init() {
        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.sceneManager.onWindowResize();
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