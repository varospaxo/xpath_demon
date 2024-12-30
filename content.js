// Helper function to get element at coordinates
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
    // Check if the element is inherently multi-line
    if (
        element.tagName.toLowerCase() === 'textarea' ||
        element.getAttribute('contenteditable') === 'true' ||
        element.tagName.toLowerCase().includes('editor') ||
        element.classList.contains('multi-line') ||
        element.getAttribute('role') === 'textbox' && element.getAttribute('multiline') === 'true'
    ) {
        return true;
    }
    
    // Check if the value contains line breaks
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

function logInputEvent(event) {
    const inputElement = getMeaningfulInputElement(event.target);
    
    let xpath = 'unknown';
    try {
        xpath = getFullElementXPath(inputElement);
    } catch (error) {
        console.warn('Failed to get XPath for input event:', error);
    }

    let value = '';
    let type = '';
    
    try {
        // Handle different types of input elements
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
        
        // Only log specific input types
        if ([
            'text', 'textarea', 'email', 'password', 'search', 'tel', 'url',
            'contenteditable', 'editor'
        ].includes(type)) {
            console.log(`Input recorded: ${xpath}`);
            
            // Determine if this is a multi-line input
            const isMultiLine = isMultiLineInput(inputElement, value);
            
            if (isMultiLine) {
                // Multi-line input - encode the value and use input_ml action
                const encodedValue = encodeInputValue(value);
                chrome.runtime.sendMessage({
                    action: 'recordAction',
                    actionText: `input|${xpath}|${encodedValue}|${type}|encoded`,
                });
            } else {
                // Single-line input - use regular input action with raw value
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

document.addEventListener('click', logClickEvent, true);
document.addEventListener('submit', logSubmitEvent, true);
document.addEventListener('input', logInputEvent, true);