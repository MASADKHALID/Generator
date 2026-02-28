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
let uploadedSignature = null; // The single static signature image object
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
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                uploadedSignature = img;
                renderCanvas(); // Re-render in case an image block is already on canvas
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
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

            // Extract the filename without the path (e.g. "folder/ali.jpg" -> "ali.jpg")
            const baseName = filename.split('/').pop().trim();

            // Read the image file as a Data URL instead of blob to avoid cross-browser blob URL issues in Canvas
            const dataUrl = await zipEntry.async("base64");
            const srcUrl = "data:image/" + (lowerName.endsWith('.png') ? 'png' : 'jpeg') + ";base64," + dataUrl;

            // Load into an Image object
            const img = new Image();
            img.onload = () => {
                uploadedIdPhotos[baseName] = img;
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
        fontFamily: 'Arial'
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

            // Check if we have the static uploaded signature
            if (uploadedSignature) {
                const img = uploadedSignature;
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

            // Clean up textToDraw just in case CSV has extra spaces compared to filenames
            const cleanText = textToDraw ? textToDraw.toString().trim() : '';

            // Check if we have an uploaded photo matching the row text
            if (uploadedIdPhotos[cleanText]) {
                const img = uploadedIdPhotos[cleanText];
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
            const cleanText = textToDraw ? textToDraw.toString().trim() : '';
            if (uploadedIdPhotos[cleanText]) {
                const img = uploadedIdPhotos[cleanText];
                height = (img.height / img.width) * width;
            } else {
                height = width; // default placeholder ratio for photo
            }
        } else { // type === 'image'
            width = el.fontSize; // fontSize stores width for images
            if (uploadedSignature) {
                const img = uploadedSignature;
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
