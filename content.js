function getElementFromPoint(x, y) {
    const elements = document.elementsFromPoint(x, y);
    
    for (const element of elements) {
        const tagName = element.tagName.toLowerCase();
        const computedStyle = getComputedStyle(element);
        
        if (
            tagName === 'ion-card' ||
            tagName === 'button' ||
            tagName === 'a' ||
            element.onclick ||
            element.getAttribute('role') === 'button' ||
            element.classList.contains('clickable') ||
            computedStyle.cursor === 'pointer' ||
            tagName === 'input' && ['button', 'submit', 'reset'].includes(element.type) ||
            element.getAttribute('tabindex') === '0'
        ) {
            return element;
        }
    }
    
    return elements[0];
}

function getMeaningfulInputElement(element) {
    const elements = [];
    let currentElement = element;
    
    while (currentElement) {
        elements.push(currentElement);
        currentElement = currentElement.parentElement;
    }
    
    for (const element of elements) {
        const tagName = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();
        const role = element.getAttribute('role')?.toLowerCase();
        
        if (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            tagName === 'ion-input' ||
            tagName === 'ion-textarea' ||
            tagName === 'quill-editor' ||
            tagName === 'monaco-editor' ||
            tagName === 'contenteditable' ||
            role === 'textbox' ||
            role === 'searchbox' ||
            role === 'combobox' ||
            element.classList.contains('input-container') ||
            element.classList.contains('form-control') ||
            element.getAttribute('contenteditable') === 'true' ||
            (tagName.includes('input') || tagName.includes('field'))
        ) {
            return element;
        }
    }
    
    return element;
}

function getFullElementXPath(element) {
    try {
        if (!element) {
            return 'unknown';
        }

        if (element.id) {
            return `id("${element.id}")`;
        }

        if (element.tagName.toLowerCase() === 'html') {
            return '/html';
        }

        let position = 1;
        let currentSibling = element;
        while ((currentSibling = currentSibling.previousElementSibling)) {
            if (currentSibling.tagName === element.tagName) {
                position++;
            }
        }

        let path = '';
        if (element.parentNode) {
            path = `${getFullElementXPath(element.parentNode)}/${element.tagName.toLowerCase()}`;
            const siblings = Array.from(element.parentNode.children).filter(
                (sibling) => sibling.tagName === element.tagName
            );
            if (siblings.length > 1) {
                path += `[${position}]`;
            }
        } else {
            path = `/${element.tagName.toLowerCase()}`;
        }

        return path;
    } catch (error) {
        console.warn('Failed to generate XPath:', error);
        return 'unknown';
    }
}

function encodeInputValue(value) {
    value = String(value);
    return btoa(decodeURIComponent(encodeURIComponent(value)));
}

function isMultiLineInput(element, value) {
    if (
        element.tagName.toLowerCase() === 'textarea' ||
        element.getAttribute('contenteditable') === 'true' ||
        element.tagName.toLowerCase().includes('editor') ||
        element.classList.contains('multi-line') ||
        element.getAttribute('role') === 'textbox' && element.getAttribute('multiline') === 'true'
    ) {
        return true;
    }
    
    return value.includes('\n');
}

function logClickEvent(event) {
    const x = event.clientX;
    const y = event.clientY;
    const resolutionWidth = window.innerWidth;
    const resolutionHeight = window.innerHeight;
    
    const targetElement = getElementFromPoint(x, y);
    let xpath = 'unknown';
    
    try {
        xpath = getFullElementXPath(targetElement);
    } catch (error) {
        console.warn('Failed to get XPath:', error);
    }
    
    console.log(`Click recorded at (${x}, ${y}) with resolution ${resolutionWidth}x${resolutionHeight}`);
    
    chrome.runtime.sendMessage({
        action: 'recordAction',
        actionText: `click|${xpath}|${x},${y}|${resolutionWidth}x${resolutionHeight}`,
    });
}

