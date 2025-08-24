import './index.css';
import { useState, useEffect } from 'react';
import StoryJumperPopup from "../StoryJumperPopup";

function App() {
  const [isStoryJumperPage, setIsStoryJumperPage] = useState(false);

  useEffect(() => {
    // Check if current tab is StoryJumper page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (currentTab && currentTab.url) {
        setIsStoryJumperPage(currentTab.url.includes('storyjumper.com/sjeditor/edit/'));
      }
    });
  }, []);

  if (!isStoryJumperPage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8">
        <h2 className="text-lg font-semibold mb-4">StoryJumper Book Downloader</h2>
        <p className="text-center text-gray-600">
          Please navigate to a StoryJumper editor page to use this extension.
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          Visit: storyjumper.com/sjeditor/edit/[book-id]
        </p>
      </div>
    );
  }

  return (
    <div>
      <StoryJumperPopup />
    </div>
  );
}

export default App;
