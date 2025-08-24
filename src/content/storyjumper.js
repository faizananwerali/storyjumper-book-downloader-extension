import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

// Wait for page to fully load editor content
function waitForEditorLoad() {
  return new Promise((resolve) => {
    const checkEditor = () => {
      const pageEditor = document.getElementById('page-editor');
      const pageSpreads = document.querySelectorAll('.sjpagespread:not(.inactive)');

      if (pageEditor && pageSpreads.length > 0) {
        resolve();
      } else {
        setTimeout(checkEditor, 1000);
      }
    };

    // Wait initial 7 seconds as specified in requirements
    setTimeout(checkEditor, 7000);
  });
}

// Get all book pages from the editor
function getBookPages() {
  const pages = [];
  const pageSpreads = document.querySelectorAll('.sjpagespread:not(.inactive)');

  pageSpreads.forEach((spread, spreadIndex) => {
    const leftPage = spread.querySelector('.sjpagethumbnail.leftpage');
    const rightPage = spread.querySelector('.sjpagethumbnail.rightpage');

    if (leftPage && !leftPage.classList.contains('frontcover')) {
      pages.push({
        element: leftPage,
        position: leftPage.getAttribute('data-position'),
        type: leftPage.getAttribute('data-pagetype'),
        label: leftPage.parentElement.querySelector('.sjpagelabel')?.textContent || `Page ${pages.length + 1}`
      });
    }

    if (rightPage) {
      pages.push({
        element: rightPage,
        position: rightPage.getAttribute('data-position'),
        type: rightPage.getAttribute('data-pagetype'),
        label: rightPage.parentElement.querySelector('.sjpagelabel')?.textContent || `Page ${pages.length + 1}`
      });
    }
  });

  return pages.sort((a, b) => parseInt(a.position) - parseInt(b.position));
}

// Click on page to display it properly
async function clickAndWaitForPage(pageElement) {
  return new Promise((resolve) => {
    pageElement.click();
    setTimeout(resolve, 2000); // Wait for page to fully load
  });
}

// Capture the active page element using chrome API approach
async function captureActivePageElement() {
  return new Promise((resolve) => {
    // Try multiple selectors for the active page element
    const selectors = [
      '.sjeditwindowcontainer .sjeditwindowwrapper.activepage',
      '.sjpageeditor.activepage',
      '.sjpagecontent',
      '.sjpagethumbnail.activepage'
    ];

    let activeElement = null;
    for (const selector of selectors) {
      activeElement = document.querySelector(selector);
      if (activeElement) break;
    }

    if (!activeElement) {
      console.log('No active element found for capture');
      resolve(null);
      return;
    }

    const rect = activeElement.getBoundingClientRect();

    // Check if element has valid dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.log('Active element has invalid dimensions:', rect);
      resolve(null);
      return;
    }

    chrome.runtime.sendMessage({
      message: 'capture',
      format: 'png',
      quality: 1.0
    }, (response) => {
      if (response && response.image) {
        // Crop the captured viewport to the element bounds
        cropImageToElement(response.image, rect, (croppedImage) => {
          resolve(croppedImage);
        });
      } else {
        console.log('Chrome capture failed:', response);
        resolve(null);
      }
    });
  });
}

