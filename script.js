// --- Help Modal Logic ---
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const helpContent = document.getElementById('help-content');
const closeHelpModal = document.getElementById('close-help-modal');

helpBtn.addEventListener('click', () => {
    // Hardcoded help instructions as HTML <p> tags
    helpContent.innerHTML = `
        <p style='font-weight:bold;'>Certificate & ID Generator - Help Guide</p>
        <p>Welcome! This guide will help you use the Certificate & ID Generator web app step by step.</p>
        <p style='font-weight:bold;'>1. Choose a Mode</p>
        <p><b>Certificate Mode:</b> For certificates with a static or multiple signatures.</p>
        <p><b>ID Card Mode:</b> For ID cards with dynamic photos for each person.</p>
        <p style='font-weight:bold;'>2. Upload Your Template</p>
        <p>Click <b>"Upload Template Image"</b> and select a background image (JPG or PNG) for your certificate or ID card.</p>
        <p style='font-weight:bold;'>3. Upload Your Data File</p>
        <p>Click <b>"Upload Data File"</b> and select your CSV or Excel file. Your file should have columns for names and, if needed, a column for photo or signature filenames.</p>
        <p style='font-weight:bold;'>4. Upload Signatures or Photos</p>
        <p><b>Certificate Mode:</b> Click <b>"Upload Signature Graphic"</b> and select one or more signature images (PNG/JPG). You can upload multiple signatures at once.</p>
        <p><b>ID Card Mode:</b> Click <b>"Upload Dynamic ID Photos (ZIP)"</b> and select a ZIP file containing all photos (PNG/JPG). The photo filenames (without extension) must match the values in your data file's photo column.</p>
        <p><b>IMPORTANT:</b> For best results, all ID photos should have the same dimensions (width and height). This avoids stretching or resizing issues.</p>
        <p style='font-weight:bold;'>5. Add Fields to the Template</p>
        <p>Use the <b>"Add New Field"</b> dropdown to select a column from your data file. Click <b>"Add Text"</b> to add a text field for that column. Click <b>"Add The Signature"</b> to add a signature block. If you uploaded multiple signatures, you can select which one to use for each block in the settings panel. (ID Mode) Click <b>"Add ID Photo"</b> to add a photo block linked to your photo column.</p>
        <p style='font-weight:bold;'>6. Arrange and Customize Fields</p>
        <p>Drag and drop fields on the canvas to position them. Click a field to select it and adjust its font, color, or size in the settings panel. For signature blocks, use the dropdown in the settings panel to choose which signature image to use. To remove a field, select it and click <b>"Remove Block"</b>.</p>
        <p style='font-weight:bold;'>7. Generate Certificates/ID Cards</p>
        <p>When ready, click <b>"Generate Zip of PDFs"</b>. The app will create a PDF for each row in your data file, using the template and your fields. All PDFs will be zipped and downloaded automatically.</p>
        <p style='font-weight:bold;'>Tips & Troubleshooting</p>
        <p>Make sure your data file's photo/signature column matches the uploaded filenames (case-insensitive, extension optional).</p>
        <p>If a photo or signature does not appear, check for typos or extra spaces in your data file or filenames.</p>
        <p>You can move, edit, or delete any field before generating.</p>
        <p>For best results, use high-resolution template and signature images.</p>
        <hr/>
        <p>If you have any issues, double-check your file formats and column names, and make sure all images are uploaded correctly.</p>
    `;
    helpModal.classList.remove('hidden');
});

closeHelpModal.addEventListener('click', () => {
    helpModal.classList.add('hidden');
});

// Hide modal on background click
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
});
const templateInput = document.getElementById('template-input');
const dataInput = document.getElementById('data-input');
const sigInput = document.getElementById('sig-input');
const idPhotoInput = document.getElementById('id-photo-input');
const editorSection = document.getElementById('editor-section');
const columnSelect = document.getElementById('column-select');
const addTextBtn = document.getElementById('add-text-btn');
const addImageBtn = document.getElementById('add-image-btn');
const addIdPhotoBtn = document.getElementById('add-id-photo-btn');
const sigUploadBox = document.getElementById('sig-upload-box');
const idPhotoUploadBox = document.getElementById('id-photo-upload-box');
const modeSelectors = document.querySelectorAll('input[name="app-mode"]');
const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d');
const generateBtn = document.getElementById('generate-btn');
const statusEl = document.getElementById('generation-status');

