// Add styles for hover highlighting
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
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    pointer-events: none;
    max-width: 300px;
    word-wrap: break-word;
}`;
document.head.appendChild(style);

let currentTooltip = null;
let isRecording = false;

// Function to create and show tooltip
function showTooltip(element, event) {
    if (!isRecording) return;
    
    const xpath = getFullElementXPath(element);
    if (currentTooltip) {
        currentTooltip.remove();
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'xpath-tooltip';
    tooltip.textContent = `XPath: ${xpath}`;
    
    // Position tooltip near cursor
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
    
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
}

// Function to remove tooltip
function removeTooltip() {
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
    }
}

// Mouse move handler for highlighting
function handleMouseMove(event) {
    if (!isRecording) return;
    
    // Remove previous highlighting
    const previousHighlight = document.querySelector('.xpath-hover-highlight');
    if (previousHighlight) {
        previousHighlight.classList.remove('xpath-hover-highlight');
    }
    
    const element = getElementFromPoint(event.clientX, event.clientY);
    if (element) {
        element.classList.add('xpath-hover-highlight');
        showTooltip(element, event);
    }
}

// Add debounced mouse move listener
const debouncedMouseMove = debounce(handleMouseMove, 50);
document.addEventListener('mousemove', debouncedMouseMove, true);

// Listen for recording state changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'recordingStateChanged') {
        isRecording = request.isRecording;
        
        if (!isRecording) {
            // Clean up highlighting and tooltip when recording stops
            const highlightedElement = document.querySelector('.xpath-hover-highlight');
            if (highlightedElement) {
                highlightedElement.classList.remove('xpath-hover-highlight');
            }
            removeTooltip();
        }
    }
});

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

const debouncedInputHandler = debounce(processInputEvent, 1000);
document.addEventListener('click', logClickEvent, true);
document.addEventListener('submit', logSubmitEvent, true);
document.addEventListener('input', debouncedInputHandler, true);