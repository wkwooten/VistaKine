/**
 * VistaKine Content Loader
 *
 * This module provides dynamic content loading for the VistaKine platform
 * while preserving the existing sidebar navigation structure.
 */

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
  // Set up navigation handlers
  setupNavigationHandlers();

  // Check for deep linking via URL hash
  const contentId = window.location.hash.substring(1);
  if (contentId) {
    loadContent(contentId);
  }

  // Set up scroll tracking for progress indication
  setupScrollTracking();
}

/**
 * Attach event handlers to navigation links
 */
function setupNavigationHandlers() {
  // Get all navigation links with data-content-id attribute
  const navLinks = document.querySelectorAll('[data-content-id]');

  navLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      // If it's not an external link (with href to another page)
      if (!this.href || this.href.includes('#') || this.getAttribute('data-content-id')) {
        event.preventDefault();

        const contentId = this.getAttribute('data-content-id');
        if (contentId) {
          // Update URL without page reload
          window.history.pushState({contentId}, '', `#${contentId}`);

          // Load the content
          loadContent(contentId);
        }
      }
    });
  });

  // Handle browser back/forward navigation
  window.addEventListener('popstate', function(event) {
    if (event.state && event.state.contentId) {
      loadContent(event.state.contentId);
    }
  });
}

/**
 * Load content by ID
 * @param {string} contentId - The ID of the content to load
 */
function loadContent(contentId) {
  const contentContainer = document.getElementById('interactive-content');
  if (!contentContainer) return;

  // Show loading state
  contentContainer.classList.add('loading');

  // Check cache first
  if (contentCache[contentId]) {
    displayContent(contentId, contentCache[contentId]);
    return;
  }

  // Fetch the content from the server
  fetch(`../content/${contentId}.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Content not found: ${contentId}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache the content for future use
      contentCache[contentId] = data;

      // Display the content
      displayContent(contentId, data);
    })
    .catch(error => {
      console.error(`Error loading content: ${error.message}`);
      contentContainer.innerHTML = `
        <div class="error-message">
          <h3>Content Not Available</h3>
          <p>Sorry, the requested content could not be loaded. Please try again later.</p>
          <p>Error: ${error.message}</p>
        </div>
      `;
      contentContainer.classList.remove('loading');
    });
}

/**
 * Display loaded content in the content area
 * @param {string} contentId - The ID of the content
 * @param {Object} data - The content data object
 */
function displayContent(contentId, data) {
  const contentContainer = document.getElementById('interactive-content');
  if (!contentContainer) return;

  // Set the current section ID in user progress
  userProgress.currentSectionId = contentId;

  // Update page title
  document.title = `${data.title} - VistaKine`;

  // Create the content HTML
  let contentHTML = `
    <div class="content-header">
      <h2>${data.title}</h2>
      <div class="content-meta">
        <span class="estimated-time"><i class="ph ph-clock"></i> ${data.estimated_time_minutes} min read</span>
      </div>
    </div>
  `;

  // Add progress navigation
  contentHTML += `
    <div class="progress-nav">
      ${data.prev_content_id ?
        `<button class="progress-prev" data-content-id="${data.prev_content_id}">
          <i class="ph ph-caret-left"></i>
        </button>` :
        `<button class="progress-prev" disabled>
          <i class="ph ph-caret-left"></i>
        </button>`
      }
      <div class="progress-indicator">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      ${data.next_content_id ?
        `<button class="progress-next" data-content-id="${data.next_content_id}">
          <i class="ph ph-caret-right"></i>
        </button>` :
        `<button class="progress-next" disabled>
          <i class="ph ph-caret-right"></i>
        </button>`
      }
    </div>
  `;

  // Add content sections
  contentHTML += `<div class="content-sections">`;

  data.sections.forEach(section => {
    contentHTML += createSectionHTML(section);
  });

  contentHTML += `</div>`;

  // Add the content to the page
  contentContainer.innerHTML = contentHTML;
  contentContainer.classList.remove('loading');

  // Initialize interactive elements
  initializeInteractiveElements();

  // Update active navigation state
  updateActiveNavigation(contentId);

  // Set up event listeners for progress navigation
  setupProgressNavigation();

  // Scroll to top
  window.scrollTo(0, 0);
}

/**
 * Create HTML for a content section based on its type
 * @param {Object} section - The section data object
 * @returns {string} HTML for the section
 */
function createSectionHTML(section) {
  let sectionHTML = `<div id="${section.id}" class="content-section section-${section.type}">`;

  // Add the section title if it's not an introduction
  if (section.type !== 'introduction') {
    sectionHTML += `<h3>${section.title}</h3>`;
  }

  // Add the content
  sectionHTML += section.content;

  // Add special sections based on type
  switch (section.type) {
    case 'example':
      sectionHTML += createExampleHTML(section);
      break;
    case 'problem':
      sectionHTML += createProblemHTML(section);
      break;
    case 'visualization':
      sectionHTML += createVisualizationHTML(section);
      break;
  }

  sectionHTML += `</div>`;
  return sectionHTML;
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
 * @param {Object} section - The section data
 * @returns {string} HTML for the visualization
 */
function createVisualizationHTML(section) {
  if (!section.visualization_data) return '';

  const template = document.getElementById('visualization-card-template');
  if (!template) {
    return `
      <div class="visualization-container" data-viz-id="${section.visualization_data.id}"></div>
      <div class="visualization-controls"></div>
    `;
  }

  const templateContent = template.content.cloneNode(true);
  const container = templateContent.querySelector('.visualization-container');
  const controls = templateContent.querySelector('.visualization-controls');
  const cardNumber = templateContent.querySelector('.card-number');

  if (container) {
    container.setAttribute('data-viz-id', section.visualization_data.id);
    container.setAttribute('data-viz-type', section.visualization_data.type);
  }

  if (controls && section.visualization_data.controls) {
    section.visualization_data.controls.forEach(control => {
      const controlHTML = createControlHTML(control);
      if (controlHTML) {
        controls.innerHTML += controlHTML;
      }
    });
  }

  if (cardNumber && section.number) {
    cardNumber.textContent = section.number;
  }

  return templateContent.firstElementChild.outerHTML;
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
 * Initialize visualization containers
 * This function is a placeholder for integrating with a visualization library
 */
function initializeVisualizations() {
  const visualizationContainers = document.querySelectorAll('.visualization-container[data-viz-id]');

  visualizationContainers.forEach(container => {
    const vizId = container.getAttribute('data-viz-id');
    const vizType = container.getAttribute('data-viz-type');

    // This is where you would initialize your visualization library
    // For example: createVisualization(container, vizId, vizType);

    // For now, just add a placeholder message
    container.innerHTML = `
      <div class="viz-placeholder">
        <p><i class="ph ph-chart-line"></i></p>
        <p>Visualization: ${vizType}</p>
        <p>ID: ${vizId}</p>
        <p class="viz-note">Interactive visualization will be rendered here</p>
      </div>
    `;
  });
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

// Initialize the content loader when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeContentLoader);