// Settings inputs
const settingsPanel = document.getElementById('settings-panel');
const selectedIndicator = document.getElementById('selected-indicator');
const fontSizeInput = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');
const fontFamilyInput = document.getElementById('font-family');
const deleteBtn = document.getElementById('delete-btn');

let templateImage = null;
let parsedData = []; // Array of objects
// let uploadedSignature = null; // The single static signature image object
let uploadedSignatures = {}; // Map of filename (no ext, lower) -> Image object
let uploadedIdPhotos = {}; // Map of filename -> ID Photo Object
let textElements = []; // { id, type: 'text'|'image'|'id-photo', x, y, text, column, fontSize, fontColor, fontFamily }
let isDragging = false;
let draggedElement = null;
let selectedElement = null;
let appMode = 'certificate';

// Handle Mode Selection
modeSelectors.forEach(radio => {
    radio.addEventListener('change', (e) => {
        appMode = e.target.value;
        if (appMode === 'certificate') {
            sigUploadBox.classList.remove('hidden');
            addImageBtn.classList.remove('hidden');
            idPhotoUploadBox.classList.add('hidden');
            addIdPhotoBtn.classList.add('hidden');

            // Optionally, we could remove 'id-photo' elements here, but for simplicity let users keep or delete manually.
        } else {
            sigUploadBox.classList.add('hidden');
            addImageBtn.classList.add('hidden');
            idPhotoUploadBox.classList.remove('hidden');
            addIdPhotoBtn.classList.remove('hidden');
        }
    });
});

// Handle Template Upload
templateInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                templateImage = img;
                canvas.width = img.width;
                canvas.height = img.height;
                checkReady();
                renderCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Handle Data Upload (CSV or Excel)
dataInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
        // Parse CSV
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                parsedData = results.data;
                populateColumns(results.meta.fields);
                checkReady();
            }
        });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

            if (json.length > 0) {
                const headers = json[0];
                parsedData = XLSX.utils.sheet_to_json(worksheet); // Array of objects
                populateColumns(headers);
                checkReady();
            }
        };
        reader.readAsArrayBuffer(file);
    }
});

// Handle Signature Upload
sigInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    uploadedSignatures = {};
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const baseName = file.name.split('/').pop().split('\\').pop().trim();
                const nameNoExt = baseName.replace(/\.[^/.]+$/, '').toLowerCase();
                uploadedSignatures[nameNoExt] = img;
                renderCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

// Handle Zip File containing ID Photos
idPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const zip = await JSZip.loadAsync(file);
        // Reset uploaded photos when a new zip is uploaded
        uploadedIdPhotos = {};

        let loadedCount = 0;
        const totalFiles = Object.keys(zip.files).length;

        // Iterate through all files in the zip
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            // Skip directories and non-image files
            if (zipEntry.dir) continue;

            const lowerName = filename.toLowerCase();
            if (!lowerName.endsWith('.png') && !lowerName.endsWith('.jpg') && !lowerName.endsWith('.jpeg')) {
                continue;
            }

            // Extract the filename without the path (e.g. "folder/asad.jpg" -> "asad.jpg")
            const baseName = filename.split('/').pop().trim();
            // Remove the extension to support simple names in CSV (e.g. "asad.jpg" -> "asad")
            const nameWithoutExtension = baseName.replace(/\.[^/.]+$/, "");
            const lowerCaseKey = nameWithoutExtension.toLowerCase();

            // Read the image file as a Data URL instead of blob to avoid cross-browser blob URL issues in Canvas
            const dataUrl = await zipEntry.async("base64");
            const srcUrl = "data:image/" + (lowerName.endsWith('.png') ? 'png' : 'jpeg') + ";base64," + dataUrl;

            // Load into an Image object
            const img = new Image();
            img.onload = () => {
                // Key the photo library by the name WITHOUT the extension, fully lowercased
                uploadedIdPhotos[lowerCaseKey] = img;
                loadedCount++;
                if (loadedCount % 5 === 0 || loadedCount === totalFiles) {
                    renderCanvas();
                }
            };
            img.src = srcUrl;
        }
    } catch (err) {
        console.error("Error reading zip file:", err);
        alert("There was an error reading the zip file. Please ensure it is a valid zip archive containing images.");
    }
});