// Crop captured image to specific element bounds
function cropImageToElement(imageDataURL, elementRect, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Account for device pixel ratio
    const dpr = window.devicePixelRatio || 1;

    // Ensure we have valid dimensions
    const cropWidth = Math.max(1, Math.floor(elementRect.width * dpr));
    const cropHeight = Math.max(1, Math.floor(elementRect.height * dpr));
    const sourceX = Math.max(0, Math.floor(elementRect.left * dpr));
    const sourceY = Math.max(0, Math.floor(elementRect.top * dpr));

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Set white background in case crop is outside image bounds
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      // Only crop if we have valid source bounds within the image
      if (sourceX + cropWidth <= img.width && sourceY + cropHeight <= img.height) {
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          cropWidth,
          cropHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        console.log('Crop bounds exceed image dimensions, using full image');
        // Scale the full image to fit the canvas
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (canvas.width - scaledWidth) / 2;
        const offsetY = (canvas.height - scaledHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
      // Fallback: just scale the full image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    callback(canvas.toDataURL('image/png'));
  };
  img.onerror = () => {
    console.error('Failed to load image for cropping');
    callback(null);
  };
  img.src = imageDataURL;
}

// Capture page as image with proper display (fallback method)
async function capturePageAsImage(pageElement) {
  try {
    // First click on the page to ensure it's active and visible
    await clickAndWaitForPage(pageElement);

    // Scroll the element into view
    pageElement.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });

    // Wait a bit more for rendering
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Try the chrome API approach first for better quality
    const activePageCapture = await captureActivePageElement();
    if (activePageCapture) {
      console.log('Chrome API capture successful');
      return activePageCapture;
    }

    // Fallback to html2canvas method
    console.log('Using html2canvas fallback');

    const computedStyle = window.getComputedStyle(pageElement);
    const backgroundColor = computedStyle.backgroundColor || '#ffffff';

    // Ensure element is visible and has content
    if (pageElement.offsetWidth === 0 || pageElement.offsetHeight === 0) {
      console.error('Page element has zero dimensions');
      return null;
    }

    const canvas = await html2canvas(pageElement, {
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering: false,
      backgroundColor: backgroundColor,
      scale: 2, // 2x scale for better print quality
      logging: false,
      width: pageElement.offsetWidth,
      height: pageElement.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      imageTimeout: 30000,
      onclone: function(clonedDoc) {
        // Preserve original styling
        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          * {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      }
    });

    if (canvas.width === 0 || canvas.height === 0) {
      console.error('Generated canvas has zero dimensions');
      return null;
    }

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error capturing page:', error);
    return null;
  }
}

