// Utility Functions
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

// Element Detection and XPath Functions
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

// Global variable to store the current useId state
let useIdGlobal = false;

// Function to update the global useId state
function setUseId(value) {
    useIdGlobal = value;
}

function getFullElementXPath(element) {
    try {
        if (!element) return 'unknown';
        
        if (useIdGlobal && element.id) return `id("${element.id}")`;
        if (element.tagName.toLowerCase() === 'html') return '/html';

        let position = 1;
        let currentSibling = element;
        while ((currentSibling = currentSibling.previousElementSibling)) {
            if (currentSibling.tagName === element.tagName) {
                position++;
            }
        }

        let path = '';
        if (element.parentNode && element.parentNode.nodeType === 1) {
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

// Add message listener for useId updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setUseId') {
        setUseId(message.value);
    }
});

// Initialize useId state from storage
chrome.storage.local.get(['useId'], (result) => {
    setUseId(result.useId || false);
});
// Input Processing Functions
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

// Event Logging Functions
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

// Tooltip and Highlighting Functions
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

    if (left + tooltipRect.width > viewportWidth) {
        left = viewportWidth - tooltipRect.width - 10;
    }

    if (top + tooltipRect.height > viewportHeight) {
        top = viewportHeight - tooltipRect.height - 10;
    }

    left = Math.max(10, left);
    top = Math.max(10, top);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function createTooltip(element, event) {
    const tooltip = document.createElement('div');
    tooltip.className = 'xpath-tooltip';

    const xpath = getFullElementXPath(element);
    const elementType = getElementType(element);
    const attributes = getRelevantAttributes(element);

    const x = event.clientX;
    const y = event.clientY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    tooltip.innerHTML = `
        <div class="xpath-tooltip-content">
            <div>XPath: ${xpath}</div>
            <div class="xpath-tooltip-type">Type: ${elementType}</div>
            ${attributes.length ? `<div class="xpath-tooltip-attributes">${attributes.join('<br>')}</div>` : ''}
            <div class="xpath-tooltip-mouse">Mouse Position: (x: ${x}, y: ${y})</div>
            <div class="xpath-tooltip-viewport">Viewport: ${viewportWidth}x${viewportHeight}</div>
        </div>
    `;

    return tooltip;
}

// Event Handlers
function handleMouseEnter(event) {
    if (!isRecordingEnabled) return;
    
    const element = event.target;
    if (element === document.documentElement || element === document.body) return;

    if (highlightedElement) {
        highlightedElement.classList.remove('xpath-hover-highlight');
    }
    element.classList.add('xpath-hover-highlight');
    highlightedElement = element;

    if (currentTooltip) {
        currentTooltip.remove();
    }

    const tooltip = createTooltip(element, event);
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
    updateTooltipPosition(tooltip, event);
}


function handleMouseMove(event) {
    if (currentTooltip) {
        const x = event.clientX;
        const y = event.clientY;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Update tooltip content dynamically
        const mousePositionElement = currentTooltip.querySelector('.xpath-tooltip-mouse');
        const viewportElement = currentTooltip.querySelector('.xpath-tooltip-viewport');

        if (mousePositionElement) {
            mousePositionElement.textContent = `Mouse Position: (x: ${x}, y: ${y})`;
        }

        if (viewportElement) {
            viewportElement.textContent = `Viewport: ${viewportWidth}x${viewportHeight}`;
        }

        // Reposition tooltip
        updateTooltipPosition(currentTooltip, event);
    }
}


function handleMouseLeave(event) {
    const element = event.target;
    
    if (element === highlightedElement) {
        element.classList.remove('xpath-hover-highlight');
        highlightedElement = null;
        
        if (currentTooltip) {
            currentTooltip.remove();
            currentTooltip = null;
        }
    }
}

function handleScroll() {
    if (isScrolling) return;
    isScrolling = true;
    
    const currentScrollX = Math.round(window.scrollX);
    const currentScrollY = Math.round(window.scrollY);
    const scrollDeltaX = currentScrollX - lastScrollX;
    const scrollDeltaY = currentScrollY - lastScrollY;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (scrollDeltaX !== 0 || scrollDeltaY !== 0) {
        console.log(`Scroll by x: ${scrollDeltaX}, y: ${scrollDeltaY}`);
        chrome.runtime.sendMessage({
            action: 'recordAction',
            actionText: `scroll_by|${scrollDeltaX}|${scrollDeltaY}|${viewportWidth}x${viewportHeight}`,
        });
        
        lastScrollX = currentScrollX;
        lastScrollY = currentScrollY;
    }
    
    isScrolling = false;
}


// Tooltip Event Management
function addTooltipEventListeners() {
    if (!tooltipEventListenersActive) {
        document.addEventListener('mouseenter', handleMouseEnter, true);
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('mouseleave', handleMouseLeave, true);
        document.addEventListener('scroll', handleScrollForTooltip, { passive: true });
        tooltipEventListenersActive = true;
    }
}

function removeTooltipEventListeners() {
    if (tooltipEventListenersActive) {
        document.removeEventListener('mouseenter', handleMouseEnter, true);
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('mouseleave', handleMouseLeave, true);
        document.removeEventListener('scroll', handleScrollForTooltip, { passive: true });
        tooltipEventListenersActive = false;
        
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

// Styles
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

// Global Variables
let currentTooltip = null;
let highlightedElement = null;
let isRecordingEnabled = false;
let tooltipEventListenersActive = false;
let isScrolling = false;
let lastScrollX = 0;
let lastScrollY = 0;

// Event Listeners (continued)
const debouncedScrollHandler = debounce(handleScroll, 150);
const debouncedInputHandler = debounce(processInputEvent, 1000);

// Remove existing event listeners
document.removeEventListener('mousemove', handleMouseMove);
document.removeEventListener('mouseenter', handleMouseEnter, true);
document.removeEventListener('mouseleave', handleMouseLeave, true);

// Add core event listeners
document.addEventListener('mouseenter', handleMouseEnter, true);
document.addEventListener('mousemove', handleMouseMove, true);
document.addEventListener('mouseleave', handleMouseLeave, true);
document.addEventListener('scroll', debouncedScrollHandler, { passive: true });
document.addEventListener('click', logClickEvent, true);
document.addEventListener('input', debouncedInputHandler, true);

// Add an event listener for keydown to detect Ctrl+V
// document.addEventListener('keydown', function (event) {
//     if (event.ctrlKey && event.key === 'v') {
//         // Detect the element where the paste is happening
//         const activeElement = document.activeElement;
//         let xpath = 'unknown';
//         try {
//             xpath = getFullElementXPath(activeElement);
//         } catch (error) {
//             console.warn('Failed to get XPath for paste event:', error);
//         }

//         console.log(`Paste detected at ${xpath}`);

//         // Send the "paste" action to the background script
//         chrome.runtime.sendMessage({
//             action: 'recordAction',
//             actionText: `paste|${xpath}`
//         });
//     }
// });

// Add event listener for hover to show tooltip
document.addEventListener('mouseenter', function(event) {
    const targetElement = event.target;
    showTooltip(targetElement, event);
}, true);

// Add event listener to remove tooltip
document.addEventListener('mouseleave', function(event) {
    removeTooltip();
}, true);

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

// Chrome Runtime Message Listener
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