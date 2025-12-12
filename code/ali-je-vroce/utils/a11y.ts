/**
 * Utility functions for accessibility improvements
 */

/**
 * Generates a unique ID for accessibility attributes
 */
export function generateId(prefix: string = 'id'): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates an announcement for screen readers
 * Uses our custom announce utility that leverages Tailwind
 */
export function announce(
    message: string, 
    ariaLive: 'polite' | 'assertive' = 'polite', 
    timeout: number = 3000
): void {
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
        if (document.body.contains(announcer)) {
            document.body.removeChild(announcer);
        }
    }, timeout);
}

/**
 * Helper object for handling keyboard events
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
} as const;

/**
 * Type for keyboard handler function
 */
type KeyboardEventHandler = (event: KeyboardEvent) => void;

/**
 * Keyboard handler options interface
 */
export interface KeyboardHandlerOptions {
    onEnter?: KeyboardEventHandler;
    onSpace?: KeyboardEventHandler;
    onEscape?: KeyboardEventHandler;
    onArrowUp?: KeyboardEventHandler;
    onArrowDown?: KeyboardEventHandler;
    onArrowLeft?: KeyboardEventHandler;
    onArrowRight?: KeyboardEventHandler;
    onHome?: KeyboardEventHandler;
    onEnd?: KeyboardEventHandler;
}

/**
 * Creates a keyboard handler for interactive elements
 */
export function createKeyboardHandler(options: KeyboardHandlerOptions): KeyboardEventHandler {
    const {
        onEnter,
        onSpace,
        onEscape,
        onArrowUp,
        onArrowDown,
        onArrowLeft,
        onArrowRight,
        onHome,
        onEnd,
    } = options;

    return (event: KeyboardEvent): void => {
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
 * Focus element options interface
 */
export interface FocusElementOptions {
    preventScroll?: boolean;
    announce?: boolean;
    message?: string;
}

/**
 * Manages focus for a given element
 */
export function focusElement(
    element: string | HTMLElement, 
    options: FocusElementOptions = {}
): void {
    const { preventScroll = false, announce: shouldAnnounce = false, message = '' } = options;

    // Get the DOM element if a selector was provided
    const domElement = typeof element === 'string'
        ? document.querySelector(element) as HTMLElement | null
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
            if (shouldAnnounce && message) {
                setTimeout(() => {
                    announce(message, 'polite');
                }, 100);
            }
        }, 50);
    }
}

/**
 * Focus trap interface
 */
export interface FocusTrap {
    activate: () => void;
    deactivate: () => void;
}

/**
 * Creates a trap for keyboard focus within an element
 */
export function createFocusTrap(container: string | HTMLElement): FocusTrap {
    const domContainer = typeof container === 'string'
        ? document.querySelector(container) as HTMLElement | null
        : container;

    if (!domContainer) {
        console.error('Container element not found for focus trap');
        return { 
            activate: () => { }, 
            deactivate: () => { } 
        };
    }

    // Store the element that had focus before activating the trap
    let previouslyFocusedElement: HTMLElement | null = null;

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
        return Array.from(domContainer.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"])'
        )) as HTMLElement[];
    };

    // Handle keydown events within the container
    const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Tab') {
            const focusableElements = getFocusableElements();
            if (!focusableElements.length) return;

            const firstElement = focusableElements[0]!;
            const lastElement = focusableElements[focusableElements.length - 1]!;

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
        activate: (): void => {
            previouslyFocusedElement = document.activeElement as HTMLElement | null;

            domContainer.addEventListener('keydown', handleKeyDown);

            // Focus the first focusable element in the container
            const focusableElements = getFocusableElements();
            if (focusableElements.length) {
                focusableElements[0]!.focus();
            }
        },

        /**
         * Deactivates the focus trap
         */
        deactivate: (): void => {
            domContainer.removeEventListener('keydown', handleKeyDown);

            // Restore focus to the previously focused element
            if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
                previouslyFocusedElement.focus();
            }
        }
    };
}
