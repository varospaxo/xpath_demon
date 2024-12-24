document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startRecording');
  const stopButton = document.getElementById('stopRecording');
  const resetButton = document.getElementById('resetRecording');
  const copyButton = document.getElementById('copyActions');
  const actionList = document.getElementById('actionList');

  // Function to update UI based on recording state
  function updateUIState(isRecording) {
    startButton.disabled = isRecording;
    stopButton.disabled = !isRecording;
  }

  // Retrieve current recording state on popup load
  chrome.runtime.sendMessage({ action: 'getActions' }, (response) => {
    // Retrieve and display existing actions
    if (response && response.actions && Array.isArray(response.actions)) {
      actionList.innerHTML = ''; // Clear previous actions
      response.actions.forEach(action => {
        const actionElement = document.createElement('div');
        actionElement.textContent = action;
        actionList.appendChild(actionElement);
      });
    }

    // Check and restore recording state
    chrome.storage.local.get(['isRecording'], (storageResult) => {
      const currentRecordingState = storageResult.isRecording || false;
      updateUIState(currentRecordingState);
    });
  });

  // Send message to start recording
  startButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startRecording' }, (response) => {
      if (response.success) {
        // Save recording state to storage
        chrome.storage.local.set({ isRecording: true });
        updateUIState(true);
      }
    });
  });

  // Send message to stop recording
  stopButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
      if (response.success) {
        // Save recording state to storage
        chrome.storage.local.set({ isRecording: false });
        updateUIState(false);
      }
    });
  });

  // Reset recorded actions
  resetButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resetRecording' }, (response) => {
      if (response.success) {
        actionList.innerHTML = '';
        // Optionally, reset recording state if needed
        // chrome.storage.local.set({ isRecording: false });
        // updateUIState(false);
      }
    });
  });

  // Copy actions to clipboard
  copyButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getActions' }, (response) => {
      if (response && response.actions && response.actions.length > 0) {
        const actionText = response.actions.join('\n');
        navigator.clipboard.writeText(actionText).then(() => {
          alert('Actions copied to clipboard!');
        }).catch(err => {
          console.error('Failed to copy actions:', err);
          alert('Failed to copy actions. Check console for details.');
        });
      } else {
        alert('No actions recorded.');
      }
    });
  });
});