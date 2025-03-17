import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// Make THREE available globally for legacy code
window.THREE = THREE;
window.OrbitControls = OrbitControls;
window.TransformControls = TransformControls;

// Use Phosphor Icons from CDN or local based on environment
// Local import works in Vite development but not in GitHub Pages
try {
  if (!window.isGitHubPages) {
    // For local development, try to import from node_modules
    import('../node_modules/@phosphor-icons/web/src/regular/style.css')
      .catch(err => console.warn('Could not load Phosphor icons from node_modules, using CDN instead', err));
  }
} catch (e) {
  console.warn('Phosphor icons import error, will fall back to CDN', e);
}

console.log('THREE.js setup complete:', THREE.REVISION);
