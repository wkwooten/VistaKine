/**
 * VistaKine Content Loader
 *
 * This module provides dynamic content loading for the VistaKine platform
 * while preserving the existing sidebar navigation structure.
 */

// Development mode - when true, enables more verbose logging and fallbacks
const DEV_MODE = true;

// Detect environment type
const ENV = {
  isLocalFileAccess: window.location.protocol === 'file:',
  isLiveServer: window.location.host.includes('127.0.0.1') ||
                window.location.host.includes('localhost') ||
                /:\d{4,5}$/.test(window.location.host),
  get isWebServer() {
    return !this.isLocalFileAccess && !this.isLiveServer;
  }
};

// Log environment on startup
if (DEV_MODE) {
  console.log("VistaKine Environment:", {
    protocol: window.location.protocol,
    host: window.location.host,
    path: window.location.pathname,
    isLocalFileAccess: ENV.isLocalFileAccess,
    isLiveServer: ENV.isLiveServer,
    isWebServer: ENV.isWebServer
  });
}

// Cache for loaded content to minimize repeated network requests
const contentCache = {};

// Track user progress
const userProgress = {
  completedSections: new Set(),
  currentSectionId: null,
  readingProgress: {}
};

/**
 * Initialize the content loader system
 */
function initializeContentLoader() {
  // Log initialization in dev mode
  if (DEV_MODE) {
    console.log("VistaKine Content Loader initializing...");
    console.log("Current URL:", window.location.href);
    console.log("Protocol:", window.location.protocol);
    console.log("Pathname:", window.location.pathname);
  }

  // Set up navigation handlers
  setupNavigationHandlers();

  // Check for URL state (path or hash)
  const contentId = window.location.hash.substring(1) || getDefaultContentForPath();
  if (contentId) {
    loadContent(contentId);
  }

  // Set up scroll tracking for progress indication
  setupScrollTracking();

  // Listen for URL changes
  window.addEventListener('popstate', handlePopState);
}

/**
 * Determine default content for current path
 */
function getDefaultContentForPath() {
  const path = window.location.pathname;

  // Default content mapping for different paths
  if (path.includes('/index.html') || path === '/' || path.endsWith('/app.html')) {
    return 'cover';
  } else if (path.includes('/about')) {
    return 'about';
  } else if (path.includes('/vectors')) {
    return 'vectors-and-cross-products';
  } else if (path.includes('/chapters')) {
    return 'vectors-and-cross-products'; // Default chapter content
  }

  return 'cover'; // Default fallback
}

/**
 * Handle browser history navigation
 */
function handlePopState(event) {
  const contentId = window.location.hash.substring(1) || getDefaultContentForPath();
  if (contentId) {
    loadContent(contentId, false); // Don't push state again when navigating back/forward
  }
}

/**
 * Attach event handlers to navigation links
 */
function setupNavigationHandlers() {
  // Get all navigation links with data-content-id attribute
  const navLinks = document.querySelectorAll('[data-content-id]');

  navLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      // Always prevent default navigation
      event.preventDefault();

      const contentId = this.getAttribute('data-content-id');
      const sectionId = this.getAttribute('data-section-id');

      if (contentId) {
        // Update URL with hash
        const newUrl = `#${contentId}${sectionId ? '-' + sectionId : ''}`;

        // Load the content
        loadContent(contentId, true, sectionId);

        // Update URL (this is separated from loadContent to allow loadContent to be called without changing the URL)
        window.history.pushState({contentId, sectionId}, '', newUrl);
      }
    });
  });
}

/**
 * Load content from the specified content ID
 */
function loadContent(contentId, pushState = true, sectionId = null, shouldAppend = true) {
  const contentContainer = document.getElementById('interactive-content');
  if (!contentContainer) {
    if (DEV_MODE) console.error("Content container not found");
    return;
  }

  if (DEV_MODE) console.log(`Loading: ${contentId} | Push: ${pushState} | Section: ${sectionId || 'none'} | Append: ${shouldAppend}`);

  // Show loading state
  contentContainer.classList.add('loading');

  // Clear container if not appending
  if (!shouldAppend) {
    contentContainer.innerHTML = '';
  }

  // Special case for cover page - never append this
  if (contentId === 'cover') {
    loadCoverPage();
    return;
  }

  // Update active state in navigation
  updateActiveNavigation(contentId);

  // Use cached content when available
  if (contentCache[contentId]) {
    if (DEV_MODE) console.log(`Using cached: ${contentId}`);
    appendContent(contentId, contentCache[contentId], sectionId);
    return;
  }

  // Get correct base URL
  const baseUrl = getBaseUrl();

  // Generate appropriate paths based on environment
  const pathVariations = getPathVariationsForEnvironment(baseUrl, contentId);

  if (DEV_MODE) {
    console.log(`Trying paths for ${ENV.isLocalFileAccess ? 'local file' : ENV.isLiveServer ? 'Live Server' : 'web server'}`);
    pathVariations.forEach((path, index) => console.log(`  ${index + 1}. ${path}`));
  }

  // Try loading from multiple paths until one succeeds
  tryLoadingFromPaths(pathVariations, 0, contentId, sectionId, pushState);
}