function populateColumns(fields) {
    columnSelect.innerHTML = '';
    fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        columnSelect.appendChild(option);
    });
}

function checkReady() {
    if (templateImage && parsedData.length > 0) {
        editorSection.classList.remove('hidden');

        // Auto-add the first column if no text elements exist
        if (textElements.length === 0 && columnSelect.options.length > 0) {
            addTextBlock(columnSelect.options[0].value, 'text');
        }
    }
}

// Add Blocks to Canvas
addTextBtn.addEventListener('click', () => {
    if (columnSelect.options.length > 0) {
        addTextBlock(columnSelect.value, 'text');
    }
});

addImageBtn.addEventListener('click', () => {
    addTextBlock('Signature', 'image');
});

addIdPhotoBtn.addEventListener('click', () => {
    if (columnSelect.options.length > 0) {
        addTextBlock(columnSelect.value, 'id-photo');
    }
});

function addTextBlock(columnName, type) {
    let sampleData = `[${columnName}]`;
    if (type === 'text' || type === 'id-photo') {
        sampleData = parsedData.length > 0 ? (parsedData[0][columnName] !== undefined ? parsedData[0][columnName] : `[${columnName}]`) : `[${columnName}]`;
    }

    const newElement = {
        id: Date.now(),
        type: type,
        column: columnName, // "Signature" for static images
        text: sampleData,
        x: canvas.width / 2,
        y: canvas.height / 2,
        fontSize: (type === 'image' || type === 'id-photo') ? 150 : 40, // For images, fontSize acts as width
        fontColor: '#000000',
        fontFamily: 'Arial',
        signatureKey: (type === 'image') ? Object.keys(uploadedSignatures)[0] || null : null // Default to first signature
    };
    textElements.push(newElement);
    selectElement(newElement);
    renderCanvas();
}

function selectElement(element) {
    selectedElement = element;

    if (element) {
        selectedIndicator.textContent = `${element.column} (${element.type})`;
        selectedIndicator.style.color = 'var(--primary)';
        selectedIndicator.style.fontWeight = 'bold';

        fontSizeInput.value = element.fontSize;
        fontColorInput.value = element.fontColor;
        fontFamilyInput.value = element.fontFamily;

        fontSizeInput.disabled = false;
        fontColorInput.disabled = (element.type === 'image' || element.type === 'id-photo');
        fontFamilyInput.disabled = (element.type === 'image' || element.type === 'id-photo');
        deleteBtn.disabled = false;
    } else {
        selectedIndicator.textContent = 'None';
        selectedIndicator.style.color = 'inherit';
        selectedIndicator.style.fontWeight = 'normal';

        fontSizeInput.value = 40;
        fontColorInput.value = '#000000';
        fontFamilyInput.value = 'Arial';

        fontSizeInput.disabled = true;
        fontColorInput.disabled = true;
        fontFamilyInput.disabled = true;
        deleteBtn.disabled = true;
    }
}

deleteBtn.addEventListener('click', () => {
    if (selectedElement) {
        textElements = textElements.filter(el => el.id !== selectedElement.id);
        selectElement(null);
        renderCanvas();
    }
});

// Update selected block settings
fontSizeInput.addEventListener('input', updateSingleTextSetting);
fontColorInput.addEventListener('input', updateSingleTextSetting);
fontFamilyInput.addEventListener('change', updateSingleTextSetting);

// Add signature selector for image blocks
let sigSelector = null;
function updateSignatureSelector() {
    if (!settingsPanel) return;
    if (sigSelector) {
        sigSelector.remove();
        sigSelector = null;
    }
    if (selectedElement && selectedElement.type === 'image') {
        sigSelector = document.createElement('select');
        sigSelector.style.marginLeft = '1rem';
        Object.keys(uploadedSignatures).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            if (selectedElement.signatureKey === key) opt.selected = true;
            sigSelector.appendChild(opt);
        });
        sigSelector.addEventListener('change', function() {
            selectedElement.signatureKey = this.value;
            renderCanvas();
        });
        // Insert after font family input
        const fontFamilyInput = document.getElementById('font-family');
        fontFamilyInput.parentNode.insertBefore(sigSelector, fontFamilyInput.nextSibling);
    }
}

