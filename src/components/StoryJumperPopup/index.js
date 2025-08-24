import React, { useState, useEffect } from 'react';
import './index.css';

function StoryJumperPopup() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isStoryJumperPage, setIsStoryJumperPage] = useState(false);

  useEffect(() => {
    // Check if current tab is StoryJumper page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      setIsStoryJumperPage(currentTab.url.includes('storyjumper.com/sjeditor/edit/'));
    });
  }, []);

  const handleDownloadPDF = async () => {
    setIsLoading(true);
    setStatus('Generating PDF...');
    
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'generatePDF' }, (response) => {
          setIsLoading(false);
          if (response) {
            setStatus('PDF downloaded successfully!');
          } else {
            setStatus('Failed to generate PDF');
          }
          setTimeout(() => setStatus(''), 3000);
        });
      });
    } catch (error) {
      setIsLoading(false);
      setStatus('Error generating PDF');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleOpenImagesTab = async () => {
    setIsLoading(true);
    setStatus('Opening images in new tab...');
    
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'openImagesTab' }, (response) => {
          setIsLoading(false);
          if (response) {
            setStatus('Images opened in new tab!');
          } else {
            setStatus('Failed to open images');
          }
          setTimeout(() => setStatus(''), 3000);
        });
      });
    } catch (error) {
      setIsLoading(false);
      setStatus('Error opening images');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleOpenHTMLTab = async () => {
    setIsLoading(true);
    setStatus('Opening book content in new tab...');
    
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'openHTMLTab' }, (response) => {
          setIsLoading(false);
          if (response) {
            setStatus('Book content opened in new tab!');
          } else {
            setStatus('Failed to open book content');
          }
          setTimeout(() => setStatus(''), 3000);
        });
      });
    } catch (error) {
      setIsLoading(false);
      setStatus('Error opening book content');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleDownloadImagesZip = async () => {
    setIsLoading(true);
    setStatus('Downloading images as ZIP...');
    
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'downloadImagesZip' }, (response) => {
          setIsLoading(false);
          if (response) {
            setStatus('Images downloaded successfully!');
          } else {
            setStatus('Failed to download images');
          }
          setTimeout(() => setStatus(''), 3000);
        });
      });
    } catch (error) {
      setIsLoading(false);
      setStatus('Error downloading images');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  if (!isStoryJumperPage) {
    return (
      <div className="storyjumper-popup">
        <div className="header">
          <h3>StoryJumper Book Downloader</h3>
        </div>
        <div className="content">
          <p className="info-message">
            This extension works on StoryJumper editor pages.
          </p>
          <p className="small-text">
            Navigate to a book editor at storyjumper.com/sjeditor/edit/
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="storyjumper-popup">
      <div className="header">
        <h3>Download Options</h3>
      </div>
      
      <div className="content">
        {status && (
          <div className={`status ${status.includes('Error') || status.includes('Failed') ? 'error' : 'success'}`}>
            {status}
          </div>
        )}
        
        <div className="download-options">
          <div className="option-item">
            <span className="option-text">PDF From Images</span>
            <button 
              className="download-btn"
              onClick={handleDownloadPDF}
              disabled={isLoading}
            >
              {isLoading && status.includes('PDF') ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
          
          <div className="option-item">
            <span className="option-text">Images in New Tab</span>
            <button 
              className="download-btn"
              onClick={handleOpenImagesTab}
              disabled={isLoading}
            >
              {isLoading && status.includes('images') && !status.includes('ZIP') ? 'Opening...' : 'Open Tab'}
            </button>
          </div>
          
          <div className="option-item">
            <span className="option-text">Download Images</span>
            <button 
              className="download-btn"
              onClick={handleDownloadImagesZip}
              disabled={isLoading}
            >
              {isLoading && status.includes('ZIP') ? 'Downloading...' : 'Download'}
            </button>
          </div>
          
          <div className="option-item">
            <span className="option-text">Book content in New Tab</span>
            <button 
              className="download-btn"
              onClick={handleOpenHTMLTab}
              disabled={isLoading}
            >
              {isLoading && status.includes('book content') ? 'Opening...' : 'Open Tab'}
            </button>
          </div>
        </div>
        
        <div className="footer">
          <p className="small-text">Make sure the book editor is fully loaded before downloading.</p>
        </div>
      </div>
    </div>
  );
}

export default StoryJumperPopup;