/**
 * Get path variations based on current environment
 */
function getPathVariationsForEnvironment(baseUrl, contentId) {
  const standardPaths = [
    `${baseUrl}content/${contentId}.json`,
    `content/${contentId}.json`,
    `./content/${contentId}.json`,
    `../content/${contentId}.json`
  ];

  if (ENV.isLocalFileAccess) {
    return [
      ...standardPaths,
      `C:/Users/Ki/Documents/GitHub/VistaKine/content/${contentId}.json`,
      `${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}/content/${contentId}.json`,
      `${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}/content/${contentId}.json`.replace(/\\/g, '/'),
      `${contentId}.json`
    ];
  }

  if (ENV.isLiveServer) {
    return standardPaths;
  }

  return [`${baseUrl}content/${contentId}.json`];
}

/**
 * Try loading content from multiple paths until successful
 */
function tryLoadingFromPaths(paths, index, contentId, sectionId, pushState) {
  if (index >= paths.length) {
    // All paths failed - show helpful error message
    handleContentLoadingError(paths, contentId);
    return;
  }

  // Clean up the path for better compatibility
  let path = paths[index];
  path = path.replace(/\/\//g, '/'); // Fix double slashes

  if (DEV_MODE) console.log(`Trying path ${index + 1}/${paths.length}: ${path}`);

  fetchContent(path, contentId, sectionId, pushState)
    .catch(error => {
      if (DEV_MODE) console.log(`Failed: ${path} - ${error.message}`);
      tryLoadingFromPaths(paths, index + 1, contentId, sectionId, pushState);
    });
}

/**
 * Display error message when content loading fails
 */
function handleContentLoadingError(paths, contentId) {
  const contentContainer = document.getElementById('interactive-content');

  if (DEV_MODE) {
    console.error(`Failed to load '${contentId}' after trying all paths`);
    console.error("Paths attempted:", paths);
  }

  // Create environment-specific tips
  let environmentTips = '';
  if (ENV.isLiveServer) {
    environmentTips = createLiveServerTips(contentId);
  } else if (ENV.isLocalFileAccess) {
    environmentTips = createFileProtocolTips(contentId);
  }

  // Create clickable links for paths
  const pathListItems = paths.map(path => {
    const encodedPath = path.replace(/'/g, "\\'");
    const displayPath = path.replace(/\\/g, '/').replace(/\/\//g, '/');
    return `<li>
      ${displayPath}
      <a href="javascript:void(0)" onclick="window.open('${encodedPath}')">Try direct link</a>
    </li>`;
  }).join('');

  // Display user-friendly error message
  contentContainer.innerHTML = `
    <div class="error-message">
      <h3>Content Not Available</h3>
      <p>Sorry, the content "${contentId}" could not be loaded.</p>
      <p>Paths attempted:</p>
      <ul>${pathListItems}</ul>
      <div class="error-help">
        <h4>Troubleshooting:</h4>
        <ul>
          <li>Verify the file exists: "${contentId}.json"</li>
          <li>Environment: ${ENV.isLiveServer ? 'Live Server' : ENV.isLocalFileAccess ? 'Local File' : 'Web Server'}</li>
          <li>Protocol: ${window.location.protocol}</li>
        </ul>
        ${environmentTips}
      </div>
    </div>
  `;

  contentContainer.classList.remove('loading');
}

/**
 * Create Live Server specific troubleshooting tips
 */
function createLiveServerTips(contentId) {
  return `
    <div class="environment-tips">
      <h4>Live Server Tips:</h4>
      <ul>
        <li>Verify Live Server is running from project root</li>
        <li>Try opening <a href="/content/${contentId}.json" target="_blank">/content/${contentId}.json</a> directly</li>
        <li>Check server permissions for content directory</li>
      </ul>
    </div>
  `;
}

/**
 * Create File Protocol specific troubleshooting tips
 */
function createFileProtocolTips(contentId) {
  return `
    <div class="environment-tips">
      <h4>Local File Access Tips:</h4>
      <ul>
        <li>Browsers restrict loading local JSON files for security</li>
        <li>Use Live Server instead (install in VS Code)</li>
        <li>Absolute path to try: file:///C:/Users/Ki/Documents/GitHub/VistaKine/content/${contentId}.json</li>
      </ul>
    </div>
  `;
}

/**
 * Fetch content from a specific path and display it
 */
function fetchContent(contentPath, contentId, sectionId, pushState) {
  if (DEV_MODE) console.log(`Fetching: ${contentPath}`);

  return fetch(contentPath)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data) throw new Error('Invalid JSON: empty response');

      if (DEV_MODE) console.log(`✅ Loaded: ${contentId}`);

      // Cache and display content
      contentCache[contentId] = data;
      displayContent(contentId, data, sectionId);

      // Update browser history if requested
      if (pushState) updateBrowserHistory(contentId, sectionId);

      return data; // Return data for promise chaining
    })
    .catch(error => {
      if (DEV_MODE) console.error(`Error: ${error.message} | Path: ${contentPath}`);
      throw error; // Re-throw for the caller to handle
    });
}