function logSubmitEvent(event) {
    let xpath = 'unknown';
    try {
        xpath = getFullElementXPath(event.target);
    } catch (error) {
        console.warn('Failed to get XPath for submit event:', error);
    }

    console.log(`Submit recorded: ${xpath}`);
    chrome.runtime.sendMessage({
        action: 'recordAction',
        actionText: `submit|${xpath}`,
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const inputTimeouts = new WeakMap();

function processInputEvent(event) {
    const inputElement = getMeaningfulInputElement(event.target);
    
    let xpath = 'unknown';
    try {
        xpath = getFullElementXPath(inputElement);
    } catch (error) {
        console.warn('Failed to get XPath for input event:', error);
        return;
    }

    let value = '';
    let type = '';
    
    try {
        if (inputElement.type) {
            type = inputElement.type.toLowerCase();
            value = inputElement.value;
        } else if (inputElement.getAttribute('contenteditable') === 'true') {
            type = 'contenteditable';
            value = inputElement.textContent;
        } else if (inputElement.tagName.toLowerCase().includes('editor')) {
            type = 'editor';
            value = inputElement.textContent || inputElement.value;
        } else {
            type = inputElement.tagName.toLowerCase();
            value = inputElement.value;
        }
        
        if ([
            'text', 'textarea', 'email', 'password', 'search', 'tel', 'url',
            'contenteditable', 'editor'
        ].includes(type)) {
            console.log(`Input recorded: ${xpath}`);
            
            const isMultiLine = isMultiLineInput(inputElement, value);
            
            if (isMultiLine) {
                const encodedValue = encodeInputValue(value);
                chrome.runtime.sendMessage({
                    action: 'recordAction',
                    actionText: `input|${xpath}|${encodedValue}|${type}|encoded`,
                });
            } else {
                chrome.runtime.sendMessage({
                    action: 'recordAction',
                    actionText: `input|${xpath}|${value}|${type}|None`,
                });
            }
        }
    } catch (error) {
        console.warn('Failed to process input event:', error);
    }
}


const style = document.createElement('style');
style.textContent = `
.xpath-hover-highlight {
    outline: 2px solid #4CAF50 !important;
    outline-offset: 1px !important;
    position: relative;
}

.xpath-tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    pointer-events: none;
    max-width: 400px;
    word-wrap: break-word;
    transition: all 0.1s ease-out;
}

.xpath-tooltip-content {
    margin-bottom: 4px;
}

.xpath-tooltip-type {
    color: #8BE9FD;
    font-style: italic;
}

.xpath-tooltip-attributes {
    color: #50FA7B;
    margin-top: 4px;
    font-size: 11px;
}`;
document.head.appendChild(style);

let currentTooltip = null;
let highlightedElement = null;

function getFullElementXPath(element) {
    if (!element) return 'unknown';
    if (element.id) return `id("${element.id}")`;
    if (element.tagName.toLowerCase() === 'html') return '/html';

    const siblings = Array.from(element.parentNode?.children || [])
        .filter(sibling => sibling.tagName === element.tagName);
    const position = siblings.indexOf(element) + 1;
    const parentPath = element.parentNode ? getFullElementXPath(element.parentNode) : '';

    return `${parentPath}/${element.tagName.toLowerCase()}${siblings.length > 1 ? `[${position}]` : ''}`;
}

function getElementType(element) {
    if (!element) return 'unknown';

    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const type = element.type?.toLowerCase();

    if (tagName.includes('-')) {
        const framework =
            tagName.startsWith('ion-') ? 'Ionic' :
            tagName.startsWith('mat-') ? 'Material' :
            tagName.startsWith('v-') ? 'Vue' :
            tagName.startsWith('react-') ? 'React' :
            'Custom';
        return `${framework} Component (${tagName})`;
    }

    if (['input', 'textarea', 'select'].includes(tagName)) {
        return `${tagName}${type ? ` (${type})` : ''}`;
    }

    if (['div', 'section', 'article', 'main', 'aside', 'nav'].includes(tagName) && element.children.length) {
        return `${tagName} (container)`;
    }

    return tagName;
}

function getRelevantAttributes(element) {
    const attributes = [];
    ['id', 'class', 'name', 'type', 'placeholder', 'value', 'data-testid', 'aria-label', 'role', 'tabindex']
        .forEach(attr => {
            const value = element.getAttribute(attr);
            if (value && (attr !== 'value' || element.type !== 'password')) {
                attributes.push(`${attr}="${value}"`);
            }
        });
    return attributes;
}

function updateTooltipPosition(tooltip, event) {
    if (!tooltip) return;
    
    let left = event.clientX + 10;
    let top = event.clientY + 10;

    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position if tooltip would go off screen
    if (left + tooltipRect.width > viewportWidth) {
        left = viewportWidth - tooltipRect.width - 10;
    }

    // Adjust vertical position if tooltip would go off screen
    if (top + tooltipRect.height > viewportHeight) {
        top = viewportHeight - tooltipRect.height - 10;
    }

    // Ensure tooltip doesn't go off the left or top of the screen
    left = Math.max(10, left);
    top = Math.max(10, top);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function createTooltip(element) {
    const tooltip = document.createElement('div');
    tooltip.className = 'xpath-tooltip';

    const xpath = getFullElementXPath(element);
    const elementType = getElementType(element);
    const attributes = getRelevantAttributes(element);

    tooltip.innerHTML = `
        <div class="xpath-tooltip-content">
            <div>XPath: ${xpath}</div>
            <div class="xpath-tooltip-type">Type: ${elementType}</div>
            ${attributes.length ? `<div class="xpath-tooltip-attributes">${attributes.join('<br>')}</div>` : ''}
        </div>
    `;

    return tooltip;
}

function handleMouseEnter(event) {
    if (!isRecordingEnabled) return;
    
    const element = event.target;
    if (element === document.documentElement || element === document.body) return;

    // Add highlight
    if (highlightedElement) {
        highlightedElement.classList.remove('xpath-hover-highlight');
    }
    element.classList.add('xpath-hover-highlight');
    highlightedElement = element;

    // Remove existing tooltip
    if (currentTooltip) {
        currentTooltip.remove();
    }

    // Create and position new tooltip
    const tooltip = createTooltip(element);
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
    updateTooltipPosition(tooltip, event);
}

function handleMouseMove(event) {
    if (currentTooltip) {
        updateTooltipPosition(currentTooltip, event);
    }
}

function handleMouseLeave(event) {
    const element = event.target;
    
    // Only remove highlight if we're leaving the highlighted element
    if (element === highlightedElement) {
        element.classList.remove('xpath-hover-highlight');
        highlightedElement = null;
        
        if (currentTooltip) {
            currentTooltip.remove();
            currentTooltip = null;
        }
    }
}

// Remove old event listeners if they exist
document.removeEventListener('mousemove', handleMouseMove);
document.removeEventListener('mouseenter', handleMouseEnter, true);
document.removeEventListener('mouseleave', handleMouseLeave, true);

// Add new event listeners
document.addEventListener('mouseenter', handleMouseEnter, true);
document.addEventListener('mousemove', handleMouseMove, true);
document.addEventListener('mouseleave', handleMouseLeave, true);

// Handle scroll events
document.addEventListener('scroll', () => {
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
    }
    if (highlightedElement) {
        highlightedElement.classList.remove('xpath-hover-highlight');
        highlightedElement = null;
    }
}, { passive: true });

// Flag to track if scrolling is happening
let isScrolling = false;

// Function to track scrolling action
let lastScrollX = 0;
let lastScrollY = 0;

function handleScroll() {
    if (isScrolling) return;
    isScrolling = true;
    
    // Calculate deltas relative to last position
    const currentScrollX = Math.round(window.scrollX);
    const currentScrollY = Math.round(window.scrollY);
    const scrollDeltaX = currentScrollX - lastScrollX;  // Can be negative
    const scrollDeltaY = currentScrollY - lastScrollY;  // Can be negative
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Only log if there was actual scrolling
    if (scrollDeltaX !== 0 || scrollDeltaY !== 0) {
        console.log(`Scroll by x: ${scrollDeltaX}, y: ${scrollDeltaY}`);
        chrome.runtime.sendMessage({
            action: 'recordAction',
            actionText: `scroll_by|${scrollDeltaX}|${scrollDeltaY}|${viewportWidth}x${viewportHeight}`,
        });
        
        // Update last positions
        lastScrollX = currentScrollX;
        lastScrollY = currentScrollY;
    }
    
    isScrolling = false;
}

// Debounce the scroll handler to avoid frequent updates
const debouncedScrollHandler = debounce(handleScroll, 150);
// Add the event listener for scroll
document.addEventListener('scroll', debouncedScrollHandler, { passive: true });
const debouncedInputHandler = debounce(processInputEvent, 1000);
document.addEventListener('click', logClickEvent, true);
// document.addEventListener('submit', logSubmitEvent, true);
document.addEventListener('input', debouncedInputHandler, true);

// Add event listener for hover to show tooltip and highlight element
document.addEventListener('mouseenter', function(event) {
    const targetElement = event.target;
    showTooltip(targetElement, event);
}, true);

document.addEventListener('mouseleave', function(event) {
    removeTooltip(); // Remove tooltip when mouse leaves the element
}, true);

// Add these variables at the top of content.js
let isRecordingEnabled = false;
let tooltipEventListenersActive = false;

// Function to add tooltip event listeners
function addTooltipEventListeners() {
    if (!tooltipEventListenersActive) {
        document.addEventListener('mouseenter', handleMouseEnter, true);
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('mouseleave', handleMouseLeave, true);
        document.addEventListener('scroll', handleScrollForTooltip, { passive: true });
        tooltipEventListenersActive = true;
    }
}

// Function to remove tooltip event listeners
function removeTooltipEventListeners() {
    if (tooltipEventListenersActive) {
        document.removeEventListener('mouseenter', handleMouseEnter, true);
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('mouseleave', handleMouseLeave, true);
        document.removeEventListener('scroll', handleScrollForTooltip, { passive: true });
        tooltipEventListenersActive = false;
        
        // Clean up any existing tooltips and highlights
        if (currentTooltip) {
            currentTooltip.remove();
            currentTooltip = null;
        }
        if (highlightedElement) {
            highlightedElement.classList.remove('xpath-hover-highlight');
            highlightedElement = null;
        }
    }
}

// Add message listener for recording state changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'recordingStateChanged') {
        isRecordingEnabled = request.isRecording;
        
        if (isRecordingEnabled) {
            addTooltipEventListeners();
        } else {
            removeTooltipEventListeners();
        }
    }
});

// Initialize recording state
chrome.runtime.sendMessage({ action: 'getActions' }, (response) => {
    if (response && response.isRecording !== undefined) {
        isRecordingEnabled = response.isRecording;
        if (isRecordingEnabled) {
            addTooltipEventListeners();
        }
    }
});