// Update signature selector when selection changes
const originalSelectElement = selectElement;
selectElement = function(element) {
    selectedElement = element;
    // ...existing code...
    updateSignatureSelector();
    if (typeof originalSelectElement === 'function') originalSelectElement.apply(this, arguments);
}

function updateSingleTextSetting() {
    if (selectedElement) {
        selectedElement.fontSize = parseInt(fontSizeInput.value, 10);
        selectedElement.fontColor = fontColorInput.value;
        selectedElement.fontFamily = fontFamilyInput.value;
        renderCanvas();
    }
}

// Rendering Logic
function renderCanvas(customDataRow = null) {
    if (!templateImage) return;

    // Draw Template
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);

    // Draw Text Elements
    textElements.forEach(el => {
        const textToDraw = customDataRow ? (customDataRow[el.column] || '') : el.text;

        let width = 0;
        let height = 0;

        if (el.type === 'text') {
            ctx.font = `${el.fontSize}px "${el.fontFamily}"`;
            ctx.fillStyle = el.fontColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw text
            ctx.fillText(textToDraw, el.x, el.y);

            const metrics = ctx.measureText(textToDraw);
            width = metrics.width;
            height = el.fontSize;
        } else if (el.type === 'image') {
            width = el.fontSize; // We use fontSize to store width
            height = width / 2; // Rough 2:1 placeholder ratio

            // Multiple signature support
            let sigKey = el.signatureKey || Object.keys(uploadedSignatures)[0];
            let img = sigKey ? uploadedSignatures[sigKey] : null;
            if (img) {
                height = (img.height / img.width) * width; // Maintain aspect ratio
                ctx.drawImage(img, el.x - width / 2, el.y - height / 2, width, height);
            } else {
                // Draw a placeholder box if image not uploaded yet
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.fillRect(el.x - width / 2, el.y - height / 2, width, height);
                ctx.fillStyle = 'black';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`[Missing Sig]`, el.x, el.y);
            }
        } else if (el.type === 'id-photo') {
            width = el.fontSize; // We use fontSize to store width
            height = width; // Default to square if not loaded

            // Clean up textToDraw just in case CSV has extra spaces or accidentaly includes the extension
            let cleanText = textToDraw ? textToDraw.toString().trim().toLowerCase() : '';
            let cleanTextNoExt = cleanText.replace(/\.[^/.]+$/, "");

            // Debug: log what we're searching for and what is available
            if (window && window.console) {
                console.log('Looking for photo:', cleanTextNoExt, 'or', cleanText);
                console.log('Available photos:', Object.keys(uploadedIdPhotos));
            }

            // Try both with and without extension for maximum flexibility
            let img = null;
            if (uploadedIdPhotos[cleanTextNoExt]) {
                img = uploadedIdPhotos[cleanTextNoExt];
            } else if (uploadedIdPhotos[cleanText]) {
                img = uploadedIdPhotos[cleanText];
            }
            if (img) {
                height = (img.height / img.width) * width; // Maintain aspect ratio
                ctx.drawImage(img, el.x - width / 2, el.y - height / 2, width, height);
            } else {
                // Draw a placeholder block
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.fillRect(el.x - width / 2, el.y - height / 2, width, height);
                ctx.fillStyle = 'black';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`[Photo: ${textToDraw}]`, el.x, el.y);
            }
        }

        // Draw interaction box if in editor mode (not generating)
        if (!customDataRow) {
            if (selectedElement && selectedElement.id === el.id) {
                // Selected box style
                ctx.strokeStyle = '#4f46e5';
                ctx.lineWidth = 3;
                ctx.setLineDash([]);
                ctx.strokeRect(el.x - width / 2 - 10, el.y - height / 2 - 10, width + 20, height + 20);

                // Selection handle/dot
                ctx.fillStyle = '#4f46e5';
                ctx.beginPath();
                ctx.arc(el.x - width / 2 - 10, el.y - height / 2 - 10, 5, 0, 2 * Math.PI);
                ctx.fill();
            } else {
                // Unselected box style
                ctx.strokeStyle = '#9ca3af';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(el.x - width / 2 - 10, el.y - height / 2 - 10, width + 20, height + 20);
            }
        }
    });
}