/**
 * Get the base URL for content loading
 *
 * @returns {string} The base URL to use for content loading
 */
function getBaseUrl() {
  if (DEV_MODE) {
    console.log("Getting base URL for environment:", {
      isLocalFileAccess: ENV.isLocalFileAccess,
      isLiveServer: ENV.isLiveServer,
      isWebServer: ENV.isWebServer,
      pathname: window.location.pathname
    });
  }

  // For local file access (without server)
  if (ENV.isLocalFileAccess) {
    // When running from file://, try to create a relative path
    const fullPath = window.location.pathname;

    // Windows path handling (convert backslashes to forward slashes)
    const normalizedPath = fullPath.replace(/\\/g, '/');

    if (DEV_MODE) {
      console.log("Local file access path details:", {
        fullPath,
        normalizedPath
      });
    }

    // Simplified approach - check for common subdirectories
    if (normalizedPath.includes('/Vectors/') ||
        normalizedPath.includes('/About/') ||
        normalizedPath.includes('/Chapters/')) {
      if (DEV_MODE) console.log("In subdirectory, using '../' as base URL");
      return '../';
    }

    if (DEV_MODE) console.log("Using empty string as base URL for root access");
    return '';
  }

  // For Live Server
  if (ENV.isLiveServer) {
    // Live Server usually serves from the project root
    // But we need to check if we're in a subdirectory
    const pathParts = window.location.pathname.split('/').filter(Boolean);

    if (DEV_MODE) {
      console.log("Live Server path analysis:", {
        pathParts,
        pathname: window.location.pathname
      });
    }

    // If in a subdirectory like /Vectors/, go up one level
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart === 'Vectors' || lastPart === 'About' || lastPart === 'Chapters' ||
          lastPart.endsWith('.html')) {

        // Calculate how many directories to go up
        const directoriesToGoUp = 1; // Usually just one level

        if (DEV_MODE) console.log(`In Live Server subdirectory, going up ${directoriesToGoUp} level(s)`);

        // For HTML files in subdirectories we need to go up one level
        return '/';
      }
    }

    // At project root in Live Server
    if (DEV_MODE) console.log("At Live Server root, using '/' as base URL");
    return '/';
  }

  // For production web server
  if (DEV_MODE) {
    console.log("Getting base URL for production web server");
  }

  // Simplified logic for web server
  let basePath = '/';

  // If we're in a subdirectory like /Vectors/, go up one level
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart === 'Vectors' || lastPart === 'About' || lastPart === 'Chapters' ||
        lastPart.endsWith('.html')) {
      // Remove the last directory/file from the path
      pathParts.pop();
      basePath = '/' + pathParts.join('/') + '/';
    }
  }

  if (DEV_MODE) console.log("Using base URL:", basePath);
  return basePath;
}

/**
 * Load the cover page content
 */
function loadCoverPage() {
  // Get references to elements
  const contentContainer = document.getElementById('interactive-content');
  const chapterNav = document.getElementById('chapter-nav');

  if (!contentContainer) return;

  // Hide navigation for cover page
  if (chapterNav) {
    chapterNav.classList.add('hidden');
    document.body.classList.add('cover-page-body');
  }

  // Get base URL
  const baseUrl = getBaseUrl();

  // Fetch from cover.json or embed directly
  fetch(`${baseUrl}content/cover.json`)
    .then(response => response.json())
    .then(data => {
      // Display cover content
      contentContainer.innerHTML = `
        <div class="cover-container">
          <h1 class="logo">VistaKine</h1>
          <p class="tagline">${data.tagline || 'Interactive Kinematics Learning'}</p>
          <p class="description">${data.description || 'Explore physics concepts through interactive 3D visualizations.'}</p>
          <div class="cta-buttons">
            <a href="#vectors-and-cross-products" class="cta-button primary" data-content-id="vectors-and-cross-products">Explore 3D Vectors</a>
            <a href="#about" class="cta-button" data-content-id="about">About this Project</a>
          </div>
        </div>
        <div class="background-animation"></div>
      `;

      // Remove loading state
      contentContainer.classList.remove('loading');

      // Re-bind the navigation links inside the cover
      setupNavigationHandlers();
    })
    .catch(error => {
      console.error('Error loading cover page:', error);
      contentContainer.classList.remove('loading');
      contentContainer.innerHTML = '<div class="error-message"><h3>Error Loading Cover Page</h3></div>';
    });
}

/**
 * Display content in the container
 * @param {string} contentId - The ID of the content
 * @param {Object} data - The content data
 * @param {string} [sectionId=null] - Specific section to scroll to after loading
 */
