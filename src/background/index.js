// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//     try {
//         if (changeInfo.status === 'loading') {
//             const storyJumperPattern = /https:\/\/.*storyjumper\.com\/sjeditor\/edit\//;
//             const regexTest = storyJumperPattern.test(tab.url);
//             if (regexTest) {
//                 chrome.action.setIcon({ path: '../../icons/normal_48.png', tabId: tabId });
//             } else {
//                 chrome.action.setIcon({ path: '../../icons/grayed_out_48.png', tabId: tabId });
//             }
//         }
//     } catch (error) {
//         console.error('Error occurred:', error);
//     }
// });

// Handle screen capture requests from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'capture') {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, {
            format: request.format || 'png',
            quality: request.quality || 1.0
        }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error('Error capturing tab:', chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ image: dataUrl });
            }
        });
        return true; // Keep message channel open for async response
    }
});