// Drag functionality
canvas.addEventListener('mousedown', (e) => {
    const mouseX = (e.offsetX * canvas.width) / canvas.clientWidth;
    const mouseY = (e.offsetY * canvas.height) / canvas.clientHeight;

    let clickedElement = null;

    // Find if we clicked on an element (checking backwards for top-most)
    for (let i = textElements.length - 1; i >= 0; i--) {
        const el = textElements[i];

        let width = 0;
        let height = 0;

        if (el.type === 'text') {
            ctx.font = `${el.fontSize}px "${el.fontFamily}"`;
            const metrics = ctx.measureText(el.text);
            width = metrics.width;
            height = el.fontSize;
        } else if (el.type === 'id-photo') {
            width = el.fontSize;
            const textToDraw = parsedData.length > 0 ? (parsedData[0][el.column] !== undefined ? parsedData[0][el.column] : el.text) : el.text;
            let cleanText = textToDraw ? textToDraw.toString().trim().toLowerCase() : '';
            cleanText = cleanText.replace(/\.[^/.]+$/, "");

            if (uploadedIdPhotos[cleanText]) {
                const img = uploadedIdPhotos[cleanText];
                height = (img.height / img.width) * width;
            } else {
                height = width; // default placeholder ratio for photo
            }
        } else { // type === 'image'
            width = el.fontSize; // fontSize stores width for images
            let sigKey = el.signatureKey || Object.keys(uploadedSignatures)[0];
            let img = sigKey ? uploadedSignatures[sigKey] : null;
            if (img) {
                height = (img.height / img.width) * width;
            } else {
                height = width / 2; // Placeholder ratio
            }
        }

        const left = el.x - width / 2 - 10;
        const right = el.x + width / 2 + 10;
        const top = el.y - height / 2 - 10;
        const bottom = el.y + height / 2 + 10;

        if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
            clickedElement = el;
            break; // Stop looking
        }
    }

    if (clickedElement) {
        isDragging = true;
        draggedElement = clickedElement;
        selectElement(clickedElement);
    } else {
        selectElement(null); // Clicked on empty canvas
    }

    renderCanvas();
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging && draggedElement) {
        draggedElement.x = (e.offsetX * canvas.width) / canvas.clientWidth;
        draggedElement.y = (e.offsetY * canvas.height) / canvas.clientHeight;
        renderCanvas();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    draggedElement = null;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    draggedElement = null;
});

// Generation Logic (PDF Creation and Zipping)
generateBtn.addEventListener('click', async () => {
    if (!templateImage || parsedData.length === 0 || textElements.length === 0) {
        alert("Please ensure template, data, and at least one text field are added.");
        return;
    }

    generateBtn.disabled = true;
    statusEl.textContent = `Generating 0 / ${parsedData.length}...`;
    statusEl.className = 'status processing';

    const zip = new JSZip();
    const folder = zip.folder("Certificates");

    // Format of jspdf: p/l, unit, size
    const orientation = canvas.width > canvas.height ? 'l' : 'p';

    // We process these one by one to avoid locking the UI completely
    for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        statusEl.textContent = `Generating ${i + 1} / ${parsedData.length}...`;

        // 1. Render data onto canvas
        renderCanvas(row);

        // 2. Convert canvas to image data URL (PNG preserves transparency)
        const imgData = canvas.toDataURL('image/png', 1.0);

        // 3. Create PDF
        const pdf = new jspdf.jsPDF({
            orientation: orientation,
            unit: 'px',
            format: [canvas.width, canvas.height]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

        // 4. Convert PDF to ArrayBuffer and add to Zip
        const pdfOutput = pdf.output('arraybuffer');

        // Determine filename (use first mapped column as primary name)
        let primaryName = row[textElements[0].column] || `Certificate_${i + 1}`;
        // Sanitize filename
        primaryName = primaryName.toString().replace(/[^a-z0-9]/gi, '_').toLowerCase();

        folder.file(`${primaryName}.pdf`, pdfOutput);

        // Tiny delay to let UI update
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Restore editor canvas
    renderCanvas();

    statusEl.textContent = "Zipping files... (this may take a moment)";

    // Generate Zip
    zip.generateAsync({ type: "blob" })
        .then(function (content) {
            saveAs(content, "generated_certificates.zip");
            statusEl.textContent = "Done! Download started.";
            statusEl.className = 'status success';
            generateBtn.disabled = false;
        })
        .catch((err) => {
            console.error(err);
            statusEl.textContent = "Error generating Zip file.";
            statusEl.className = 'status error';
            generateBtn.disabled = false;
        });
});