function displayContent(contentId, data, sectionId = null) {
  const contentContainer = document.getElementById('interactive-content');
  const chapterNav = document.getElementById('chapter-nav');

  if (!contentContainer) return;

  // Show navigation for regular pages (not cover)
  if (chapterNav && contentId !== 'cover') {
    chapterNav.classList.remove('hidden');
    document.body.classList.remove('cover-page-body');
  }

  // Remove loading state
  contentContainer.classList.remove('loading');

  // Store reference to current content
  userProgress.currentSectionId = contentId;

  // Clear previous content
  contentContainer.innerHTML = '';

  // Generate HTML for the content
  let htmlContent = '';

  // Handle different content formats
  if (data && data.content) {
    // New format with content array
    data.content.forEach(section => {
      htmlContent += createSectionHTML(section);
    });
  } else if (data && data.sections) {
    // Older format with sections array (for about.json, etc.)

    // Generate title if available
    if (data.title) {
      htmlContent += `<h1 class="content-title">${data.title}</h1>`;
    }

    // Generate description if available
    if (data.description) {
      htmlContent += `<p class="content-description">${data.description}</p>`;
    }

    // Convert sections to HTML
    data.sections.forEach(section => {
      htmlContent += `<section class="content-section" id="${section.id || ''}">`;
      if (section.title) {
        htmlContent += `<h2 class="section-title">${section.title}</h2>`;
      }
      htmlContent += section.content || '';
      htmlContent += `</section>`;
    });
  } else {
    // Display error if data is invalid
    htmlContent = `
      <div class="error-message">
        <h2>Error Loading Content</h2>
        <p>The requested content "${contentId}" could not be loaded or has an invalid format.</p>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </div>
    `;
  }

  // Set the content
  contentContainer.innerHTML = htmlContent;

  // Initialize interactive elements
  initializeInteractiveElements();

  // Initialize visualizations
  initializeVisualizations();

  // Set up progress navigation
  setupProgressNavigation();

  // Update document title if available
  if (data.title) {
    document.title = `${data.title} - VistaKine`;
  }

  // Scroll to specific section if requested
  if (sectionId) {
    scrollToSection(sectionId);
  } else {
    // Smooth scroll to the top
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

/**
 * Scroll to a specific section by ID
 */
function scrollToSection(sectionId) {
  setTimeout(() => {
    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, 100); // Small delay to ensure DOM is ready
}

/**
 * Create HTML for a specific content section based on its type
 * @param {Object} section - The section data
 * @returns {string} HTML for the section
 */
function createSectionHTML(section) {
  if (!section || !section.type) return '';

  switch (section.type) {
    case 'header':
      const idAttr = section.id ? ` id="${section.id}"` : '';
      return `<h${section.level || 1}${idAttr}>${section.content || ''}</h${section.level || 1}>`;

    case 'paragraph':
      return `<p>${section.content || ''}</p>`;

    case 'list':
      if (!section.items || !section.items.length) return '';

      const listType = section.style === 'ordered' ? 'ol' : 'ul';
      const listItems = section.items.map(item => `<li>${item}</li>`).join('');

      return `<${listType}>${listItems}</${listType}>`;

    case 'equation':
      return `<div class="equation">${section.content || ''}</div>`;

    case 'callout':
      const calloutClass = section.style ? ` callout-${section.style}` : '';
      return `
        <div class="callout${calloutClass}">
          ${section.title ? `<h3>${section.title}</h3>` : ''}
          <p>${section.content || ''}</p>
        </div>
      `;

    case 'visualization':
      return createVisualizationHTML(section);

    case 'container':
      // Handle container with nested content
      const containerClass = section.class ? ` class="${section.class}"` : '';
      const containerId = section.id ? ` id="${section.id}"` : '';

      // Process content items inside the container
      let containerContent = '';
      if (section.content && Array.isArray(section.content)) {
        section.content.forEach(item => {
          containerContent += createSectionHTML(item);
        });
      }

      return `<div${containerClass}${containerId}>${containerContent}</div>`;

    case 'button':
      const buttonClass = section.class ? ` class="${section.class}"` : ' class="content-button"';
      const buttonId = section.id ? ` id="${section.id}"` : '';
      const dataAction = section.action ? ` data-action="${section.action}"` : '';
      const dataTarget = section.target ? ` data-target="${section.target}"` : '';

      return `<button${buttonId}${buttonClass}${dataAction}${dataTarget}>${section.text || 'Button'}</button>`;

    case 'problem':
      return `
        <div class="problem" id="${section.id || ''}">
          <h3>Problem</h3>
          <p class="question">${section.question || ''}</p>
          <details>
            <summary>Show Answer</summary>
            <div class="answer">${section.answer || ''}</div>
          </details>
        </div>
      `;

    case 'summary':
      return `
        <div class="summary">
          <h2>Summary</h2>
          <p>${section.content || ''}</p>
        </div>
      `;

    default:
      return `<div>${section.content || ''}</div>`;
  }
}

/**
 * Create HTML for an example section
 * @param {Object} section - The section data
 * @returns {string} HTML for the example
 */
function createExampleHTML(section) {
  const template = document.getElementById('example-card-template');
  if (!template) return section.solution || '';

  const templateContent = template.content.cloneNode(true);
  const cardContent = templateContent.querySelector('.card-content');
  const cardNumber = templateContent.querySelector('.card-number');

  if (cardContent) {
    cardContent.innerHTML = section.solution || '';
  }

  if (cardNumber && section.number) {
    cardNumber.textContent = section.number;
  }

  return templateContent.firstElementChild.outerHTML;
}

/**
 * Create HTML for a problem section
 * @param {Object} section - The section data
 * @returns {string} HTML for the problem
 */
function createProblemHTML(section) {
  if (!section.solution) return '';

  const template = document.getElementById('problem-card-template');
  if (!template) {
    return `
      <div class="solution" hidden>
        <h4>Solution</h4>
        ${section.solution}
      </div>
      <button class="show-solution-btn">Show Solution</button>
    `;
  }

  const templateContent = template.content.cloneNode(true);
  const cardContent = templateContent.querySelector('.card-content');
  const cardNumber = templateContent.querySelector('.card-number');

  if (cardContent) {
    cardContent.innerHTML = `
      <div class="solution" hidden>
        <h4>Solution</h4>
        ${section.solution}
      </div>
      <button class="show-solution-btn">Show Solution</button>
    `;
  }

  if (cardNumber && section.number) {
    cardNumber.textContent = section.number;
  }

  return templateContent.firstElementChild.outerHTML;
}

/**
 * Create HTML for a visualization section
 * @param {Object} section - The visualization section data
 * @returns {string} HTML for the visualization
 */
function createVisualizationHTML(section) {
  if (!section || !section.id) return '';

  const height = section.height || 400;
  const caption = section.caption || '';

  return `
    <div class="visualization-container"
         data-viz-id="${section.id}"
         data-viz-script="${section.script || ''}"
         style="height: ${height}px;">
      <div class="viz-placeholder">
        <p><i class="ph ph-spinner-gap ph-spin"></i></p>
        <p>Loading visualization...</p>
      </div>
    </div>
    ${caption ? `<figcaption class="visualization-caption">${caption}</figcaption>` : ''}
    <div class="visualization-controls" data-for-viz="${section.id}"></div>
  `;
}

/**
 * Create HTML for a visualization control
 * @param {Object} control - The control data
 * @returns {string} HTML for the control
 */
function createControlHTML(control) {
  if (!control || !control.type) return '';

  switch (control.type) {
    case 'slider':
      return `
        <div class="control-group">
          <label for="${control.id}">${control.label}</label>
          <input type="range"
            id="${control.id}"
            class="control-slider"
            min="${control.min || 0}"
            max="${control.max || 100}"
            step="${control.step || 1}"
            value="${control.default || 50}">
          <span class="control-value">${control.default || 50}</span>
        </div>
      `;
    case 'checkbox':
      return `
        <div class="control-group">
          <label class="control-checkbox-label">
            <input type="checkbox"
              id="${control.id}"
              class="control-checkbox"
              ${control.default ? 'checked' : ''}>
            ${control.label}
          </label>
        </div>
      `;
    case 'button':
      return `
        <div class="control-group">
          <button id="${control.id}" class="control-button">${control.label}</button>
        </div>
      `;
    default:
      return '';
  }
}

/**
 * Initialize interactive elements in the content
 */
function initializeInteractiveElements() {
  // Set up buttons with actions
  setupContentButtons();

  // Set up solution buttons
  const solutionBtns = document.querySelectorAll('.show-solution-btn');
  solutionBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const solution = this.previousElementSibling;
      if (solution && solution.classList.contains('solution')) {
        solution.hidden = !solution.hidden;
        this.textContent = solution.hidden ? 'Show Solution' : 'Hide Solution';
      }
    });
  });

  // Set up visualization controls
  const controlSliders = document.querySelectorAll('.control-slider');
  controlSliders.forEach(slider => {
    const valueDisplay = slider.nextElementSibling;
    if (valueDisplay) {
      valueDisplay.textContent = slider.value;

      slider.addEventListener('input', function() {
        valueDisplay.textContent = this.value;
        updateVisualization(this);
      });
    }
  });

  const controlCheckboxes = document.querySelectorAll('.control-checkbox');
  controlCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      updateVisualization(this);
    });
  });

  const controlButtons = document.querySelectorAll('.control-button');
  controlButtons.forEach(button => {
    button.addEventListener('click', function() {
      updateVisualization(this);
    });
  });

  // Initialize visualization containers
  initializeVisualizations();
}

