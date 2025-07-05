/**
 * Utility functions for accessibility improvements
 */

/**
 * Generates a unique ID for accessibility attributes
 * 
 * @param {string} prefix - The prefix for the ID
 * @returns {string} A unique ID
 */
export function generateId(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates an announcement for screen readers
 * Uses our custom announce utility that leverages Tailwind
 * 
 * @param {string} message - The message to announce
 * @param {string} [ariaLive='polite'] - The aria-live attribute value ('polite' or 'assertive')
 * @param {number} [timeout=3000] - Time in milliseconds before removing the announcement
 */
export function announce(message, ariaLive = 'polite', timeout = 3000) {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', ariaLive);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.setAttribute('role', 'status');
    // Using our custom announce utility class
    announcer.className = 'announce';
    announcer.textContent = message;

    document.body.appendChild(announcer);

    // Remove after announcement is made
    setTimeout(() => {
        document.body.removeChild(announcer);
    }, timeout);
}

/**
 * Helper class for handling keyboard events
 */
export const Keys = {
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    TAB: 'Tab',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
};

/**
 * Creates a keyboard handler for interactive elements
 * 
 * @param {Object} options - Keyboard handler options
 * @param {Function} [options.onEnter] - Handler for Enter key
 * @param {Function} [options.onSpace] - Handler for Space key
 * @param {Function} [options.onEscape] - Handler for Escape key
 * @param {Function} [options.onArrowUp] - Handler for Arrow Up key
 * @param {Function} [options.onArrowDown] - Handler for Arrow Down key
 * @param {Function} [options.onArrowLeft] - Handler for Arrow Left key
 * @param {Function} [options.onArrowRight] - Handler for Arrow Right key
 * @param {Function} [options.onHome] - Handler for Home key
 * @param {Function} [options.onEnd] - Handler for End key
 * @returns {Function} A keyboard event handler function
 */
export function createKeyboardHandler({
    onEnter,
    onSpace,
    onEscape,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onHome,
    onEnd,
}) {
    return (event) => {
        switch (event.key) {
            case Keys.ENTER:
                if (onEnter) {
                    event.preventDefault();
                    onEnter(event);
                }
                break;
            case Keys.SPACE:
                if (onSpace) {
                    event.preventDefault();
                    onSpace(event);
                }
                break;
            case Keys.ESCAPE:
                if (onEscape) {
                    event.preventDefault();
                    onEscape(event);
                }
                break;
            case Keys.ARROW_UP:
                if (onArrowUp) {
                    event.preventDefault();
                    onArrowUp(event);
                }
                break;
            case Keys.ARROW_DOWN:
                if (onArrowDown) {
                    event.preventDefault();
                    onArrowDown(event);
                }
                break;
            case Keys.ARROW_LEFT:
                if (onArrowLeft) {
                    event.preventDefault();
                    onArrowLeft(event);
                }
                break;
            case Keys.ARROW_RIGHT:
                if (onArrowRight) {
                    event.preventDefault();
                    onArrowRight(event);
                }
                break;
            case Keys.HOME:
                if (onHome) {
                    event.preventDefault();
                    onHome(event);
                }
                break;
            case Keys.END:
                if (onEnd) {
                    event.preventDefault();
                    onEnd(event);
                }
                break;
            default:
                break;
        }
    };
}

/**
 * Manages focus for a given element
 * 
 * @param {string|HTMLElement} element - The element to focus (selector or DOM element)
 * @param {Object} options - Focus options
 * @param {boolean} [options.preventScroll=false] - Whether to prevent scrolling to the element
 * @param {boolean} [options.announce=false] - Whether to announce the focus change to screen readers
 * @param {string} [options.message=''] - Message to announce to screen readers
 */
export function focusElement(element, { preventScroll = false, announce = false, message = '' } = {}) {
    // Get the DOM element if a selector was provided
    const domElement = typeof element === 'string'
        ? document.querySelector(element)
        : element;

    // If the element exists, focus it
    if (domElement && typeof domElement.focus === 'function') {
        // Set up any attributes needed before focus
        if (!domElement.hasAttribute('tabindex')) {
            domElement.setAttribute('tabindex', '-1');
        }

        // Focus the element
        setTimeout(() => {
            domElement.focus({ preventScroll });

            // Announce the focus change if requested
            if (announce && message) {
                window.setTimeout(() => {
                    window.announce(message, 'polite');
                }, 100);
            }
        }, 50);
    }
}

/**
 * Creates a trap for keyboard focus within an element
 * 
 * @param {string|HTMLElement} container - The container to trap focus in
 * @returns {Object} Functions to activate and deactivate the focus trap
 */
export function createFocusTrap(container) {
    const domContainer = typeof container === 'string'
        ? document.querySelector(container)
        : container;

    if (!domContainer) {
        console.error('Container element not found for focus trap');
        return { activate: () => { }, deactivate: () => { } };
    }

    // Store the element that had focus before activating the trap
    let previouslyFocusedElement = null;

    // Get all focusable elements within the container
    const getFocusableElements = () => {
        return Array.from(domContainer.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"])'
        ));
    };

    // Handle keydown events within the container
    const handleKeyDown = (event) => {
        if (event.key === 'Tab') {
            const focusableElements = getFocusableElements();
            if (!focusableElements.length) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // If Shift+Tab on the first element, move to the last element
            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
            // If Tab on the last element, move to the first element
            else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    };

    return {
        /**
         * Activates the focus trap
         */
        activate: () => {
            previouslyFocusedElement = document.activeElement;

            domContainer.addEventListener('keydown', handleKeyDown);

            // Focus the first focusable element in the container
            const focusableElements = getFocusableElements();
            if (focusableElements.length) {
                focusableElements[0].focus();
            }
        },

        /**
         * Deactivates the focus trap
         */
        deactivate: () => {
            domContainer.removeEventListener('keydown', handleKeyDown);

            // Restore focus to the previously focused element
            if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
                previouslyFocusedElement.focus();
            }
        }
    };
}
