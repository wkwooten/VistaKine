import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// Make THREE available globally for legacy code
window.THREE = THREE;
window.OrbitControls = OrbitControls;
window.TransformControls = TransformControls;

// Use CDN for Phosphor Icons instead of local import
// The local import path won't work properly on GitHub Pages
// Import removed: import '../node_modules/@phosphor-icons/web/src/regular/style.css';

console.log('THREE.js setup complete:', THREE.REVISION);