/**
 * Set up event handlers for content buttons
 */
function setupContentButtons() {
  // Find all buttons with data-action attributes
  const actionButtons = document.querySelectorAll('button[data-action]');

  actionButtons.forEach(button => {
    const action = button.getAttribute('data-action');
    const target = button.getAttribute('data-target');

    button.addEventListener('click', function() {
      switch (action) {
        case 'scrollToElement':
          if (target) {
            scrollToElement(target);
          }
          break;

        // Add more action types as needed
        default:
          console.warn(`Unknown button action: ${action}`);
          break;
      }
    });
  });
}

/**
 * Scroll smoothly to an element by ID
 * @param {string} elementId - The ID of the element to scroll to
 */
function scrollToElement(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  } else {
    console.warn(`Element with ID '${elementId}' not found`);
  }
}

/**
 * Initialize visualizations on the page
 */
function initializeVisualizations() {
  const visualizationContainers = document.querySelectorAll('.visualization-container[data-viz-id]');

  visualizationContainers.forEach(container => {
    const vizId = container.getAttribute('data-viz-id');
    const vizScript = container.getAttribute('data-viz-script');

    if (!vizScript) {
      // Fallback for visualizations without a specific script
      container.innerHTML = `
        <div class="viz-placeholder">
          <p><i class="ph ph-warning"></i></p>
          <p>Visualization script not specified</p>
          <p>ID: ${vizId}</p>
        </div>
      `;
      return;
    }

    // Create a unique ID for this visualization instance
    const vizInstanceId = `viz-${vizId}-${Date.now()}`;
    container.id = vizInstanceId;

    // Handle module scripts differently - use dynamic imports
    loadVisualizationScript(container, vizId, vizScript, vizInstanceId);
  });
}

