# XPath Demon

A Chrome extension that records user interactions on web pages by capturing XPath selectors, mouse coordinates, viewport information, and scroll actions. Perfect for web testing, automation, and user behavior analysis.

## Features

- Records precise user interactions including:
  - Clicks with XPath selectors and coordinates
  - Input field interactions with encoded values
  - Scroll events with direction and distance
  - Viewport size information
- Real-time element highlighting and tooltips
- Support for complex web components (Ionic, Material, Vue, React)
- Automatic handling of multi-line input fields
- Persistent storage of recorded actions
- Copy recorded actions to clipboard
- Dark mode interface

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon to open the popup interface
2. Click "Start Recording" to begin capturing actions
3. Interact with the webpage normally:
   - Click elements
   - Type in input fields
   - Scroll the page
4. Elements will be highlighted as you hover over them, showing their XPath
5. Click "Stop Recording" when finished
6. Use "Copy Actions" to copy all recorded actions to clipboard
7. Click "Reset" to clear all recorded actions

## Recorded Action Format

Actions are recorded in the following formats:

### Click Events
```
click|xpath|x,y|viewportWidth x viewportHeight
```

### Input Events
```
input|xpath|value|type|encoding
```

### Scroll Events
```
scroll_by|deltaX|deltaY|viewportWidth x viewportHeight
```

## Version History

- v1: Initial release with basic XPath recording
- v2: Added coordinate and viewport size tracking
- v3: Enhanced complex element detection (cards, etc.)
- v4: Added additional parameter recording
- v5: Implemented element highlighting and XPath tooltips
- v6: Added scroll tracking and tooltip fixes

## Technical Details

### Components

- `background.js`: Manages extension state and storage
- `content.js`: Handles DOM event listening and action recording
- `popup.html/js`: Provides user interface and controls
- `manifest.json`: Extension configuration

### Key Features Implementation

#### Element Detection
The extension uses sophisticated element detection to identify clickable elements:
```javascript
- Standard elements (buttons, links)
- Custom components (ion-card, etc.)
- Elements with click handlers
- Elements with role="button"
- Elements with cursor: pointer
```

#### XPath Generation
Generates unique, reliable XPath selectors for elements:
- Prioritizes element IDs when available
- Includes position indices for similar siblings
- Handles complex DOM hierarchies

#### Input Handling
Supports various input types:
- Standard HTML inputs
- Contenteditable elements
- Custom editors (Monaco, Quill)
- Multi-line inputs with special encoding

## Browser Support

- Chrome: Version 88+
- Chromium-based browsers (Edge, Brave, etc.)

## Permissions

The extension requires:
- `activeTab`: For interacting with the current tab
- `storage`: For saving recorded actions

## Development

### Building

No build step required - this is a vanilla JavaScript extension.

### Testing

1. Load the extension in developer mode
2. Open the developer tools console to view debug logs
3. Test on various websites to ensure proper element detection

### Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Known Limitations

- Only works on standard web pages (no Chrome Web Store or Settings pages)
- May have reduced functionality on pages with strict CSP
- Some dynamic elements might not be detected properly