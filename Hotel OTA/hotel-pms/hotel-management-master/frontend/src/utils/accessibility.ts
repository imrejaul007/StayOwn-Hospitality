// ARIA helpers and accessibility utilities

export interface AriaProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean;
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-relevant'?: string;
  'aria-busy'?: boolean;
  role?: string;
  tabIndex?: number;
}

// Focus management utilities
export class FocusManager {
  private static focusableElements = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  static getFocusableElements(container: Element): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableElements));
  }

  static trapFocus(container: Element) {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleKeydown);

    // Focus first element
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeydown);
    };
  }

  static restoreFocus(previousActiveElement: Element | null) {
    if (previousActiveElement && 'focus' in previousActiveElement) {
      (previousActiveElement as HTMLElement).focus();
    }
  }

  static saveFocus(): Element | null {
    return document.activeElement;
  }
}

// Screen reader announcements
export class ScreenReaderAnnouncer {
  private static instance: ScreenReaderAnnouncer | null = null;
  private container: HTMLElement;

  private constructor() {
    this.container = document.createElement('div');
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-atomic', 'true');
    this.container.style.position = 'absolute';
    this.container.style.left = '-9999px';
    this.container.style.width = '1px';
    this.container.style.height = '1px';
    this.container.style.overflow = 'hidden';
    document.body.appendChild(this.container);
  }

  static getInstance(): ScreenReaderAnnouncer {
    if (!this.instance) {
      this.instance = new ScreenReaderAnnouncer();
    }
    return this.instance;
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    this.container.setAttribute('aria-live', priority);
    this.container.textContent = message;
  }

  clear() {
    this.container.textContent = '';
  }
}

// Keyboard navigation helpers
export const KeyboardCodes = {
  ENTER: 'Enter',
  SPACE: ' ',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

export function handleKeyboardNavigation(
  event: KeyboardEvent,
  handlers: Partial<Record<keyof typeof KeyboardCodes, () => void>>
) {
  const handler = handlers[event.key as keyof typeof KeyboardCodes];
  if (handler) {
    event.preventDefault();
    handler();
  }
}

// ARIA attributes builders
export function buildAriaProps(config: {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  expanded?: boolean;
  selected?: boolean;
  checked?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  live?: 'off' | 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: string;
  busy?: boolean;
  role?: string;
  tabIndex?: number;
}): AriaProps {
  const props: AriaProps = {};

  if (config.label) props['aria-label'] = config.label;
  if (config.labelledBy) props['aria-labelledby'] = config.labelledBy;
  if (config.describedBy) props['aria-describedby'] = config.describedBy;
  if (config.expanded !== undefined) props['aria-expanded'] = config.expanded;
  if (config.selected !== undefined) props['aria-selected'] = config.selected;
  if (config.checked !== undefined) props['aria-checked'] = config.checked;
  if (config.disabled !== undefined) props['aria-disabled'] = config.disabled;
  if (config.hidden !== undefined) props['aria-hidden'] = config.hidden;
  if (config.live) props['aria-live'] = config.live;
  if (config.atomic !== undefined) props['aria-atomic'] = config.atomic;
  if (config.relevant) props['aria-relevant'] = config.relevant;
  if (config.busy !== undefined) props['aria-busy'] = config.busy;
  if (config.role) props.role = config.role;
  if (config.tabIndex !== undefined) props.tabIndex = config.tabIndex;

  return props;
}

// Color contrast utilities
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const getRGB = (c: number) => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * getRGB(r) + 0.7152 * getRGB(g) + 0.0722 * getRGB(b);
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

export function isAccessibleContrast(foreground: string, background: string): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 4.5; // WCAG AA standard for normal text
}

// Reduced motion detection
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// High contrast detection
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