/**
 * Load a visualization script properly handling ES modules
 */
function loadVisualizationScript(container, vizId, vizScript, vizInstanceId) {
  // First try to load as a module (preferred approach for new visualizations)
  try {
    // Create a module script dynamically
    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';

    // The module loader code - imports the module and initializes it
    moduleScript.textContent = `
      import * as ${vizScript}Module from '../js/visualizations/${vizScript}.js';

      // Store module in global context for reference
      window.vizModules = window.vizModules || {};
      window.vizModules['${vizInstanceId}'] = ${vizScript}Module;

      // Call initialization function if it exists
      if (${vizScript}Module.initialize) {
        ${vizScript}Module.initialize('${vizInstanceId}', ${JSON.stringify({vizId})});
      }
    `;

    // Add error handling
    moduleScript.onerror = () => {
      // If module loading fails, try as a regular script
      console.warn(`Failed to load ${vizScript} as module, trying as regular script`);
      loadLegacyVisualizationScript(container, vizId, vizScript);
    };

    // Append to document
    document.head.appendChild(moduleScript);
  } catch (error) {
    console.warn(`Error loading ${vizScript} as module: ${error}`);
    // Fallback to legacy script approach
    loadLegacyVisualizationScript(container, vizId, vizScript);
  }
}

/**
 * Load a visualization script using the legacy approach (for backward compatibility)
 */
function loadLegacyVisualizationScript(container, vizId, vizScript) {
  // Check if the script is already loaded
  if (!document.querySelector(`script[data-viz-script="${vizScript}"]`)) {
    // Load the visualization script dynamically
    const script = document.createElement('script');
    script.src = `../js/visualizations/${vizScript}.js`;
    script.setAttribute('data-viz-script', vizScript);
    script.onload = () => initializeVisualizationByType(container, vizId, vizScript);
    script.onerror = () => {
      container.innerHTML = `
        <div class="viz-placeholder error">
          <p><i class="ph ph-warning-circle"></i></p>
          <p>Failed to load visualization script:</p>
          <p>${vizScript}.js</p>
        </div>
      `;
    };
    document.head.appendChild(script);
  } else {
    // If already loaded, just initialize
    initializeVisualizationByType(container, vizId, vizScript);
  }
}

/**
 * Initialize a specific visualization based on its type
 * @param {HTMLElement} container - The container element
 * @param {string} vizId - The visualization ID
 * @param {string} vizScript - The visualization script name
 */
