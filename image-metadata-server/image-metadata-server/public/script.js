document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("drop-zone");
    const imageInput = document.getElementById("imageInput");
    const gallery = document.getElementById("gallery");
    const previewImage = document.getElementById("preview-image");
    const metadataTable = document.querySelector(".metadata-table");
    
    // Filter-Elemente
    const filterInput = document.getElementById("filter-input");
    const filterType = document.getElementById("filter-type");
    const filterArtist = document.getElementById("filter-artist");
    const filterKeywords = document.getElementById("filter-keywords");
    const filterCopyright = document.getElementById("filter-copyright");
    const clearFilterBtn = document.getElementById("clear-filter");
    const toggleFiltersBtn = document.getElementById("toggle-filters");
    const sortBySelect = document.getElementById("sort-by");
    const sortOrderSelect = document.getElementById("sort-order");
    
    // Globale Variablen
    let allImages = [];
    let modifiedImages = new Set(); // Track geänderte Bilder
    let imageMetadataCache = {}; // Cache für Metadaten
    
    // Hilfsfunktion für RAW-Platzhalter
    function createRawPlaceholderDataURL(filename, fileExt, size = 200) {
        const baseName = filename.split('.')[0].substring(0, 15) + (filename.length > 15 ? '...' : '');
        const svg = `
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#f0f0f0;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e0e0e0;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="${size}" height="${size}" fill="url(#grad1)" stroke="#ccc" stroke-width="2" rx="8"/>
                <circle cx="${size/2}" cy="${size*0.35}" r="${size*0.125}" fill="#2ABDBD" opacity="0.3"/>
                <text x="${size/2}" y="${size*0.38}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size*0.08}" fill="#2ABDBD" font-weight="bold">CAM</text>
                <text x="${size/2}" y="${size*0.55}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size*0.07}" fill="#666" font-weight="bold">RAW ${fileExt.toUpperCase()}</text>
                <text x="${size/2}" y="${size*0.65}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size*0.05}" fill="#999">Vorschau nicht verfuegbar</text>
                <text x="${size/2}" y="${size*0.8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size*0.04}" fill="#aaa">${baseName}</text>
            </svg>
        `;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    // Fokussiere Karte und öffne Popup für bestimmtes Bild
    async function focusMapOnImage(filename) {
        if (!map || !filename) return;
        const marker = markersByFilename[filename];
        if (marker) {
            const latlng = marker.getLatLng();
            map.flyTo(latlng, Math.max(map.getZoom(), 13), { duration: 0.8 });
            marker.openPopup();
            return;
        }
        // Fallback: versuche GPS-Koordinaten aus Metadaten
        try {
            const md = await getImageMetadata(filename);
            const lat = parseFloat(md.GPSLatitude);
            const lon = parseFloat(md.GPSLongitude);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                map.flyTo([lat, lon], Math.max(map.getZoom(), 13), { duration: 0.8 });
            }
        } catch (_) {}
    }

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#007d7d";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "#2ABDBD";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#2ABDBD";
        handleFiles(e.dataTransfer.files);
    });

    imageInput.addEventListener("change", (e) => {
        handleFiles(e.target.files);
    });

    async function handleFiles(fileList) {
        // Upload-Fortschrittsanzeige anzeigen
        showUploadProgress(fileList);
        
        const formData = new FormData();
        for (let file of fileList) {
            formData.append("images", file);
        }

        try {
            const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

            if (response.ok) {
                updateUploadProgress(100, "Upload abgeschlossen!");
                setTimeout(() => {
                    hideUploadProgress();
                    loadGallery();
                    // Karte aktualisieren (neue Pins)
                    refreshMap();
                }, 1500);
            } else {
                updateUploadProgress(0, "Upload fehlgeschlagen!");
                setTimeout(() => {
                    hideUploadProgress();
                }, 3000);
            }
        } catch (error) {
            updateUploadProgress(0, "Upload fehlgeschlagen!");
            setTimeout(() => {
                hideUploadProgress();
            }, 3000);
        }

        imageInput.value = "";
    }

    function showUploadProgress(fileList) {
        const progressContainer = document.getElementById("upload-progress");
        const progressText = progressContainer.querySelector(".progress-text");
        const progressPercentage = progressContainer.querySelector(".progress-percentage");
        const progressFill = document.getElementById("progress-fill");
        const uploadFiles = document.getElementById("upload-files");

        // Fortschrittsanzeige anzeigen
        progressContainer.style.display = "block";
        progressText.textContent = "Upload läuft...";
        progressPercentage.textContent = "0%";
        progressFill.style.width = "0%";

        // Dateiliste anzeigen
        uploadFiles.innerHTML = "";
        Array.from(fileList).forEach((file, index) => {
            const fileItem = document.createElement("div");
            fileItem.className = "upload-file-item";
            fileItem.innerHTML = `
                <span class="upload-file-name">${file.name}</span>
                <span class="upload-file-status processing">Wird hochgeladen...</span>
            `;
            uploadFiles.appendChild(fileItem);
        });
    }

    function updateUploadProgress(percentage, status) {
        const progressText = document.querySelector(".progress-text");
        const progressPercentage = document.querySelector(".progress-percentage");
        const progressFill = document.getElementById("progress-fill");
        const statusElements = document.querySelectorAll(".upload-file-status");

        progressText.textContent = status;
        progressPercentage.textContent = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;

        // Status aller Dateien aktualisieren
        statusElements.forEach(element => {
            if (percentage === 100) {
                element.textContent = "Erfolgreich hochgeladen";
                element.className = "upload-file-status success";
            } else if (percentage === 0) {
                element.textContent = "Fehler beim Upload";
                element.className = "upload-file-status error";
            }
        });
    }

    function hideUploadProgress() {
        const progressContainer = document.getElementById("upload-progress");
        progressContainer.style.display = "none";
    }

    // Filter-Funktionen
    function initializeFilters() {
        // Event Listener für Filter-Input (mit Debouncing)
        let filterTimeout;
        filterInput.addEventListener("input", () => {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(applyFilters, 300);
        });
        
        // Event Listener für alle Filter
        filterType.addEventListener("change", applyFilters);
        filterArtist.addEventListener("change", applyFilters);
        filterKeywords.addEventListener("change", applyFilters);
        filterCopyright.addEventListener("change", applyFilters);
        if (sortBySelect) sortBySelect.addEventListener("change", () => { reloadWithSort(); });
        if (sortOrderSelect) sortOrderSelect.addEventListener("change", () => { reloadWithSort(); });
        
        // Event Listener für Buttons
        clearFilterBtn.addEventListener("click", clearFilters);
        toggleFiltersBtn.addEventListener("click", toggleAdvancedFilters);
        
        // Lade Filter-Optionen
        populateFilterOptions();
    }

    async function reloadWithSort() {
        // rendere Galerie neu, damit Sortierung greift (Filter bleiben aktiv, da sie DOM-basiert sind)
        await loadGallery();
        await applyFilters();
    }
    
    function toggleAdvancedFilters() {
        const filterSection = document.querySelector('.filter-section');
        filterSection.classList.toggle('expanded');
        toggleFiltersBtn.classList.toggle('active');
        
        if (filterSection.classList.contains('expanded')) {
            toggleFiltersBtn.textContent = '⬆️ Weniger Filter';
        } else {
            toggleFiltersBtn.textContent = '⚙️ Erweiterte Filter';
        }
    }
    
    async function populateFilterOptions() {
        try {
            // Hole alle verfügbaren Metadaten-Werte
            const response = await fetch('/api/filter-options');
            if (response.ok) {
                const options = await response.json();
                
                // Befülle Artist-Filter (flache Arrays)
                populateSelectOptions(filterArtist, options.artists.flat() || []);
                populateSelectOptions(filterKeywords, options.keywords || []);
                populateSelectOptions(filterCopyright, options.copyrights.flat() || []);
            }
        } catch (error) {
            console.log('Filter-Optionen konnten nicht geladen werden:', error);
            // Deaktiviere erweiterte Filter bei Fehler
            toggleFiltersBtn.style.display = 'none';
        }
    }
    
    function populateSelectOptions(selectElement, options) {
        // Entferne alle Optionen außer der ersten ("Alle...")
        while (selectElement.children.length > 1) {
            selectElement.removeChild(selectElement.lastChild);
        }
        
        // Füge neue Optionen hinzu
        options.forEach(option => {
            if (option && option.trim()) {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                selectElement.appendChild(optionElement);
            }
        });
    }
    
    async function applyFilters() {
        const searchTerm = filterInput.value.toLowerCase().trim();
        const formatFilter = filterType.value;
        const artistFilter = filterArtist.value;
        const keywordsFilter = filterKeywords.value;
        const copyrightFilter = filterCopyright.value;
        
        let visibleCount = 0;
        
        // Durchlaufe alle Galerie-Items
        const galleryItems = gallery.querySelectorAll('.gallery-item');
        
        for (const item of galleryItems) {
            const filename = item.querySelector('.filename').textContent;
            const dateText = item.querySelector('.date').textContent || '';
            const checkbox = item.querySelector('.multi-select-checkbox');
            const fileExt = filename.split('.').pop().toLowerCase();
            
            let shouldShow = true;
            
            // Format-Filter anwenden
            if (formatFilter !== 'all') {
                if (formatFilter === 'raw' && !['dng', 'nef', 'cr2', 'arw', 'orf', 'rw2'].includes(fileExt)) {
                    shouldShow = false;
                } else if (formatFilter === 'jpg' && !['jpg', 'jpeg'].includes(fileExt)) {
                    shouldShow = false;
                } else if (formatFilter === 'png' && fileExt !== 'png') {
                    shouldShow = false;
                }
            }
            
            // Metadaten-Filter anwenden (nur wenn erweiterte Filter aktiv)
            if (shouldShow && (artistFilter !== 'all' || keywordsFilter !== 'all' || copyrightFilter !== 'all')) {
                const metadata = await getImageMetadata(filename);
                
                if (artistFilter !== 'all') {
                    const artistValue = Array.isArray(metadata.Artist) ? metadata.Artist.join(', ') : (metadata.Artist || '');
                    if (!artistValue || artistValue !== artistFilter) {
                        shouldShow = false;
                    }
                }
                
                if (keywordsFilter !== 'all') {
                    let kws = metadata.Keywords || [];
                    if (typeof kws === 'string') {
                        kws = kws.split(',').map(k => k.trim()).filter(Boolean);
                    }
                    if (!Array.isArray(kws) || !kws.some(k => k === keywordsFilter)) {
                        shouldShow = false;
                    }
                }
                
                if (copyrightFilter !== 'all') {
                    const cr = Array.isArray(metadata.Copyright) ? metadata.Copyright.join(', ') : (metadata.Copyright || '');
                    if (!cr || cr !== copyrightFilter) {
                        shouldShow = false;
                    }
                }
            }
            
            // Text-Filter anwenden
            if (shouldShow && searchTerm) {
                const searchableText = `${filename} ${dateText}`.toLowerCase();
                shouldShow = searchableText.includes(searchTerm);
            }
            
            // Item anzeigen/verstecken
            if (shouldShow) {
                item.classList.remove('hidden');
                visibleCount++;
            } else {
                item.classList.add('hidden');
                // Checkbox deaktivieren bei versteckten Items
                if (checkbox) checkbox.checked = false;
            }
        }
        
        // Statistiken aktualisieren
        updateFilterStats(visibleCount, galleryItems.length);
        updateMultiSelectButton();
    }
    
    async function getImageMetadata(filename) {
        if (!imageMetadataCache[filename]) {
            try {
                const response = await fetch(`/api/metadata/${encodeURIComponent(filename)}`);
                if (response.ok) {
                    const payload = await response.json();
                    // Server gibt { source, data } zurück – wir cachen nur die Daten
                    imageMetadataCache[filename] = payload && payload.data ? payload.data : {};
                } else {
                    imageMetadataCache[filename] = {};
                }
            } catch (error) {
                imageMetadataCache[filename] = {};
            }
        }
        return imageMetadataCache[filename];
    }
    
    function clearFilters() {
        filterInput.value = '';
        filterType.value = 'all';
        filterArtist.value = 'all';
        filterKeywords.value = 'all';
        filterCopyright.value = 'all';
        applyFilters();
    }
    
    // Änderungsverfolgung
    function markImageAsModified(filename) {
        modifiedImages.add(filename);
        
        // Finde das entsprechende Galerie-Item
        const galleryItems = gallery.querySelectorAll('.gallery-item');
        galleryItems.forEach(item => {
            const itemFilename = item.querySelector('.filename').textContent;
            if (itemFilename === filename) {
                item.classList.add('modified');
            }
        });
        
        // Cache leeren für geänderte Datei
        delete imageMetadataCache[filename];
    }
    
    function updatePreviewWithChanges(filename, metadata) {
        // Aktualisiere Metadaten-Tabelle mit Änderungsmarkierungen
        const rows = metadataTable.querySelectorAll('tr');
        rows.forEach(row => {
            const cell = row.cells[0];
            if (cell) {
                const fieldName = cell.textContent.replace(/\s+/g, '');
                const valueCell = row.cells[1];
                
                // Entferne alte Änderungsmarkierungen
                row.classList.remove('modified');
                const existingIndicator = valueCell.querySelector('.change-indicator');
                if (existingIndicator) {
                    existingIndicator.remove();
                }
                
                // Prüfe ob Feld geändert wurde
                if (modifiedImages.has(filename) && metadata[fieldName]) {
                    row.classList.add('modified');
                    const indicator = document.createElement('span');
                    indicator.className = 'change-indicator';
                    indicator.textContent = 'GEÄNDERT';
                    valueCell.appendChild(indicator);
                }
            }
        });
    }

    // Aktualisiert den sichtbaren Titel eines Galerie-Items, wenn "Title" gesetzt wurde
    function updateGalleryTitle(filename, newTitle) {
        const galleryItems = gallery.querySelectorAll('.gallery-item');
        const cleanTitle = (newTitle || '').toString().trim();
        galleryItems.forEach(item => {
            const itemFilename = item.dataset.filename || (item.querySelector('.filename')?.textContent) || '';
            if (itemFilename === filename) {
                const nameEl = item.querySelector('.filename');
                if (nameEl) {
                    const display = cleanTitle !== '' ? cleanTitle : filename;
                    nameEl.textContent = display;
                    // Für spätere Sortierung nach Name aktualisieren
                    item.dataset.nameKey = display.toLowerCase();
                }
            }
        });
        // Cache aktualisieren
        imageMetadataCache[filename] = imageMetadataCache[filename] || {};
        if (cleanTitle !== '') {
            imageMetadataCache[filename].Title = cleanTitle;
        } else {
            delete imageMetadataCache[filename].Title;
        }
    }
    
    function updateFilterStats(visible, total) {
        // Entferne alte Statistiken
        const existingStats = gallery.querySelector('.filter-stats');
        if (existingStats) {
            existingStats.remove();
        }
        
        // Füge neue Statistiken hinzu (nur wenn gefiltert)
        if (visible !== total) {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'filter-stats';
            statsDiv.textContent = `${visible} von ${total} Bildern angezeigt`;
            gallery.appendChild(statsDiv);
        }
    }

    async function loadGallery() {
        gallery.innerHTML = "";
        const res = await fetch("/api/images");
        const files = await res.json();
        
        // Speichere alle Bilder für Filterung
        allImages = files;

        // Vorbereiten: Metadaten parallel laden
        const metadataPromises = files.map(async (filename) => ({ filename, metadata: await getImageMetadata(filename) }));
        const fileWithMetadata = await Promise.all(metadataPromises);

        // Sortierung vor dem Rendern anwenden
        const sorted = sortFiles(fileWithMetadata);

        sorted.forEach(({ filename, metadata }) => {
            const item = document.createElement("div");
            item.className = "gallery-item";

            const img = document.createElement("img");
            const fileExt = filename.split('.').pop().toLowerCase();
            
            // Intelligente Bildanzeige: Thumbnails über Backend-Endpoint
            img.src = `/api/thumbnail/${encodeURIComponent(filename)}`;
            img.addEventListener("error", () => {
                // Letzter Fallback: Direktes Original (für Nicht-RAW)
                img.src = `/uploads/${encodeURIComponent(filename)}`;
            });
            
            img.alt = filename;
            img.addEventListener("click", () => {
                // Preview nutzt ebenfalls Thumbnail, bei Fehler direkt Original
                previewImage.src = `/api/thumbnail/${encodeURIComponent(filename)}`;
                previewImage.addEventListener("error", () => {
                    previewImage.src = `/uploads/${encodeURIComponent(filename)}`;
                });
                loadMetadata(filename);
                // Karte fokussieren, falls Marker vorhanden
                focusMapOnImage(filename);
            });

            // Checkbox für Mehrfachauswahl
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "multi-select-checkbox";
            checkbox.value = filename;
            checkbox.addEventListener("change", updateMultiSelectButton);

            const textBlock = document.createElement("div");
            textBlock.className = "gallery-text";

            const fileNameEl = document.createElement("div");
            fileNameEl.className = "filename";
            // Titel bevorzugen, wenn vorhanden
            const titleRaw = metadata && metadata.Title;
            const titleStr = Array.isArray(titleRaw) ? (titleRaw[0] || '') : (titleRaw || '');
            const displayTitle = titleStr && String(titleStr).trim() ? String(titleStr).trim() : filename;
            fileNameEl.textContent = displayTitle;

            const dateEl = document.createElement("div");
            dateEl.className = "date";
            const { captureDate, uploadDate } = getDatesForDisplay(filename, metadata);
            // Speichere Daten als Attribute für spätere Sortierung ohne Re-Parsing
            item.dataset.captureDate = captureDate ? captureDate.toISOString() : '';
            item.dataset.uploadDate = uploadDate.toISOString();
            item.dataset.nameKey = displayTitle.toLowerCase();
            item.dataset.filename = filename;
            // Anzeige: Aufnahmedatum falls vorhanden, sonst Uploaddatum
            const displayDate = captureDate || uploadDate;
            dateEl.textContent = displayDate.toLocaleDateString("de-DE", { year: 'numeric', month: '2-digit', day: '2-digit' });

            textBlock.appendChild(fileNameEl);
            textBlock.appendChild(dateEl);

            // Icon-Container für die drei Aktionen
            const iconContainer = document.createElement("div");
            iconContainer.className = "icon-container";

            // Download Icon
            const downloadBtn = document.createElement("button");
            downloadBtn.className = "icon-btn download-btn";
            downloadBtn.innerHTML = "⬇";
            downloadBtn.title = "Herunterladen";
            downloadBtn.onclick = () => {
                openDownloadModal(filename);
            };

            // Edit Icon
            const editBtn = document.createElement("button");
            editBtn.className = "icon-btn edit-btn";
            editBtn.innerHTML = "✏";
            editBtn.title = "Bearbeiten";
            editBtn.onclick = () => {
                editMetadata(filename);
            };

            // Delete Icon
            const delBtn = document.createElement("button");
            delBtn.className = "icon-btn delete-btn";
            delBtn.innerHTML = "🗑";
            delBtn.title = "Löschen";
            delBtn.onclick = async () => {
                if (confirm('Möchten Sie diese Datei wirklich löschen?')) {
                await fetch(`/api/images/${filename}`, { method: "DELETE" });
                loadGallery();
                // Entferne Marker/Location und refreshe Karte
                const marker = markersByFilename[filename];
                if (marker && mapMarkersGroup) {
                    mapMarkersGroup.removeLayer(marker);
                    delete markersByFilename[filename];
                    delete mapLocationsByFilename[filename];
                }
                refreshMap();
                }
            };

            iconContainer.appendChild(downloadBtn);
            iconContainer.appendChild(editBtn);
            iconContainer.appendChild(delBtn);

            item.appendChild(checkbox);
            item.appendChild(img);
            item.appendChild(textBlock);
            item.appendChild(iconContainer);

            gallery.appendChild(item);
        });

        // Füge Mehrfachauswahl-Button hinzu
        addMultiSelectButton();
    }

    function getDatesForDisplay(filename, metadata) {
        // Aufnahmedatum aus Metadaten (häufige Felder)
        const captureCandidates = [
            metadata['DateTimeOriginal'],
            metadata['CreateDate'],
            metadata['Date Created'],
            metadata['ModifyDate'],
            metadata['SubSecDateTimeOriginal'],
        ].filter(Boolean);

        let captureDate = null;
        for (const val of captureCandidates) {
            const d = parseExifDate(val);
            if (d) { captureDate = d; break; }
        }

        // Uploaddatum heuristisch aus Prefix (Timestamp-) oder Fallback: File System nicht verfügbar, daher Date.now() Ersatz
        // Unsere Dateinamen beginnen mit einem Timestamp gefolgt von '-' → extrahiere den ersten Block als Zahl
        let uploadDate = new Date();
        const tsPrefix = String(filename).split('-')[0];
        if (/^\d{13}$/.test(tsPrefix)) {
            const ms = Number(tsPrefix);
            if (!Number.isNaN(ms)) uploadDate = new Date(ms);
        }

        return { captureDate, uploadDate };
    }

    function parseExifDate(value) {
        if (!value) return null;
        // ExifTool-vendored liefert häufig ExifDateTime-Objekte
        if (typeof value === 'object') {
            // Bevorzugt rawValue
            if (value.rawValue) {
                return parseExifDate(value.rawValue);
            }
            // Zusammensetzen aus Feldern
            if (value.year && value.month && value.day) {
                const year = Number(value.year);
                const month = Number(value.month);
                const day = Number(value.day);
                const hour = Number(value.hour || 0);
                const minute = Number(value.minute || 0);
                const second = Number(value.second || 0);
                let date = new Date(Date.UTC(year, (month || 1) - 1, day || 1, hour, minute, second));
                if (typeof value.tzoffsetMinutes === 'number') {
                    // tzoffsetMinutes: +120 => UTC+2 → lokale Zeit = UTC + 120 → für Anzeige korrigieren
                    date = new Date(date.getTime() - (value.tzoffsetMinutes * 60000));
                }
                return isNaN(date.getTime()) ? null : date;
            }
            // Fallback: toString()
            value = value.toString();
        }
        // mögliche String-Formate: '2024:09:02 13:45:10', '2024-09-02T13:45:10Z', '2024:09:02 13:45:10+02:00'
        let v = String(value).trim();
        if (/^\d{4}:\d{2}:\d{2}/.test(v)) {
            v = v.replace(/^([0-9]{4}):([0-9]{2}):([0-9]{2})/, '$1-$2-$3');
        }
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }

    function sortFiles(fileWithMetadata) {
        const sortBy = sortBySelect ? sortBySelect.value : 'capture';
        const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'desc';
        const dir = sortOrder === 'asc' ? 1 : -1;

        return [...fileWithMetadata].sort((a, b) => {
            const aDates = getDatesForDisplay(a.filename, a.metadata);
            const bDates = getDatesForDisplay(b.filename, b.metadata);
            let cmp = 0;
            if (sortBy === 'name') {
                cmp = a.filename.toLowerCase().localeCompare(b.filename.toLowerCase());
            } else if (sortBy === 'upload') {
                cmp = (aDates.uploadDate.getTime() - bDates.uploadDate.getTime());
            } else {
                const at = (aDates.captureDate || aDates.uploadDate).getTime();
                const bt = (bDates.captureDate || bDates.uploadDate).getTime();
                cmp = at - bt;
            }
            return dir * cmp;
        });
    }

    async function loadMetadata(filename) {
        const res = await fetch(`/api/metadata/${filename}`);
        const result = await res.json();
        const data = result.data || {};

        metadataTable.innerHTML = "";
        Object.entries(data).forEach(([key, value]) => {
            const row = document.createElement("tr");
            const keyCell = document.createElement("td");
            keyCell.textContent = key;
            const valueCell = document.createElement("td");
            // Datumsfelder zuerst formatieren, danach generische Darstellung
            const dateKeys = ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'SubSecDateTimeOriginal', 'Date Created'];
            let displayValue;
            if (dateKeys.includes(key)) {
                const parsed = parseExifDate(value);
                if (parsed) {
                    displayValue = parsed.toLocaleString('de-DE');
                }
            }
            // Falls kein Datum erkannt/parsbar, generische String-Darstellung
            if (displayValue === undefined) {
                displayValue = convertToString(value);
                if ((!displayValue || displayValue === '') && value && typeof value === 'object') {
                    try { displayValue = JSON.stringify(value); } catch (_) { displayValue = String(value); }
                }
            }
            valueCell.textContent = displayValue;
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            metadataTable.appendChild(row);
        });
    }

    async function editMetadata(filename) {
        // Lade aktuelle Metadaten
        const res = await fetch(`/api/metadata/${filename}`);
        const result = await res.json();
        const data = result.data || {};

        // Erstelle alle potentiellen Metadaten-Felder
        const allFields = createAllMetadataFields(data);
        
        // Erstelle Modal für Bearbeitung
        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Metadaten bearbeiten: ${filename}</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="edit-form">
                        ${generateFormFields(allFields, false)}
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancel-btn">Abbrechen</button>
                    <button type="button" class="btn btn-primary" id="save-btn">Speichern</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Initialisiere Autocomplete sofort nach DOM-Insertion
        console.log('🚀 Einzelbearbeitung-Modal hinzugefügt, initialisiere Autocomplete...');
        initializeAutocomplete(modal);

        // Event-Handler für Modal
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        const saveMetadata = async () => {
            const form = document.getElementById('edit-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Entferne leere Felder und bereinige Daten
            const cleanData = {};
            Object.entries(data).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value.toString().trim() !== '') {
                    cleanData[key] = value.toString().trim();
                }
            });

            console.log('Bereinigte Daten:', cleanData);
            console.log('Anzahl Felder:', Object.keys(cleanData).length);

            // Prüfe ob überhaupt Daten vorhanden sind
            if (Object.keys(cleanData).length === 0) {
                showNotification('Keine gültigen Metadaten zum Speichern gefunden. Bitte fülle mindestens ein Feld aus.', 'error');
                return;
            }

            // Zeige Lade-Indikator
            const saveBtn = modal.querySelector('#save-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Speichere...';
            saveBtn.disabled = true;

            try {
                console.log('Sende Daten:', cleanData);
                
                const response = await fetch(`/api/metadata/${filename}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(cleanData)
                });

                if (!response.ok) {
                    // Versuche detaillierte Fehlermeldung zu bekommen
                    let errorDetails = '';
                    try {
                        const errorData = await response.json();
                        errorDetails = errorData.error || 'Unbekannter Fehler';
                        if (errorData.receivedFields) {
                            errorDetails += `\nEmpfangene Felder: ${errorData.receivedFields.join(', ')}`;
                        }
                        if (errorData.allowedFields) {
                            errorDetails += `\nErlaubte Felder: ${errorData.allowedFields.slice(0, 5).join(', ')}...`;
                        }
                    } catch (e) {
                        errorDetails = `HTTP ${response.status}: ${response.statusText}`;
                    }
                    throw new Error(errorDetails);
                }

                const result = await response.json();
                console.log('Metadaten gespeichert:', result);
                
                closeModal();
                
                // Aktualisiere die Metadaten-Anzeige mit den neuen Daten
                await loadMetadata(filename);
                
                // Zeige Erfolgsmeldung
                showNotification('Metadaten erfolgreich in die Bilddatei geschrieben!', 'success');
                // Falls Titel gesetzt, direkt in der Galerie aktualisieren
                if (cleanData.Title !== undefined) {
                    updateGalleryTitle(filename, cleanData.Title);
                }
                // Falls Künstler geändert, aktualisiere Marker-Popup
                if (cleanData.Artist !== undefined) {
                    const loc = mapLocationsByFilename[filename];
                    const marker = markersByFilename[filename];
                    if (marker && loc) {
                        await setMarkerPopupFromMetadata(marker, filename, loc);
                        // Popup neu öffnen, falls dieses Bild gerade fokussiert ist
                        marker.openPopup();
                    }
                }
                
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                
                // Versuche detaillierte Fehlermeldung zu extrahieren
                let errorMessage = error.message;
                try {
                    const errorResponse = await error.response?.json();
                    if (errorResponse?.error) {
                        errorMessage = errorResponse.error;
                        if (errorResponse.allowedFields) {
                            errorMessage += '\n\nErlaubte Felder: ' + errorResponse.allowedFields.slice(0, 10).join(', ') + '...';
                        }
                    }
                } catch (e) {
                    // Fallback zur ursprünglichen Fehlermeldung
                }
                
                showNotification('Fehler beim Speichern: ' + errorMessage, 'error');
            } finally {
                // Stelle Button wieder her
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        };

        // Event-Listener hinzufügen
        modal.querySelector('.close').addEventListener('click', closeModal);
        modal.querySelector('#cancel-btn').addEventListener('click', closeModal);
        modal.querySelector('#save-btn').addEventListener('click', saveMetadata);
        
        // Schließe Modal beim Klick außerhalb
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Schließe Modal mit Escape-Taste
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Hilfsfunktion zum Escapen von HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Erstelle alle potentiellen Metadaten-Felder (gefüllt und leer)
    function createAllMetadataFields(data) {
        // Alle möglichen Metadaten-Felder
        const allPossibleFields = [
            'Title', 'Object Name', 'Description', 'Caption-Abstract', 'Keywords',
            'Artist', 'Creator', 'Copyright', 'Credit', 'Source', 'Date', 'Date Created',
            'Location', 'City', 'Country', 'State', 'Province', 'Subject', 'Category',
            'Supplemental Categories', 'Urgency', 'Instructions', 'By-line', 'By-line Title',
            'Contact', 'Transmission Reference', 'Headline', 'Caption Writer', 'Rights Usage Terms',
            'Creator Tool', 'Rating', 'Label', 'Person In Image', 'Event', 'Intellectual Genre',
            'Location Shown', 'World Region', 'Country Code', 'Province State', 'City',
            'Sublocation', 'Scene', 'Image Orientation', 'Image Creator', 'Image Credit',
            'Image Source', 'Image Copyright Notice', 'Image Rights Usage Terms',
            'Image Creator Address', 'Image Creator City', 'Image Creator Region',
            'Image Creator Postal Code', 'Image Creator Country', 'Image Creator Work Email',
            'Image Creator Work Phone', 'Image Creator Work URL', 'Image Creator Work Tel',
            'Image Creator Work Ext', 'Image Creator Work City', 'Image Creator Work Region',
            'Image Creator Work Postal Code', 'Image Creator Work Country'
        ];

        // Felder die aus Datenschutz-/Konsistenzgründen nicht editierbar sind
        const nonEditableFields = [
            'Make', 'Model', 'Software', 'FirmwareVersion', 'SerialNumber', 'LensType',
            'LensID', 'LensSpec', 'LensIDNumber', 'LensFStops', 'MinFocalLength', 'MaxFocalLength',
            'MaxApertureAtMinFocal', 'MaxApertureAtMaxFocal', 'MCUVersion', 'EffectiveMaxAperture',
            'ExposureTime', 'FNumber', 'ExposureProgram', 'ISO', 'SensitivityType', 'RecommendedExposureIndex',
            'ExposureCompensation', 'MaxApertureValue', 'MeteringMode', 'LightSource', 'Flash',
            'FocalLength', 'FocalLengthIn35mmFormat', 'Aperture', 'ShutterSpeed', 'WhiteBalance',
            'FocusMode', 'FlashSetting', 'FlashType', 'WB_RBLevels', 'ProgramShift', 'ExposureDifference',
            'FlashExposureComp', 'ExternalFlashExposureComp', 'FlashExposureBracketValue', 'ExposureBracketValue',
            'CropHiSpeed', 'ExposureTuning', 'ColorSpace', 'VRInfoVersion', 'VibrationReduction', 'VRMode',
            'ActiveD-Lighting', 'PictureControlVersion', 'PictureControlName', 'PictureControlBase',
            'PictureControlAdjust', 'PictureControlQuickAdjust', 'Clarity', 'Brightness', 'Hue',
            'FilterEffect', 'ToningEffect', 'ToningSaturation', 'TimeZone', 'DaylightSavings',
            'DateDisplayFormat', 'ISOExpansion', 'ISO2', 'ISOExpansion2', 'VignetteControl',
            'AutoDistortionControl', 'BlackLevel', 'ImageSizeRAW', 'WhiteBalanceFineTune', 'CropArea',
            'ISOAutoShutterTime', 'FlickerReductionShooting', 'FlickerReductionIndicator',
            'MovieISOAutoControlManualMode', 'MovieWhiteBalanceSameAsPhoto', 'ImageWidth', 'ImageHeight',
            'BitsPerSample', 'Compression', 'XResolution', 'YResolution', 'ResolutionUnit',
            'CFARepeatPatternDim', 'CFAPattern', 'CFAPattern2', 'StripOffsets', 'StripByteCounts',
            'RowsPerStrip', 'SamplesPerPixel', 'PlanarConfiguration', 'ReferenceBlackWhite',
            'XMPToolkit', 'JpgFromRawStart', 'JpgFromRawLength', 'YCbCrPositioning',
            'SubfileType', 'OtherImageStart', 'OtherImageLength', 'PreviewImageStart',
            'PreviewImageLength', 'JpgFromRaw', 'OtherImage', 'PreviewImage',
            'ThumbnailTIFF', 'ContrastCurve', 'NEFLinearizationTable', 'ColorBalanceVersion',
            'LensDataVersion', 'RawImageCenter', 'RetouchHistory', 'FlashInfoVersion',
            'MultiExposureVersion', 'AFInfo2Version', 'FileInfoVersion', 'RetouchInfoVersion',
            'GPSVersionID', 'TIFF-EPStandardID', 'ScaleFactor35efl', 'CircleOfConfusion',
            'DOF', 'FOV', 'FocalLength35efl', 'HyperfocalDistance', 'LightValue',
            'FileModifyDate', 'FileAccessDate', 'FileInodeChangeDate', 'FilePermissions',
            'ModifyDate', 'CreateDate', 'DateTimeOriginal', 'SubSecTime', 'SubSecTimeOriginal',
            'SubSecTimeDigitized', 'SubSecCreateDate', 'SubSecDateTimeOriginal', 'SubSecModifyDate',
            'PowerUpTime', 'FileNumberSequence', 'FramingGridDisplay', 'LCDIllumination',
            'OpticalVR', 'FlashShutterSpeed', 'FlashExposureCompArea', 'AutoFlashISOSensitivity',
            'AssignBktButton', 'MultiSelectorLiveView', 'CmdDialsChangeMainSub', 'CmdDialsMenuAndPlayback',
            'SubDialFrameAdvance', 'ReleaseButtonToUseDial', 'ReverseIndicators', 'MovieShutterButton',
            'Language', 'FlickAdvanceDirection', 'HDMIOutputResolution', 'HDMIOutputRange',
            'CmdDialsReverseRotation', 'FlashMode', 'ShootingMode', 'ShotInfoVersion',
            'RollAngle', 'PitchAngle', 'YawAngle', 'NEFCompression', 'NoiseReduction',
            'ExitPupilPosition', 'AFAperture', 'FocusPosition', 'FocusDistance', 'RawImageCenter',
            'ShutterCount', 'FlashSource', 'ExternalFlashFirmware', 'ExternalFlashZoomOverride',
            'ExternalFlashStatus', 'ExternalFlashReadyState', 'FlashCompensation', 'FlashGNDistance',
            'FlashGroupAControlMode', 'FlashGroupBControlMode', 'FlashGroupCControlMode',
            'FlashGroupACompensation', 'FlashGroupBCompensation', 'FlashGroupCCompensation',
            'VariProgram', 'MultiExposureMode', 'MultiExposureShots', 'MultiExposureAutoGain',
            'HighISONoiseReduction', 'PowerUpTime', 'AFDetectionMethod', 'AFAreaMode',
            'FocusPointSchema', 'AFPointsUsed', 'AFPointsInFocus', 'PrimaryAFPoint',
            'MemoryCardNumber', 'DirectoryNumber', 'FileNumber', 'AFFineTune', 'AFFineTuneIndex',
            'AFFineTuneAdj', 'AFFineTuneAdjTele', 'RetouchNEFProcessing', 'SilentPhotography',
            'UserComment', 'SubSecTime', 'SubSecTimeOriginal', 'SubSecTimeDigitized',
            'SensingMethod', 'FileSource', 'SceneType', 'CustomRendered', 'ExposureMode',
            'SceneCaptureType', 'GainControl', 'Contrast', 'Saturation', 'Sharpness',
            'SubjectDistanceRange', 'DateTimeOriginal', 'TIFF-EPStandardID', 'BlueBalance',
            'CFAPattern', 'ImageSize', 'JpgFromRaw', 'Megapixels', 'OtherImage', 'PreviewImage',
            'RedBalance', 'ScaleFactor35efl', 'SubSecCreateDate', 'SubSecDateTimeOriginal',
            'SubSecModifyDate', 'ThumbnailTIFF', 'AutoFocus', 'ContrastDetectAF', 'PhaseDetectAF',
            'SourceFile', 'FileName', 'Directory', 'FileSize', 'FileType', 'FileTypeExtension', 'MIMEType',
            'ExifByteOrder', 'errors', 'warnings', 'ExifToolVersion', 'tz', 'tzSource', 'Orientation'
        ];

        const allFields = {};

        // Füge alle möglichen Felder hinzu
        allPossibleFields.forEach(field => {
            const isNonEditable = nonEditableFields.includes(field);
            
            if (data[field]) {
                // Feld hat bereits einen Wert
                let stringValue = convertToString(data[field]);
                if (stringValue && stringValue.trim() !== '') {
                    allFields[field] = {
                        value: stringValue,
                        hasValue: true,
                        isEditable: !isNonEditable
                    };
                } else {
                    // Feld existiert aber ist leer
                    allFields[field] = {
                        value: '',
                        hasValue: false,
                        isEditable: !isNonEditable
                    };
                }
            } else {
                // Feld existiert nicht - füge als leeres Feld hinzu
                allFields[field] = {
                    value: '',
                    hasValue: false,
                    isEditable: !isNonEditable
                };
            }
        });

        // Füge auch andere vorhandene Felder hinzu, die nicht in der Liste stehen
        Object.entries(data).forEach(([key, value]) => {
            if (!shouldSkipField(key, value) && !allPossibleFields.includes(key)) {
                const isNonEditable = nonEditableFields.includes(key);
                let stringValue = convertToString(value);
                if (stringValue && stringValue.trim() !== '') {
                    allFields[key] = {
                        value: stringValue,
                        hasValue: true,
                        isEditable: !isNonEditable
                    };
                }
            }
        });

        return allFields;
    }

    // Prüfe ob Feld übersprungen werden soll
    function shouldSkipField(key, value) {
        // Felder die NIEMALS editierbar sein sollten
        const nonEditableFields = [
            // Datei-Informationen
            'SourceFile', 'FileName', 'Directory', 'FileSize', 'FileType', 'FileTypeExtension', 'MIMEType',
            'FileModifyDate', 'FileAccessDate', 'FileInodeChangeDate', 'FilePermissions',
            
            // Technische EXIF-Daten
            'ExifByteOrder', 'ImageWidth', 'ImageHeight', 'BitsPerSample', 'Compression',
            'XResolution', 'YResolution', 'ResolutionUnit', 'CFARepeatPatternDim',
            'CFAPattern', 'CFAPattern2', 'StripOffsets', 'StripByteCounts',
            'RowsPerStrip', 'SamplesPerPixel', 'PlanarConfiguration', 'ReferenceBlackWhite',
            'XMPToolkit', 'JpgFromRawStart', 'JpgFromRawLength', 'YCbCrPositioning',
            'SubfileType', 'OtherImageStart', 'OtherImageLength', 'PreviewImageStart',
            'PreviewImageLength', 'JpgFromRaw', 'OtherImage', 'PreviewImage',
            'ThumbnailTIFF', 'ContrastCurve', 'NEFLinearizationTable', 'ColorBalanceVersion',
            'LensDataVersion', 'RawImageCenter', 'RetouchHistory', 'FlashInfoVersion',
            'MultiExposureVersion', 'AFInfo2Version', 'FileInfoVersion', 'RetouchInfoVersion',
            'GPSVersionID', 'TIFF-EPStandardID', 'ScaleFactor35efl', 'CircleOfConfusion',
            'DOF', 'FOV', 'FocalLength35efl', 'HyperfocalDistance', 'LightValue',
            
            // Kamera-Hardware (nicht editierbar)
            'Make', 'Model', 'Software', 'FirmwareVersion', 'SerialNumber', 'LensType',
            'LensID', 'LensSpec', 'LensIDNumber', 'LensFStops', 'MinFocalLength', 'MaxFocalLength',
            'MaxApertureAtMinFocal', 'MaxApertureAtMaxFocal', 'MCUVersion', 'EffectiveMaxAperture',
            
            // Aufnahme-Parameter (nicht editierbar)
            'ExposureTime', 'FNumber', 'ExposureProgram', 'ISO', 'SensitivityType', 'RecommendedExposureIndex',
            'ExposureCompensation', 'MaxApertureValue', 'MeteringMode', 'LightSource', 'Flash',
            'FocalLength', 'FocalLengthIn35mmFormat', 'Aperture', 'ShutterSpeed', 'WhiteBalance',
            'FocusMode', 'FlashSetting', 'FlashType', 'WB_RBLevels', 'ProgramShift', 'ExposureDifference',
            'FlashExposureComp', 'ExternalFlashExposureComp', 'FlashExposureBracketValue', 'ExposureBracketValue',
            'CropHiSpeed', 'ExposureTuning', 'ColorSpace', 'VRInfoVersion', 'VibrationReduction', 'VRMode',
            'ActiveD-Lighting', 'PictureControlVersion', 'PictureControlName', 'PictureControlBase',
            'PictureControlAdjust', 'PictureControlQuickAdjust', 'Clarity', 'Brightness', 'Hue',
            'FilterEffect', 'ToningEffect', 'ToningSaturation', 'TimeZone', 'DaylightSavings',
            'DateDisplayFormat', 'ISOExpansion', 'ISO2', 'ISOExpansion2', 'VignetteControl',
            'AutoDistortionControl', 'BlackLevel', 'ImageSizeRAW', 'WhiteBalanceFineTune', 'CropArea',
            'ISOAutoShutterTime', 'FlickerReductionShooting', 'FlickerReductionIndicator',
            'MovieISOAutoControlManualMode', 'MovieWhiteBalanceSameAsPhoto',
            
            // Kamera-Einstellungen (nicht editierbar)
            'AF-SPrioritySel', 'AFActivation', 'FocusPointWrap', 'ManualFocusPointIllumination',
            'AF-AssistIlluminator', 'ManualFocusRingInAFMode', 'ISOStepSize', 'ExposureControlStepSize',
            'EasyExposureCompensation', 'MatrixMetering', 'FineTuneOptMatrixMetering', 'FineTuneOptCenterWeighted',
            'FineTuneOptSpotMetering', 'FineTuneOptHighlightWeighted', 'ShutterReleaseButtonAE-L',
            'SelfTimerTime', 'SelfTimerShotCount', 'SelfTimerShotInterval', 'PlaybackMonitorOffTime',
            'MenuMonitorOffTime', 'ShootingInfoMonitorOffTime', 'ImageReviewMonitorOffTime',
            'LiveViewMonitorOffTime', 'CLModeShootingSpeed', 'MaxContinuousRelease', 'ExposureDelayMode',
            'ElectronicFront-CurtainShutter', 'FileNumberSequence', 'FramingGridDisplay', 'LCDIllumination',
            'OpticalVR', 'FlashShutterSpeed', 'FlashExposureCompArea', 'AutoFlashISOSensitivity',
            'AssignBktButton', 'MultiSelectorLiveView', 'CmdDialsChangeMainSub', 'CmdDialsMenuAndPlayback',
            'SubDialFrameAdvance', 'ReleaseButtonToUseDial', 'ReverseIndicators', 'MovieShutterButton',
            'Language', 'FlickAdvanceDirection', 'HDMIOutputResolution', 'HDMIOutputRange',
            'CmdDialsReverseRotation', 'FlashMode', 'ShootingMode', 'ShotInfoVersion',
            'RollAngle', 'PitchAngle', 'YawAngle', 'NEFCompression', 'NoiseReduction',
            'ExitPupilPosition', 'AFAperture', 'FocusPosition', 'FocusDistance', 'RawImageCenter',
            'ShutterCount', 'FlashSource', 'ExternalFlashFirmware', 'ExternalFlashZoomOverride',
            'ExternalFlashStatus', 'ExternalFlashReadyState', 'FlashCompensation', 'FlashGNDistance',
            'FlashGroupAControlMode', 'FlashGroupBControlMode', 'FlashGroupCControlMode',
            'FlashGroupACompensation', 'FlashGroupBCompensation', 'FlashGroupCCompensation',
            'VariProgram', 'MultiExposureMode', 'MultiExposureShots', 'MultiExposureAutoGain',
            'HighISONoiseReduction', 'PowerUpTime', 'AFDetectionMethod', 'AFAreaMode',
            'FocusPointSchema', 'AFPointsUsed', 'AFPointsInFocus', 'PrimaryAFPoint',
            'MemoryCardNumber', 'DirectoryNumber', 'FileNumber', 'AFFineTune', 'AFFineTuneIndex',
            'AFFineTuneAdj', 'AFFineTuneAdjTele', 'RetouchNEFProcessing', 'SilentPhotography',
            'UserComment', 'SubSecTime', 'SubSecTimeOriginal', 'SubSecTimeDigitized',
            'SensingMethod', 'FileSource', 'SceneType', 'CustomRendered', 'ExposureMode',
            'SceneCaptureType', 'GainControl', 'Contrast', 'Saturation', 'Sharpness',
            'SubjectDistanceRange', 'DateTimeOriginal', 'TIFF-EPStandardID', 'BlueBalance',
            'CFAPattern', 'ImageSize', 'JpgFromRaw', 'Megapixels', 'OtherImage', 'PreviewImage',
            'RedBalance', 'ScaleFactor35efl', 'SubSecCreateDate', 'SubSecDateTimeOriginal',
            'SubSecModifyDate', 'ThumbnailTIFF', 'AutoFocus', 'ContrastDetectAF', 'PhaseDetectAF',
            
            // System-Felder
            'errors', 'warnings', 'ExifToolVersion', 'tz', 'tzSource', 'Orientation'
        ];

        // Überspringe nicht-editierbare Felder
        if (nonEditableFields.includes(key)) return true;
        
        // Überspringe [object Object] Werte
        if (value && typeof value === 'object' && value.toString() === '[object Object]') return true;
        
        // Überspringe leere oder sehr lange Werte
        if (!value || value.toString().length > 1000) return true;
        
        return false;
    }

    // Konvertiere Wert zu String
    function convertToString(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value.toString();
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') {
            if (value.toString() === '[object Object]') return '';
            return value.toString();
        }
        return String(value);
    }

    // Generiere Formularfelder dynamisch
    function generateFormFields(fields, isMultiEdit = false) {
        let html = '';
        
        // Sortiere Felder nach Wichtigkeit
        const fieldOrder = [
            'Title', 'Object Name', 'Description', 'Caption-Abstract', 'Keywords',
            'Artist', 'Creator', 'Copyright', 'Credit', 'Source', 'Date', 'Date Created',
            'Location', 'City', 'Country', 'State', 'Province', 'Subject', 'Category',
            'Supplemental Categories', 'Urgency', 'Instructions', 'By-line', 'By-line Title',
            'Contact', 'Transmission Reference', 'Headline', 'Caption Writer', 'Rights Usage Terms'
        ];

        const sortedFields = {};
        
        // Füge wichtige Felder zuerst hinzu
        fieldOrder.forEach(field => {
            if (fields[field]) {
                sortedFields[field] = fields[field];
            }
        });
        
        // Füge restliche Felder hinzu
        Object.entries(fields).forEach(([key, value]) => {
            if (!fieldOrder.includes(key)) {
                sortedFields[key] = value;
            }
        });

        Object.entries(sortedFields).forEach(([key, fieldData]) => {
            const fieldId = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const label = getFieldLabel(key);
            
            // Bestimme Wert und ob Feld leer ist
            let value, isEmpty, isEditable;
            if (typeof fieldData === 'object' && fieldData !== null) {
                value = fieldData.value || '';
                isEmpty = !fieldData.hasValue;
                isEditable = fieldData.isEditable !== false; // Default true wenn nicht gesetzt
            } else {
                value = fieldData || '';
                isEmpty = !value || value.trim() === '';
                isEditable = true; // Fallback für alte Struktur
            }
            
            const inputType = getInputType(key, value);
            let cssClass = 'form-group';
            if (!isEditable) {
                cssClass += ' non-editable-field';
            } else if (isEmpty) {
                cssClass += ' empty-field';
            }
            
            const tooltip = !isEditable ? 'title="Dieses Feld kann aus Datenschutz-/Konsistenzgründen nicht geändert werden"' : '';
            
            html += `
                <div class="${cssClass}" ${tooltip}>
                    <label for="${fieldId}">${label}:</label>
                    <div class="autocomplete-container">
                        ${inputType === 'textarea' ? 
                            `<textarea id="${fieldId}" name="${key}" rows="3" ${!isEditable ? 'readonly' : ''} placeholder="${isEmpty ? 'Leer - hier Metadaten hinzufügen...' : ''}">${escapeHtml(value)}</textarea>` :
                            `<input type="${inputType}" id="${fieldId}" name="${key}" value="${escapeHtml(value)}" ${!isEditable ? 'readonly' : ''} placeholder="${isEmpty ? 'Leer - hier Metadaten hinzufügen...' : ''}" autocomplete="off">`
                        }
                        <div class="autocomplete-suggestions" id="suggestions-${fieldId}" style="display: none;"></div>
                    </div>
                </div>
            `;
            
            // Debug: Log das generierte HTML für das erste Feld
            if (Object.keys(sortedFields).indexOf(key) === 0) {
                console.log('Generiertes HTML für erstes Feld:', html);
            }
        });

        return html;
    }

    // Erhalte benutzerfreundlichen Feldnamen
    function getFieldLabel(key) {
        const labels = {
            'Title': 'Titel',
            'Object Name': 'Objektname',
            'Description': 'Beschreibung',
            'Caption-Abstract': 'Bildunterschrift',
            'Keywords': 'Schlagwörter',
            'Artist': 'Künstler',
            'Creator': 'Urheber',
            'Copyright': 'Copyright',
            'Credit': 'Bildnachweis',
            'Source': 'Quelle',
            'Date': 'Datum',
            'Date Created': 'Erstellungsdatum',
            'Location': 'Ort',
            'City': 'Stadt',
            'Country': 'Land',
            'State': 'Bundesland',
            'Province': 'Provinz',
            'Subject': 'Thema',
            'Category': 'Kategorie',
            'Supplemental Categories': 'Zusätzliche Kategorien',
            'Urgency': 'Dringlichkeit',
            'Instructions': 'Anweisungen',
            'By-line': 'Autor',
            'By-line Title': 'Autor-Titel',
            'Contact': 'Kontakt',
            'Transmission Reference': 'Übertragungsreferenz',
            'Headline': 'Überschrift',
            'Caption Writer': 'Bildtext-Autor',
            'Rights Usage Terms': 'Nutzungsrechte'
        };
        
        return labels[key] || key;
    }

    // Bestimme Input-Typ basierend auf Feldname und Wert
    function getInputType(key, value) {
        const textareaFields = ['Description', 'Caption-Abstract', 'Instructions', 'Rights Usage Terms'];
        const dateFields = ['Date', 'Date Created', 'DateTimeOriginal'];
        
        if (textareaFields.includes(key) || (value && value.length > 50)) {
            return 'textarea';
        }
        
        if (dateFields.includes(key)) {
            return 'date';
        }
        
        return 'text';
    }

    // Benachrichtigungsfunktion
    function showNotification(message, type = 'info') {
        // Entferne vorherige Benachrichtigungen
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Styles für Benachrichtigung
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: slideIn 0.3s ease-out;
        `;

        // Farben basierend auf Typ
        if (type === 'success') {
            notification.style.backgroundColor = '#4CAF50';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#f44336';
        } else {
            notification.style.backgroundColor = '#2196F3';
        }

        document.body.appendChild(notification);

        // Entferne Benachrichtigung nach 5 Sekunden
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // Funktionen für Mehrfachauswahl
    function addMultiSelectButton() {
        // Entferne vorherigen Button falls vorhanden
        const existingButton = document.getElementById('multi-select-button');
        if (existingButton) {
            existingButton.remove();
        }

        const multiSelectBtn = document.createElement("button");
        multiSelectBtn.id = "multi-select-button";
        multiSelectBtn.className = "multi-select-btn";
        multiSelectBtn.textContent = "Mehrfachauswahl bearbeiten";
        multiSelectBtn.style.display = "none"; // Versteckt initial
        multiSelectBtn.addEventListener("click", openMultiEditModal);

        // Füge Button nach der Gallery hinzu
        const gallery = document.getElementById("gallery");
        gallery.parentNode.appendChild(multiSelectBtn);
    }

    function updateMultiSelectButton() {
        const checkboxes = document.querySelectorAll('.multi-select-checkbox:checked');
        const multiSelectBtn = document.getElementById('multi-select-button');
        
        if (checkboxes.length > 0) {
            multiSelectBtn.style.display = "block";
            multiSelectBtn.textContent = `Mehrfachauswahl bearbeiten (${checkboxes.length} ausgewählt)`;
        } else {
            multiSelectBtn.style.display = "none";
        }
    }

    async function openMultiEditModal() {
        const selectedCheckboxes = document.querySelectorAll('.multi-select-checkbox:checked');
        const selectedFiles = Array.from(selectedCheckboxes).map(cb => cb.value);
        
        if (selectedFiles.length === 0) {
            showNotification('Bitte wählen Sie mindestens ein Bild aus.', 'error');
            return;
        }

        // Lade Metadaten des ersten ausgewählten Bildes als Vorlage
        const firstFile = selectedFiles[0];
        const res = await fetch(`/api/metadata/${firstFile}`);
        const result = await res.json();
        const data = result.data || {};

        // Erstelle alle potentiellen Metadaten-Felder
        const allFields = createAllMetadataFields(data);

        // Erstelle Modal für Mehrfachauswahl
        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content multi-edit-modal">
                <div class="modal-header">
                    <h3>Mehrfachauswahl bearbeiten (${selectedFiles.length} Bilder)</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="selected-files">
                        <h4>Ausgewählte Dateien:</h4>
                        <ul>
                            ${selectedFiles.map(file => `<li>${file}</li>`).join('')}
                        </ul>
                    </div>
                    <form id="multi-edit-form">
                        ${generateFormFields(allFields, true)}
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancel-multi-btn">Abbrechen</button>
                    <button type="button" class="btn btn-primary" id="save-multi-btn">Speichern</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Initialisiere Autocomplete für Mehrfachauswahl-Modal
        console.log('🚀 Mehrfachauswahl-Modal hinzugefügt, initialisiere Autocomplete...');
        initializeAutocomplete(modal);

        // Event-Handler für Modal
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        const saveMultiMetadata = async () => {
            const form = document.getElementById('multi-edit-form');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Entferne leere Felder
            const cleanData = {};
            Object.entries(data).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value.toString().trim() !== '') {
                    cleanData[key] = value.toString().trim();
                }
            });

            if (Object.keys(cleanData).length === 0) {
                showNotification('Keine Änderungen vorgenommen.', 'info');
                closeModal();
                return;
            }

            // Zeige Lade-Indikator
            const saveBtn = modal.querySelector('#save-multi-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Speichere...';
            saveBtn.disabled = true;

            try {
                let successCount = 0;
                let errorCount = 0;

                // Speichere für jede ausgewählte Datei
                for (const filename of selectedFiles) {
                    try {
                        const response = await fetch(`/api/metadata/${filename}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(cleanData)
                        });

                        if (response.ok) {
                            successCount++;
                        } else {
                            errorCount++;
                            console.error(`Fehler bei ${filename}:`, await response.text());
                        }
                    } catch (error) {
                        errorCount++;
                        console.error(`Fehler bei ${filename}:`, error);
                    }
                }

                closeModal();
                
                // Aktualisiere Gallery
                loadGallery();
                
                // Zeige Ergebnis
                if (errorCount === 0) {
                    showNotification(`Metadaten erfolgreich für alle ${successCount} Bilder gespeichert!`, 'success');
                } else {
                    showNotification(`Metadaten für ${successCount} Bilder gespeichert, ${errorCount} Fehler aufgetreten.`, 'error');
                }

                // Wenn im Batch ein Titel gesetzt wurde, aktualisiere sichtbare Titel
                if (cleanData.Title !== undefined) {
                    selectedFiles.forEach(fn => updateGalleryTitle(fn, cleanData.Title));
                }
                
            } catch (error) {
                console.error('Fehler beim Speichern:', error);
                showNotification('Fehler beim Speichern der Metadaten!', 'error');
            } finally {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        };

        // Event-Listener hinzufügen
        modal.querySelector('.close').addEventListener('click', closeModal);
        modal.querySelector('#cancel-multi-btn').addEventListener('click', closeModal);
        modal.querySelector('#save-multi-btn').addEventListener('click', saveMultiMetadata);
        
        // Schließe Modal beim Klick außerhalb
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Schließe Modal mit Escape-Taste
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Initialisiere Autocomplete für alle Input-Felder
        initializeAutocomplete(modal);
    }

    // Autocomplete-Funktionalität
    function initializeAutocomplete(modal) {
        console.log('Initialisiere Autocomplete...');
        const inputs = modal.querySelectorAll('input[type="text"], textarea');
        console.log(`Gefundene Input-Felder: ${inputs.length}`);
        
        inputs.forEach(input => {
            if (input.readOnly) {
                console.log(`Überspringe readonly Feld: ${input.name}`);
                return; // Überspringe nicht-editierbare Felder
            }
            
            const fieldName = input.name;
            const suggestionsContainer = modal.querySelector(`#suggestions-${input.id}`);
            
            console.log(`Feld: ${fieldName}, Container gefunden: ${!!suggestionsContainer}`);
            
            if (!suggestionsContainer) {
                console.warn(`Kein Suggestions-Container gefunden für: ${input.id}`);
                return;
            }
            
            let debounceTimer;
            let selectedIndex = -1;
            
            // Input Event Handler
            input.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const query = e.target.value.trim();
                    if (query.length >= 1) {
                        fetchSuggestions(fieldName, query, suggestionsContainer);
                    } else {
                        hideSuggestions(suggestionsContainer);
                        selectedIndex = -1;
                    }
                }, 300); // 300ms Debounce
            });
            
            // Focus Event Handler - zeige immer Top 3 Vorschläge
            input.addEventListener('focus', (e) => {
                const query = e.target.value.trim();
                // Zeige Vorschläge beim Focus, auch ohne Query
                fetchSuggestions(fieldName, query, suggestionsContainer, true);
            });
            
            // Blur Event Handler (mit Delay für Klicks auf Vorschläge)
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    hideSuggestions(suggestionsContainer);
                    selectedIndex = -1;
                }, 200);
            });
            
            // Keyboard Navigation
            input.addEventListener('keydown', (e) => {
                if (suggestionsContainer.style.display === 'none') return;
                
                const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
                
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                        updateSelection(suggestionsContainer, selectedIndex);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        selectedIndex = Math.max(selectedIndex - 1, -1);
                        updateSelection(suggestionsContainer, selectedIndex);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                            input.value = suggestions[selectedIndex].textContent;
                            hideSuggestions(suggestionsContainer);
                            selectedIndex = -1;
                        }
                        break;
                    case 'Escape':
                        hideSuggestions(suggestionsContainer);
                        selectedIndex = -1;
                        break;
                }
            });
        });
    }
    
    async function fetchSuggestions(fieldName, query, container, showTopSuggestions = false) {
        try {
            console.log(`Lade Vorschläge für Feld: ${fieldName}, Query: "${query}", TopSuggestions: ${showTopSuggestions}`);
            
            // Wenn showTopSuggestions true ist und query leer, hole Top-Vorschläge
            const url = showTopSuggestions && (!query || query.length === 0) 
                ? `/api/suggestions/${encodeURIComponent(fieldName)}`
                : `/api/suggestions/${encodeURIComponent(fieldName)}?q=${encodeURIComponent(query)}`;
                
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`HTTP Fehler: ${response.status}`);
                return;
            }
            
            const data = await response.json();
            console.log(`Erhaltene Vorschläge:`, data);
            
            let suggestions = data.suggestions || [];
            
            // Limitiere auf maximal 3 Vorschläge beim Focus
            if (showTopSuggestions) {
                suggestions = suggestions.slice(0, 3);
            }
            
            displaySuggestions(suggestions, container);
        } catch (error) {
            console.error('Fehler beim Laden der Vorschläge:', error);
            hideSuggestions(container);
        }
    }
    
    function displaySuggestions(suggestions, container) {
        if (suggestions.length === 0) {
            hideSuggestions(container);
            return;
        }
        
        container.innerHTML = '';
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                const input = container.parentElement.querySelector('input, textarea');
                if (input) {
                    input.value = suggestion;
                    hideSuggestions(container);
                }
            });
            container.appendChild(item);
        });
        
        container.style.display = 'block';
    }
    
    function hideSuggestions(container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
    
    function updateSelection(container, selectedIndex) {
        const items = container.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Test-Funktion für Autocomplete (kann in der Browser-Konsole aufgerufen werden)
    window.testAutocomplete = async function() {
        console.log('🧪 Teste Autocomplete API...');
        
        try {
            const response = await fetch('/api/suggestions/Artist');
            const data = await response.json();
            console.log('✅ Artist Vorschläge:', data);
            
            const response2 = await fetch('/api/suggestions/Title?q=test');
            const data2 = await response2.json();
            console.log('✅ Title Vorschläge mit Query:', data2);
            
            console.log('🎉 API funktioniert korrekt!');
        } catch (error) {
            console.error('❌ API Fehler:', error);
        }
    };

    // Karten-Funktionalität
    let map = null;
    let mapMarkersGroup = null; // LayerGroup für einfaches Reset
    const markersByFilename = {}; // filename -> Marker
    const mapLocationsByFilename = {}; // filename -> { latitude, longitude, title }
    
    async function initializeMap() {
        try {
            // Initialisiere Karte
            map = L.map('map').setView([50.1109, 8.6821], 6); // Deutschland-zentriert
            
            // Füge OpenStreetMap Tiles hinzu
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            // Marker-Gruppe
            mapMarkersGroup = L.layerGroup().addTo(map);
            
            // Marker aufbauen
            await buildMapMarkers();
            
            // Zentriere Karte auf alle Marker
            fitMapToMarkers();
            
        } catch (error) {
            console.error('Fehler beim Laden der Karte:', error);
            document.getElementById('map-stats').textContent = 'Fehler beim Laden der GPS-Daten';
        }
    }

    // Baue Marker neu aus Backend-Daten
    async function buildMapMarkers() {
        // Lade GPS-Daten
        const response = await fetch('/api/gps-locations');
        const data = await response.json();
        console.log('GPS-Daten:', data);

        // Statistiken
        const mapStats = document.getElementById('map-stats');
        mapStats.textContent = `${data.imagesWithGPS} von ${data.totalImages} Bildern haben GPS-Koordinaten`;

        // Reset
        if (mapMarkersGroup) mapMarkersGroup.clearLayers();
        Object.keys(markersByFilename).forEach(k => delete markersByFilename[k]);
        Object.keys(mapLocationsByFilename).forEach(k => delete mapLocationsByFilename[k]);

        // Marker erzeugen
        for (const location of data.locations) {
            const marker = L.marker([location.latitude, location.longitude]);
            marker.addTo(mapMarkersGroup);
            mapLocationsByFilename[location.filename] = {
                latitude: location.latitude,
                longitude: location.longitude,
                title: location.title || location.filename
            };
            await setMarkerPopupFromMetadata(marker, location.filename, mapLocationsByFilename[location.filename]);
            markersByFilename[location.filename] = marker;
        }
    }

    // Generiere Popup-HTML basierend auf Metadaten
    async function setMarkerPopupFromMetadata(marker, filename, loc) {
        const thumbUrl = `/api/thumbnail/${encodeURIComponent(filename)}`;
        const fallbackUrl = `/uploads/${encodeURIComponent(filename)}`;
        let artistDisplay = 'Unbekannt';
        let dateDisplay = 'Unbekannt';
        try {
            const md = await getImageMetadata(filename);
            const artistRaw = md?.Artist;
            if (Array.isArray(artistRaw)) {
                const joined = artistRaw.filter(Boolean).join(', ').trim();
                if (joined) artistDisplay = joined;
            } else if (artistRaw) {
                const s = String(artistRaw).trim();
                if (s) artistDisplay = s;
            }
            const candidates = [md?.DateTimeOriginal, md?.CreateDate, md?.['Date Created'], md?.ModifyDate];
            for (const c of candidates) {
                const parsed = parseExifDate(c);
                if (parsed) { dateDisplay = parsed.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }); break; }
            }
        } catch (_) {}

        marker.bindPopup(`
            <div class="map-popup">
                <img src="${thumbUrl}" alt="${loc.title}" style="width: 150px; height: auto; border-radius: 4px;" onerror="this.src='${fallbackUrl}'">
                <h4>${loc.title}</h4>
                <p><strong>Künstler:</strong> ${artistDisplay}</p>
                <p><strong>Datum:</strong> ${dateDisplay}</p>
                <p><strong>Koordinaten:</strong> ${Number(loc.latitude).toFixed(6)}, ${Number(loc.longitude).toFixed(6)}</p>
            </div>
        `);
    }

    // Map neu laden (Marker neu aufbauen)
    async function refreshMap() {
        if (!map) return;
        await buildMapMarkers();
        fitMapToMarkers();
    }

    function fitMapToMarkers() {
        if (!map || !mapMarkersGroup) return;
        const bounds = mapMarkersGroup.getBounds();
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
        }
    }
    
    // Download-Modal-Funktionalität
    async function openDownloadModal(filename) {
        try {
            // Lade Größenschätzungen
            const response = await fetch(`/api/download/${filename}/estimate`);
            const estimates = await response.json();
            
            // Erstelle Download-Modal
            const modal = document.createElement("div");
            modal.className = "modal";
            modal.innerHTML = `
                <div class="modal-content download-modal">
                    <div class="modal-header">
                        <h3>📥 Download-Optionen: ${filename}</h3>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="original-info">
                            <h4>Original-Datei</h4>
                            <p><strong>Größe:</strong> ${estimates.original.sizeFormatted}</p>
                            <button class="btn btn-primary" onclick="downloadOriginal('${filename}')">
                                📁 Original herunterladen
                            </button>
                        </div>
                        
                        <div class="compressed-options">
                            <h4>Komprimierte Versionen</h4>
                            ${generateDownloadOptions(estimates, filename)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="close-download">Schließen</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Event-Handler
            const closeModal = () => document.body.removeChild(modal);
            modal.querySelector('.close').addEventListener('click', closeModal);
            modal.querySelector('#close-download').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
            
            // Globale Download-Funktionen
            window.downloadOriginal = (filename) => {
                window.open(`/api/download/${filename}`, '_blank');
                closeModal();
            };
            
            window.downloadCompressed = (filename, quality, format) => {
                window.open(`/api/download/${filename}/compressed?quality=${quality}&format=${format}`, '_blank');
                closeModal();
            };
            
        } catch (error) {
            console.error('Fehler beim Laden der Download-Optionen:', error);
            showNotification('Fehler beim Laden der Download-Optionen', 'error');
        }
    }
    
    function generateDownloadOptions(estimates, filename) {
        let html = '';
        
        Object.entries(estimates.qualityLabels).forEach(([quality, label]) => {
            if (estimates.estimates[quality]) {
                html += `<div class="quality-section">
                    <h5>${label}</h5>
                    <div class="format-options">`;
                
                Object.entries(estimates.estimates[quality]).forEach(([format, info]) => {
                    const formatLabel = format.toUpperCase();
                    html += `
                        <div class="format-option">
                            <button class="btn btn-outline" onclick="downloadCompressed('${filename}', '${quality}', '${format}')">
                                ${formatLabel} - ${info.sizeFormatted}
                                <small>(${info.width}x${info.height}, -${info.compressionRatio}%)</small>
                            </button>
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            }
        });
        
        return html;
    }

    // Initialisiere Filter
    initializeFilters();

    loadGallery();
    
    // Initialisiere Karte nach dem Laden
    setTimeout(initializeMap, 1000);
});