// Focus visible utilities
export function addFocusVisiblePolyfill() {
  let hadKeyboardEvent = true;
  let keyboardThrottleTimeout: number;

  const detectKeyboard = () => {
    hadKeyboardEvent = true;
  };

  const detectPointer = () => {
    hadKeyboardEvent = false;
    clearTimeout(keyboardThrottleTimeout);
    keyboardThrottleTimeout = window.setTimeout(() => {
      hadKeyboardEvent = true;
    }, 100);
  };

  document.addEventListener('keydown', detectKeyboard, true);
  document.addEventListener('mousedown', detectPointer, true);

  const addFocusVisible = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (hadKeyboardEvent || target.matches(':focus-visible')) {
      target.classList.add('focus-visible');
    }
  };

  const removeFocusVisible = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    target.classList.remove('focus-visible');
  };

  document.addEventListener('focus', addFocusVisible, true);
  document.addEventListener('blur', removeFocusVisible, true);

  return () => {
    document.removeEventListener('keydown', detectKeyboard, true);
    document.removeEventListener('mousedown', detectPointer, true);
    document.removeEventListener('focus', addFocusVisible, true);
    document.removeEventListener('blur', removeFocusVisible, true);
  };
}

// Live region manager for dynamic content updates
export class LiveRegionManager {
  private regions: Map<string, HTMLElement> = new Map();
  private clearTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  createRegion(
    id: string,
    level: 'polite' | 'assertive' = 'polite',
    atomic: boolean = true
  ): HTMLElement {
    if (this.regions.has(id)) {
      return this.regions.get(id)!;
    }

    const region = document.createElement('div');
    region.id = id;
    region.setAttribute('aria-live', level);
    region.setAttribute('aria-atomic', atomic.toString());
    region.setAttribute('aria-relevant', 'all');
    region.style.position = 'absolute';
    region.style.left = '-9999px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';

    document.body.appendChild(region);
    this.regions.set(id, region);

    return region;
  }

  announce(regionId: string, message: string, clearAfter: number = 1000) {
    const region = this.regions.get(regionId);
    if (!region) {
      return;
    }

    region.textContent = message;

    // Clear previous timer for this region if any
    const existingTimer = this.clearTimers.get(regionId);
    if (existingTimer) clearTimeout(existingTimer);

    if (clearAfter > 0) {
      const timer = setTimeout(() => {
        this.clearTimers.delete(regionId);
        region.textContent = '';
      }, clearAfter);
      this.clearTimers.set(regionId, timer);
    }
  }

  removeRegion(id: string) {
    const timer = this.clearTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.clearTimers.delete(id);
    }
    const region = this.regions.get(id);
    if (region) {
      document.body.removeChild(region);
      this.regions.delete(id);
    }
  }

  destroy() {
    this.clearTimers.forEach(timer => clearTimeout(timer));
    this.clearTimers.clear();
    this.regions.forEach(region => {
      if (region.parentNode) region.parentNode.removeChild(region);
    });
    this.regions.clear();
  }

  clear(id: string) {
    const region = this.regions.get(id);
    if (region) {
      region.textContent = '';
    }
  }
}

// Skip links utility
export function createSkipLink(
  text: string,
  targetId: string,
  className: string = 'skip-link'
): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = text;
  skipLink.className = className;
  skipLink.style.position = 'absolute';
  skipLink.style.left = '-9999px';
  skipLink.style.zIndex = '9999';
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.left = '6px';
    skipLink.style.top = '6px';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.left = '-9999px';
  });

  return skipLink;
}

// Landmark region helpers
export function createLandmark(
  tag: string,
  role?: string,
  label?: string,
  labelledBy?: string
): HTMLElement {
  const element = document.createElement(tag);
  if (role) element.setAttribute('role', role);
  if (label) element.setAttribute('aria-label', label);
  if (labelledBy) element.setAttribute('aria-labelledby', labelledBy);
  return element;
}

// Table accessibility helpers
export function enhanceTableAccessibility(table: HTMLTableElement) {
  // Add scope to header cells
  const headers = table.querySelectorAll('th');
  headers.forEach(header => {
    if (!header.hasAttribute('scope')) {
      const isRowHeader = header.parentElement?.tagName === 'TR' && 
                          Array.from(header.parentElement.children).indexOf(header) === 0;
      header.setAttribute('scope', isRowHeader ? 'row' : 'col');
    }
  });

  // Add caption if not present
  if (!table.querySelector('caption')) {
    const caption = document.createElement('caption');
    caption.textContent = 'Data table';
    caption.style.position = 'absolute';
    caption.style.left = '-9999px';
    table.insertBefore(caption, table.firstChild);
  }
}