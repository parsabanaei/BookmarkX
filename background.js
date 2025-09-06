// BookmarkX Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('BookmarkX extension installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  openBookmarkManager();
});

// Open the bookmark manager interface
function openBookmarkManager() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('manager.html')
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openManager') {
    openBookmarkManager();
    sendResponse({ success: true });
  }
  
  if (request.action === 'getBookmarks') {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      sendResponse({ bookmarks: bookmarkTreeNodes });
    });
    return true; // Keep message channel open for async response
  }
});

// Handle bookmark changes for real-time updates
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  // Notify open manager tabs about bookmark changes
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && tab.url.includes(chrome.runtime.getURL('manager.html'))) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'bookmarkCreated',
          bookmark: bookmark
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      }
    });
  });
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && tab.url.includes(chrome.runtime.getURL('manager.html'))) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'bookmarkRemoved',
          id: id,
          removeInfo: removeInfo
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      }
    });
  });
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && tab.url.includes(chrome.runtime.getURL('manager.html'))) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'bookmarkChanged',
          id: id,
          changeInfo: changeInfo
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      }
    });
  });
});