function initializeVisualizationByType(container, vizId, vizScript) {
  // Clear loading indicator
  container.innerHTML = '';

  switch (vizScript) {
    case 'cross-product':
      // Initialize the cross product visualization
      if (typeof initializeCrossProductVisualization === 'function') {
        const viz = initializeCrossProductVisualization(container.id || `viz-${vizId}`);

        // Make sure container has an ID for the visualization to target
        if (!container.id) {
          container.id = `viz-${vizId}`;
        }

        // Add controls if needed
        const controlsContainer = document.querySelector(`.visualization-controls[data-for-viz="${vizId}"]`);
        if (controlsContainer) {
          // Add reset button
          const resetBtn = document.createElement('button');
          resetBtn.textContent = 'Reset Vectors';
          resetBtn.classList.add('viz-control-btn');
          resetBtn.addEventListener('click', () => viz.reset());

          // Add right-hand rule demonstration button
          const rhrBtn = document.createElement('button');
          rhrBtn.textContent = 'Demonstrate Right-Hand Rule';
          rhrBtn.classList.add('viz-control-btn');
          rhrBtn.addEventListener('click', () => viz.demonstrateRightHandRule());

          // Add buttons to controls
          controlsContainer.appendChild(resetBtn);
          controlsContainer.appendChild(rhrBtn);
        }
      } else {
        console.error(`Cross product visualization script loaded but function not found`);
      }
      break;

    // Add cases for other visualization types here
    default:
      container.innerHTML = `
        <div class="viz-placeholder">
          <p><i class="ph ph-question"></i></p>
          <p>Unknown visualization type</p>
          <p>Script: ${vizScript}</p>
        </div>
      `;
      break;
  }
}

/**
 * Update a visualization based on control changes
 * This function is a placeholder for updating visualizations
 * @param {HTMLElement} control - The control that triggered the update
 */
function updateVisualization(control) {
  if (!control) return;

  // Find the parent visualization container
  const visualizationCard = control.closest('.visualization-card');
  if (!visualizationCard) return;

  const container = visualizationCard.querySelector('.visualization-container');
  if (!container) return;

  const vizId = container.getAttribute('data-viz-id');

  // This is where you would update your visualization
  // For example: updateVizParams(vizId, control.id, control.value);

  // For now, just log the change
  console.log(`Visualization ${vizId} control updated: ${control.id} = ${control.value || control.checked}`);
}

/**
 * Set up event listeners for progress navigation
 */
