// Explicitly initialize recordedActions
let recordedActions = [];
let isRecording = false;

// Load initial state from storage
chrome.storage.local.get(['isRecording', 'recordedActions'], (result) => {
  isRecording = result.isRecording || false;
  recordedActions = Array.isArray(result.recordedActions) 
    ? result.recordedActions 
    : [];
});

// Enhanced error handling in message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch(request.action) {
      case 'startRecording':
        isRecording = true;
        chrome.storage.local.set({ isRecording: true });
        sendResponse({ success: true });
        break;
      case 'stopRecording':
        isRecording = false;
        chrome.storage.local.set({ isRecording: false });
        sendResponse({ success: true });
        break;
      case 'resetRecording':
        recordedActions = [];
        chrome.storage.local.set({ 
          recordedActions: [],
          // isRecording: false 
        });
        sendResponse({ success: true });
        break;
      case 'getActions':
        // Ensure we're sending an object with an actions array
        sendResponse({ 
          actions: Array.isArray(recordedActions) ? recordedActions : [],
          isRecording: isRecording
        });
        return true;
      case 'recordAction':
        if (isRecording && request.actionText) {
          recordedActions.push(request.actionText);
          // Save actions to storage
          chrome.storage.local.set({ recordedActions });
          sendResponse({ success: true });
        }
        break;
      default:
        console.error('Unknown action:', request.action);
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error in message listener:', error);
    sendResponse({ error: error.toString() });
  }
  return true;
});

// Periodic save with error handling
setInterval(() => {
  try {
    chrome.storage.local.set({ 
      recordedActions: Array.isArray(recordedActions) ? recordedActions : [],
      isRecording: isRecording
    });
  } catch (error) {
    console.error('Error saving recorded actions:', error);
  }
}, 5000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
      switch(request.action) {
          case 'startRecording':
              isRecording = true;
              chrome.storage.local.set({ isRecording: true });
              // Notify all tabs about recording state change
              chrome.tabs.query({}, (tabs) => {
                  tabs.forEach(tab => {
                      chrome.tabs.sendMessage(tab.id, {
                          action: 'recordingStateChanged',
                          isRecording: true
                      }).catch(() => {
                          // Ignore errors for inactive tabs
                      });
                  });
              });
              sendResponse({ success: true });
              break;
          case 'stopRecording':
              isRecording = false;
              chrome.storage.local.set({ isRecording: false });
              // Notify all tabs about recording state change
              chrome.tabs.query({}, (tabs) => {
                  tabs.forEach(tab => {
                      chrome.tabs.sendMessage(tab.id, {
                          action: 'recordingStateChanged',
                          isRecording: false
                      }).catch(() => {
                          // Ignore errors for inactive tabs
                      });
                  });
              });
              sendResponse({ success: true });
              break;
          // Rest of the switch cases remain the same...
      }
  } catch (error) {
      console.error('Error in message listener:', error);
      sendResponse({ error: error.toString() });
  }
  return true;
});