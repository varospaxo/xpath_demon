document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startRecording');
  const stopButton = document.getElementById('stopRecording');
  const resetButton = document.getElementById('resetRecording');
  const copyButton = document.getElementById('copyActions');
  const actionList = document.getElementById('actionList');
  const useIdCheckbox = document.getElementById('useIdCheckbox');
  const xpathOnlyCheckbox = document.getElementById('xpathOnlyCheckbox');

  // Function to update UI based on recording state
  function updateUIState(isRecording) {
      startButton.disabled = isRecording;
      stopButton.disabled = !isRecording;
  }

  // Load checkbox state from storage
  chrome.storage.local.get(['useId'], (result) => {
      useIdCheckbox.checked = result.useId || false;
  });
  chrome.storage.local.get(['xpathOnlyMode'], (result) => {
    xpathOnlyCheckbox.checked = result.xpathOnlyMode || false;
  });

  // Handle checkbox changes
  useIdCheckbox.addEventListener('change', () => {
      const useId = useIdCheckbox.checked;
      chrome.storage.local.set({ useId });
      chrome.runtime.sendMessage({ 
          action: 'updateUseId', 
          useId: useId 
      });
  });

  xpathOnlyCheckbox.addEventListener('change', () => {
    const xpathOnlyMode = xpathOnlyCheckbox.checked;
    chrome.storage.local.set({ xpathOnlyMode });
    chrome.runtime.sendMessage({ 
      action: 'updateXpathOnlyMode', 
      xpathOnlyMode: xpathOnlyMode 
    });
  });

  // Rest of your existing popup.js code...
  chrome.runtime.sendMessage({ action: 'getActions' }, (response) => {
      if (response && response.actions && Array.isArray(response.actions)) {
          actionList.innerHTML = '';
          response.actions.forEach(action => {
              const actionElement = document.createElement('div');
              actionElement.textContent = action;
              actionList.appendChild(actionElement);
          });
      }

      chrome.storage.local.get(['isRecording'], (storageResult) => {
          const currentRecordingState = storageResult.isRecording || false;
          updateUIState(currentRecordingState);
      });
  });

  // Your existing button event listeners...
  startButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'startRecording' }, (response) => {
          if (response.success) {
              chrome.storage.local.set({ isRecording: true });
              updateUIState(true);
          }
      });
  });

  stopButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
          if (response.success) {
              chrome.storage.local.set({ isRecording: false });
              updateUIState(false);
          }
      });
  });

  resetButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'resetRecording' }, (response) => {
          if (response.success) {
              actionList.innerHTML = '';
          }
      });
  });

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