# VistaKine Style Guide

## CSS Architecture

VistaKine follows a component-based CSS architecture organized by functionality. This guide documents our approach to CSS organization, naming conventions, and best practices.

### Directory Structure

```
styles/
├── base/             # Foundational styles
│   ├── variables.css # Global variables
│   ├── typography.css # Typography styles
│   └── global.css    # Reset and global elements
├── components/       # Individual UI components
│   ├── sidebar.css
│   ├── visualization.css
│   ├── cover.css
│   └── [other components]
├── layout/           # Page structure & layouts
│   ├── grid.css
│   └── sections.css
├── utils/            # Helpers and utilities
│   └── breakpoints.css
└── main.css          # Import file and minimal global styles
```

### Naming Conventions

- Use kebab-case for class names (e.g., `.section-inner`, `.feature-item`)
- Prefix state classes with appropriate state (e.g., `.is-active`, `.has-error`)
- Use BEM-inspired naming for complex components:
  - Block: `.card`
  - Element: `.card__title`, `.card__image`
  - Modifier: `.card--featured`, `.card--compact`

### Media Query Standards

**Breakpoints:**
- Mobile: `max-width: 480px`
- Tablet: `max-width: 768px`
- Desktop: `min-width: 769px`

**Organization:**
- Group media queries by component at the end of each component section
- Keep the order consistent: desktop, tablet, mobile

**Example:**
```css
.component {
  /* Base styles */
}

@media (min-width: 769px) {
  .component {
    /* Desktop styles */
  }
}

@media (max-width: 768px) {
  .component {
    /* Tablet & mobile styles */
  }
}

@media (max-width: 480px) {
  .component {
    /* Mobile-only styles */
  }
}
```

### Variables

All global variables are defined in `base/variables.css` and should be referenced throughout the project. Never use hard-coded values for:

- Colors
- Spacing
- Font sizes
- Transitions
- Breakpoints
- Shadows

### Component Pattern

Each component file should follow this structure:

1. Component documentation comment
2. Base component styles
3. Component variations
4. Component states
5. Media queries

**Example:**
```css
/**
 * Component Name
 *
 * Description of the component and its usage
 */

/* Base component */
.component {
  /* Base styles */
}

/* Component elements */
.component__element {
  /* Element styles */
}

/* Component variations */
.component--variation {
  /* Variation styles */
}

/* Component states */
.component.is-active {
  /* Active state */
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .component {
    /* Tablet & mobile styles */
  }
}
```

## Core Components

### Sidebar

The sidebar is a critical navigation component with multiple states and responsive behaviors:

- **States:**
  - Normal/expanded: Default state showing full navigation
  - Mini-collapsed: Compact view showing only icons (desktop)
  - Collapsed: Completely hidden
  - Mobile: Slide-in overlay with different styling

- **Key Classes:**
  - `.sidebar`: Main container
  - `.sidebar-header`: Contains logo and actions
  - `.sidebar-nav`: Navigation container
  - `.nav-chapter`: Chapter navigation items
  - `.nav-subchapter`: Subchapter links
  - `.sidebar-resize-handle`: Interactive resize control
  - `.sidebar-close`: Mobile close button
  - `.show-nav-toggle`: Mobile navigation toggle

- **State Classes:**
  - `.sidebar.collapsed`: Hidden sidebar
  - `.sidebar.mini-collapsed`: Icon-only mode
  - `.sidebar.active`: Visible on mobile

The sidebar's JavaScript interactions rely on these specific class names, so they must be preserved exactly as defined.

### Interactive Elements

The application includes several interactive elements that enhance user experience:

- **Read More/Expand Buttons**:
  - Used to show/hide additional content, especially on mobile devices
  - Implementation requires the following elements:
    - `.expand-text-btn`: Button with "Read more" text
    - `.expand-arrow`: Icon/arrow indicating expandable content
    - A target element with `data-target` attribute matching the ID of content to expand

Example usage:
```html
<button class="expand-text-btn" aria-expanded="false" data-target="extra-content">
  Read more <i class="expand-arrow">→</i>
</button>
<div id="extra-content" class="hidden">
  Additional content here...
</div>
```

## For AI Assistants (Claude)

When adding new CSS to the project:

1. Determine if the style belongs to an existing component or requires a new one
2. Place the code in the appropriate file within the architecture
3. Follow the component pattern described above
4. Group media queries at the end of the component section
5. Use the standardized breakpoints
6. Refer to variables defined in variables.css