function setupProgressNavigation() {
  const prevBtn = document.querySelector('.progress-prev:not([disabled])');
  const nextBtn = document.querySelector('.progress-next:not([disabled])');

  if (prevBtn) {
    prevBtn.addEventListener('click', function() {
      const contentId = this.getAttribute('data-content-id');
      if (contentId) {
        window.history.pushState({contentId}, '', `#${contentId}`);
        loadContent(contentId);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function() {
      const contentId = this.getAttribute('data-content-id');
      if (contentId) {
        window.history.pushState({contentId}, '', `#${contentId}`);
        loadContent(contentId);
      }
    });
  }
}

/**
 * Update active navigation state
 * @param {string} contentId - The ID of the current content
 */
function updateActiveNavigation(contentId) {
  // Remove active class from all links
  const allLinks = document.querySelectorAll('.nav-link, .section-link');
  allLinks.forEach(link => {
    link.classList.remove('active');
  });

  // Add active class to the current content link
  const activeLink = document.querySelector(`[data-content-id="${contentId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');

    // If it's a section link, also activate its parent chapter
    if (activeLink.classList.contains('section-link')) {
      const parentLi = activeLink.closest('li');
      if (parentLi) {
        const parentUl = parentLi.closest('ul');
        if (parentUl && parentUl.previousElementSibling) {
          const chapterLink = parentUl.previousElementSibling;
          chapterLink.classList.add('active');
        }
      }
    }

    // Expand section list if needed
    if (activeLink.classList.contains('nav-link')) {
      const sectionList = activeLink.nextElementSibling;
      if (sectionList && sectionList.classList.contains('section-list')) {
        // This assumes you have a function to expand sections
        // expandSection(activeLink);
      }
    }
  }
}

/**
 * Set up scroll tracking for progress indication
 */
function setupScrollTracking() {
  let progressFill = document.querySelector('.progress-fill');
  if (!progressFill) return;

  window.addEventListener('scroll', function() {
    // Calculate scroll progress
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrollPercent = scrollTop / (docHeight - winHeight);
    const progressPercent = Math.min(Math.max(scrollPercent * 100, 0), 100);

    // Update progress bar
    progressFill.style.width = `${progressPercent}%`;

    // Track section progress
    trackSectionProgress();
  });
}

/**
 * Track which sections have been read
 */
function trackSectionProgress() {
  const sections = document.querySelectorAll('.content-section');
  const scrollPosition = window.scrollY + window.innerHeight * 0.7;

  sections.forEach(section => {
    const sectionId = section.id;
    if (!sectionId) return;

    const rect = section.getBoundingClientRect();
    const sectionTop = rect.top + window.scrollY;
    const sectionBottom = sectionTop + rect.height;

    // Check if the section is in view
    if (scrollPosition >= sectionTop && scrollPosition <= sectionBottom) {
      // Mark this section as viewed
      userProgress.completedSections.add(sectionId);

      // Update section links in navigation
      const sectionLink = document.querySelector(`.section-link[href="#${sectionId}"]`);
      if (sectionLink) {
        sectionLink.classList.add('completed');
      }
    }
  });
}

/**
 * Update the browser history with the current content ID
 *
 * @param {string} contentId - The content ID to add to history
 * @param {string} [sectionId=null] - Optional section ID
 */
function updateBrowserHistory(contentId, sectionId = null) {
  if (window.location.hash !== `#${contentId}`) {
    if (DEV_MODE) console.log(`Updating browser history: #${contentId}`);
    window.history.pushState({contentId, sectionId}, '', `#${contentId}`);
  }
}

// Initialize the content loader when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeContentLoader);

// Add a debug panel when in DEV_MODE
if (DEV_MODE) {
  document.addEventListener('DOMContentLoaded', function() {
    // Create debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'vk-debug-panel';
    debugPanel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      padding: 10px;
      border-radius: 5px;
      max-width: 400px;
      max-height: 300px;
      overflow: auto;
      z-index: 10000;
      font-size: 12px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    `;

    debugPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
        <strong>VistaKine Debug</strong>
        <button id="vk-debug-toggle" style="background: none; border: none; color: white; cursor: pointer;">_</button>
      </div>
      <div id="vk-debug-content">
        <div><strong>Environment:</strong> ${ENV.isLiveServer ? 'Live Server' : ENV.isLocalFileAccess ? 'Local File' : 'Web Server'}</div>
        <div><strong>Protocol:</strong> ${window.location.protocol}</div>
        <div><strong>Host:</strong> ${window.location.host}</div>
        <div><strong>Path:</strong> ${window.location.pathname}</div>
        <div><strong>Base URL:</strong> ${getBaseUrl()}</div>
        <hr>
        <div><strong>Test Content Loading:</strong></div>
        <div style="display: flex; gap: 5px; margin-top: 5px;">
          <select id="vk-debug-content-id" style="flex-grow: 1; background: #333; color: white; border: 1px solid #555;">
            <option value="cover">cover</option>
            <option value="about">about</option>
            <option value="vectors-and-cross-products">vectors-and-cross-products</option>
            <option value="basic-concepts">basic-concepts</option>
            <option value="position-displacement">position-displacement</option>
            <option value="kinematics-intro">kinematics-intro</option>
            <option value="chapters">chapters</option>
          </select>
          <button id="vk-debug-load-btn" style="background: #444; color: white; border: 1px solid #555; cursor: pointer;">Load</button>
        </div>
      </div>
    `;

    document.body.appendChild(debugPanel);

    // Toggle debug panel visibility
    const toggleBtn = document.getElementById('vk-debug-toggle');
    const debugContent = document.getElementById('vk-debug-content');
    let isCollapsed = false;

    toggleBtn.addEventListener('click', function() {
      isCollapsed = !isCollapsed;
      debugContent.style.display = isCollapsed ? 'none' : 'block';
      toggleBtn.textContent = isCollapsed ? '+' : '_';
    });

    // Setup content loading test
    const loadBtn = document.getElementById('vk-debug-load-btn');
    loadBtn.addEventListener('click', function() {
      const contentId = document.getElementById('vk-debug-content-id').value;
      console.log(`Debug panel: Loading content "${contentId}"`);
      loadContent(contentId);
    });
  });
}

/**
 * Append content to the main container for seamless scrolling
 */
function appendContent(contentId, content, sectionId) {
  const contentContainer = document.getElementById('interactive-content');

  // Create a content section with appropriate ID and metadata
  const contentSection = document.createElement('div');
  contentSection.classList.add('content-section');
  contentSection.setAttribute('data-content-id', contentId);
  contentSection.innerHTML = content;

  // Add a visual separator between sections
  const separator = document.createElement('div');
  separator.classList.add('content-separator');
  separator.innerHTML = `<div class="separator-content">
    <span class="separator-icon">◆</span>
  </div>`;

  // Append to the container
  contentContainer.appendChild(separator);
  contentContainer.appendChild(contentSection);

  // Initialize interactive elements
  initializeInteractiveElements();

  // Smooth scroll to the section if specified
  if (sectionId) {
    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    // Default to scrolling to the top of the new content
    contentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Remove loading state
  contentContainer.classList.remove('loading');
}

/**
 * Add Reset View button to navigation
 */
function addResetViewButton() {
  const nav = document.querySelector('.sidebar-content');
  if (!nav) return;

  // Only add if it doesn't already exist
  if (document.getElementById('reset-view-button')) return;

  const resetButton = document.createElement('div');
  resetButton.id = 'reset-view-button';
  resetButton.className = 'reset-view-control';
  resetButton.innerHTML = `
    <button class="btn reset-btn">
      <span class="icon">↻</span> Reset View
    </button>
  `;

  // Add click event to clear content and load cover
  resetButton.querySelector('button').addEventListener('click', function() {
    const contentContainer = document.getElementById('interactive-content');
    contentContainer.innerHTML = '';
    loadContent('cover', true, null, false); // Load cover without appending
  });

  // Add to top of navigation
  nav.insertBefore(resetButton, nav.firstChild);
}

// Call this function after initializing the content loader
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the content loader
  initializeContentLoader();

  // Add reset view button
  addResetViewButton();
});