// Generate PDF from images with incremental capture
async function generatePDFFromImages() {
  try {
    const pages = getBookPages();
    const pdf = new jsPDF('p', 'mm', 'a4');
    let isFirstPage = true;

    console.log(`Starting PDF generation for ${pages.length} pages`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`Capturing page ${i + 1}/${pages.length}: ${page.label}`);

      const imageData = await capturePageAsImage(page.element);
      if (imageData) {
        if (!isFirstPage) {
          pdf.addPage();
        }

        const imgProps = pdf.getImageProperties(imageData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        isFirstPage = false;
      }

      // Add delay between captures for better results
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    pdf.save('storybook.pdf');
    console.log('PDF generation completed');
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
}

// Open images in new tab with incremental capture
async function openImagesInNewTab() {
  try {
    const pages = getBookPages();
    const images = [];

    console.log(`Starting image capture for ${pages.length} pages`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`Capturing page ${i + 1}/${pages.length}: ${page.label}`);

      const imageData = await capturePageAsImage(page.element);
      if (imageData) {
        images.push({
          src: imageData,
          label: page.label
        });
      }

      // Add delay between captures
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const newTab = window.open('', '_blank');
    const html = generateImageViewerHTML(images);
    newTab.document.write(html);
    newTab.document.close();

    console.log('Images opened in new tab');
    return true;
  } catch (error) {
    console.error('Error opening images in new tab:', error);
    return false;
  }
}

// Download images as ZIP file with incremental capture
async function downloadImagesAsZip() {
  try {
    const pages = getBookPages();
    const zip = new JSZip();

    console.log(`Starting image capture for ${pages.length} pages to create ZIP`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`Capturing page ${i + 1}/${pages.length}: ${page.label}`);

      const imageData = await capturePageAsImage(page.element);
      if (imageData) {
        // Remove the "data:image/png;base64," prefix
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');

        // Create filename with page number and label
        const filename = `Page ${i + 1} - ${page.label}.png`;

        // Add image to ZIP
        zip.file(filename, base64Data, { base64: true });
      }

      // Add delay between captures
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Generate ZIP file and download
    console.log('Generating ZIP file...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create download link
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'storybook-pages.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('ZIP file downloaded successfully');
    return true;
  } catch (error) {
    console.error('Error downloading images as ZIP:', error);
    return false;
  }
}

// Get all computed styles for an element and its children
function getElementWithInlineStyles(element) {
  const clonedElement = element.cloneNode(true);

  // Apply inline styles to the cloned element
  function applyInlineStyles(originalEl, clonedEl) {
    if (originalEl.nodeType !== Node.ELEMENT_NODE) return;

    const computedStyle = window.getComputedStyle(originalEl);
    const inlineStyle = [];

    // Copy all computed styles as inline styles
    for (let i = 0; i < computedStyle.length; i++) {
      const property = computedStyle[i];
      const value = computedStyle.getPropertyValue(property);
      inlineStyle.push(`${property}: ${value}`);
    }

    clonedEl.style.cssText = inlineStyle.join('; ');

    // Recursively apply to children
    const originalChildren = originalEl.children;
    const clonedChildren = clonedEl.children;

    for (let i = 0; i < originalChildren.length && i < clonedChildren.length; i++) {
      applyInlineStyles(originalChildren[i], clonedChildren[i]);
    }
  }

  applyInlineStyles(element, clonedElement);
  return clonedElement;
}

// Open HTML content in new tab with full styling
function openHTMLInNewTab() {
  try {
    const pages = getBookPages();
    const htmlContent = pages.map((page, index) => {
      console.log(`Processing page ${index + 1}/${pages.length}: ${page.label}`);

      // Get the original dimensions
      const originalRect = page.element.getBoundingClientRect();
      const originalWidth = page.element.offsetWidth;
      const originalHeight = page.element.offsetHeight;

      const styledElement = getElementWithInlineStyles(page.element);

      // Ensure the cloned element maintains exact same size
      styledElement.style.width = `${originalWidth}px`;
      styledElement.style.height = `${originalHeight}px`;
      styledElement.style.boxSizing = 'border-box';
      styledElement.style.display = 'block';
      styledElement.style.margin = '0 auto';

      return `
        <div class="book-page" style="
          page-break-after: always; 
          margin-bottom: 40px;
          padding: 20px;
          text-align: center;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        ">
          <h3 style="text-align: center; margin-bottom: 20px; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">${page.label}</h3>
          <div style="display: inline-block; text-align: left;">
            ${styledElement.outerHTML}
          </div>
        </div>
      `;
    }).join('');

    const newTab = window.open('', '_blank');
    const html = generateBookViewerHTML(htmlContent);
    newTab.document.write(html);
    newTab.document.close();

    console.log('HTML content opened in new tab with full styling');
    return true;
  } catch (error) {
    console.error('Error opening HTML in new tab:', error);
    return false;
  }
}

// Generate HTML for image viewer
function generateImageViewerHTML(images) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>StoryJumper Book Downloader - Image View</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .page-container {
          background: white;
          margin: 20px 0;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          page-break-after: always;
          text-align: center;
        }
        .page-image {
          max-width: 100%;
          height: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .page-label {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #333;
        }
        @media print {
          .page-container {
            box-shadow: none;
            border: none;
          }
        }
      </style>
    </head>
    <body>
      <h1 style="text-align: center; color: #333; margin-bottom: 30px;">StoryJumper Book Downloader - Print Ready</h1>
      ${images.map(img => `
        <div class="page-container">
          <div class="page-label">${img.label}</div>
          <img src="${img.src}" alt="${img.label}" class="page-image" />
        </div>
      `).join('')}
    </body>
    </html>
  `;
}

// Generate HTML for book viewer with preserved styling
function generateBookViewerHTML(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>StoryJumper Book Downloader - Print Ready</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          box-sizing: border-box;
        }
        
        @page {
          size: A4;
          margin: 0.5in;
        }
        
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
          line-height: 1.4;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
        
        .page-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .book-page {
          background: white;
          margin: 0 auto 40px;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          page-break-after: always;
          page-break-inside: avoid;
          max-width: 210mm;
          min-height: 250mm;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        
        .book-page:last-child {
          page-break-after: auto;
        }
        
        .book-page h3 {
          text-align: center;
          margin: 0 0 20px 0;
          color: #333;
          border-bottom: 2px solid #007bff;
          padding-bottom: 10px;
          font-size: 18px;
          flex-shrink: 0;
        }
        
        .page-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* Ensure nested content is properly sized */
        .page-content > * {
          max-width: 100%;
          height: auto;
        }
        
        /* Preserve font faces and text rendering */
        img, canvas, svg {
          max-width: 100%;
          height: auto;
          page-break-inside: avoid;
        }
        
        /* Print styles */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0.5in;
          }
          
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 12pt;
          }
          
          .page-header {
            display: none;
          }
          
          .book-page {
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 20pt !important;
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: visible !important;
          }
          
          .book-page:last-child {
            page-break-after: auto;
          }
          
          .book-page h3 {
            font-size: 16pt !important;
            margin: 0 0 15pt 0 !important;
            padding-bottom: 8pt !important;
          }
          
          /* Fix only the scale: 9 issue for print */
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .sjpagethumbnail {
            scale: 9 !important;
            transform: translateY(50%) !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="page-header">
        <h1 style="color: #333; margin: 0;">StoryJumper Book Downloader - Print Ready</h1>
        <p style="color: #666; margin: 10px 0 0 0;">Use Ctrl+P (Cmd+P on Mac) to print or save as PDF</p>
      </div>
      <style>
        .sjpagethumbnail {
          scale: 9 !important;
          transform: translateY(50%) !important;
        }
      </style>
      ${content}
    </body>
    </html>
  `;
}

// Replace Buy Book button with download dropdown
function replaceBuyBookButton() {
  const buyButton = document.querySelector('.buyButton');
  if (buyButton) {
    const dropdownHTML = `
      <div class="download-dropdown" style="position: relative; display: inline-block;">
        <button class="download-btn" style="
          background-color: #007bff;
          color: white;
          padding: 5px 25px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
        ">
          <i class="fa fa-download"></i> Download PDF ▼
        </button>
        <div class="dropdown-content" style="
          display: none;
          position: absolute;
          right: 0;
          top: 100%;
          background-color: white;
          min-width: 200px;
          box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
          border-radius: 4px;
          z-index: 1000;
          border: 1px solid #ddd;
        ">
          <a href="#" class="pdf-from-images" style="
            color: black;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            border-bottom: 1px solid #eee;
          ">PDF from Images</a>
          <a href="#" class="images-new-tab" style="
            color: black;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            border-bottom: 1px solid #eee;
          ">Images in New Tab</a>
          <a href="#" class="download-images-zip" style="
            color: black;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            border-bottom: 1px solid #eee;
          ">Download Images</a>
          <a href="#" class="html-new-tab" style="
            color: black;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
          ">Book content in New Tab</a>
        </div>
      </div>
    `;

    buyButton.outerHTML = dropdownHTML;

    // Add event listeners
    const downloadBtn = document.querySelector('.download-btn');
    const dropdownContent = document.querySelector('.dropdown-content');

    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      dropdownContent.style.display = dropdownContent.style.display === 'none' ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.download-dropdown')) {
        dropdownContent.style.display = 'none';
      }
    });

    // Add functionality to dropdown options
    document.querySelector('.pdf-from-images').addEventListener('click', async (e) => {
      e.preventDefault();
      dropdownContent.style.display = 'none';
      await generatePDFFromImages();
    });

    document.querySelector('.images-new-tab').addEventListener('click', async (e) => {
      e.preventDefault();
      dropdownContent.style.display = 'none';
      await openImagesInNewTab();
    });

    document.querySelector('.download-images-zip').addEventListener('click', async (e) => {
      e.preventDefault();
      dropdownContent.style.display = 'none';
      await downloadImagesAsZip();
    });

    document.querySelector('.html-new-tab').addEventListener('click', (e) => {
      e.preventDefault();
      dropdownContent.style.display = 'none';
      openHTMLInNewTab();
    });
  }
}

// Initialize extension
async function initStoryJumperExtension() {
  await waitForEditorLoad();
  replaceBuyBookButton();
}

// Communication with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generatePDF') {
    generatePDFFromImages().then(sendResponse);
    return true;
  } else if (request.action === 'openImagesTab') {
    openImagesInNewTab().then(sendResponse);
    return true;
  } else if (request.action === 'openHTMLTab') {
    openHTMLInNewTab().then(sendResponse);
    return true;
  } else if (request.action === 'downloadImagesZip') {
    downloadImagesAsZip().then(sendResponse);
    return true;
  }
});

// Start the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStoryJumperExtension);
} else {
  initStoryJumperExtension();
}
