import { extractContent, getPageMetadata } from './extractor';

// Content script entry point
// Listens for messages from background script

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    try {
      const content = extractContent();
      const metadata = getPageMetadata();

      sendResponse({
        success: true,
        data: {
          ...metadata,
          ...content,
        },
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (message.type === 'GET_PAGE_INFO') {
    try {
      const metadata = getPageMetadata();
      sendResponse({
        success: true,
        data: metadata,
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Return true to indicate async response
  return true;
});

// Notify background script that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
