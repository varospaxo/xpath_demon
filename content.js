// Helper function to get element at coordinates
function getElementFromPoint(x, y) {
    // Get all elements at point, in case of overlapping elements
    const elements = document.elementsFromPoint(x, y);
    
    // Find the first meaningful container (card, button, or clickable element)
    for (const element of elements) {
        const tagName = element.tagName.toLowerCase();
        // Store the computed style lookup result
        const computedStyle = getComputedStyle(element);
        
        if (
            tagName === 'ion-card' ||
            tagName === 'button' ||
            tagName === 'a' ||
            element.onclick ||
            element.getAttribute('role') === 'button' ||
            element.classList.contains('clickable') ||
            computedStyle.cursor === 'pointer' ||
            // Additional common clickable elements
            tagName === 'input' && ['button', 'submit', 'reset'].includes(element.type) ||
            element.getAttribute('tabindex') === '0'
        ) {
            return element;
        }
    }
    
    // If no clickable element found, return the first element
    return elements[0];
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

// Enhanced click event logging
function logClickEvent(event) {
    const x = event.clientX;
    const y = event.clientY;
    const resolutionWidth = window.innerWidth;
    const resolutionHeight = window.innerHeight;
    
    // Get element at click coordinates
    const targetElement = getElementFromPoint(x, y);
    
    // Get XPath
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

// Event listener setup with capture phase to ensure we get all clicks
document.addEventListener('click', logClickEvent, true);

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
    let xpath = 'unknown';
    try {
        xpath = getFullElementXPath(event.target);
    } catch (error) {
        console.warn('Failed to get XPath for input event:', error);
    }

    const value = event.target.value;
    const type = event.target.type;

    if (['text', 'textarea', 'email', 'password'].includes(type)) {
        console.log(`Input recorded: ${xpath}`);
        chrome.runtime.sendMessage({
            action: 'recordAction',
            actionText: `input|${xpath}|${value}`,
        });
    }
}

document.addEventListener('submit', logSubmitEvent, true);
document.addEventListener('input', logInputEvent, true);