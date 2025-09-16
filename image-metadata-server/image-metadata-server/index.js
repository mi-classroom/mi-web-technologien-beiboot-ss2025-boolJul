console.log("Testausgabe erscheint.");
const express = require('express');
const app = express();
app.use(express.static('public'));

// Middleware für JSON-Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug-Middleware für Request Body
app.use((req, res, next) => {
    if (req.method === 'POST' && req.path.includes('/api/metadata/')) {
        console.log('Request Headers:', req.headers['content-type']);
        console.log('Request Body Type:', typeof req.body);
        console.log('Request Body:', req.body);
    }
    next();
});
console.log('Serverstart beginnt...');
const PORT = 4800;
const multer = require('multer');
const iptc = require('node-iptc');
const fs = require('fs');
const path = require('path');
const { exiftool } = require('exiftool-vendored');
const sharp = require('sharp');
// exiftool-vendored wird für RAW-Thumbnail-Extraktion verwendet
app.use('/uploads', express.static('uploads'));

// Metadaten-Datenbank
const METADATA_DB_PATH = path.join(__dirname, 'metadata-db.json');

// Thumbnail-Generierung für unterstützte Bildformate
async function generateThumbnail(inputPath, outputPath) {
    try {
        const ext = path.extname(inputPath).toLowerCase();
        
        // Für Standard-Formate: Sharp verwenden
        if (['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'].includes(ext)) {
            await sharp(inputPath)
                .resize(200, 200, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 80 })
                .toFile(outputPath);
            
            console.log(`Thumbnail generiert: ${outputPath}`);
            return true;
        } else if (['.dng', '.nef', '.cr2', '.arw', '.orf', '.rw2'].includes(ext)) {
            // Für RAW-Dateien: Versuche eingebettetes Thumbnail mit ExifTool zu extrahieren
            const success = await extractRawThumbnail(inputPath, outputPath);
            if (success) {
                console.log(`RAW-Thumbnail extrahiert: ${outputPath}`);
                return true;
            }
            console.log(`Kein eingebettetes RAW-Thumbnail verfügbar: ${inputPath}`);
            return false;
        } else {
            console.log(`Thumbnail-Generierung übersprungen für unbekanntes Format: ${inputPath}`);
            return false;
        }
    } catch (error) {
        console.error(`Fehler bei Thumbnail-Generierung für ${inputPath}:`, error);
        return false;
    }
}

// Extrahiere eingebettetes Thumbnail aus RAW per exiftool-vendored
async function extractRawThumbnail(inputPath, outputPath) {
    try {
        // Zuerst Thumbnail versuchen
        try {
            await exiftool.extractThumbnail(inputPath, outputPath);
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                return true;
            }
        } catch (_) {}

        // Dann Preview versuchen
        try {
            await exiftool.extractPreview(inputPath, outputPath);
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                return true;
            }
        } catch (_) {}
        return false;
    } catch (e) {
        console.log('RAW-Thumbnail-Extraktion fehlgeschlagen:', e.message);
        return false;
    }
}

// Prüfe ob Thumbnail existiert oder generiere es
async function getThumbnailPath(originalPath) {
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    const thumbnailPath = path.join(path.dirname(originalPath), 'thumbnails', `${baseName}_thumb.jpg`);
    
    // Erstelle thumbnails Ordner falls nicht vorhanden
    const thumbnailsDir = path.dirname(thumbnailPath);
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
    }
    
    // Generiere Thumbnail falls nicht vorhanden
    if (!fs.existsSync(thumbnailPath)) {
        const success = await generateThumbnail(originalPath, thumbnailPath);
        if (!success) {
            return null; // Fallback auf Original
        }
    }
    
    return thumbnailPath;
}

// Lade Metadaten-Datenbank
function loadMetadataDB() {
    try {
        if (fs.existsSync(METADATA_DB_PATH)) {
            const data = fs.readFileSync(METADATA_DB_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Metadaten-Datenbank:', error);
    }
    return { metadata: {}, suggestions: {}, lastUpdated: null };
}

// Speichere Metadaten-Datenbank
function saveMetadataDB(db) {
    try {
        db.lastUpdated = new Date().toISOString();
        fs.writeFileSync(METADATA_DB_PATH, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('Fehler beim Speichern der Metadaten-Datenbank:', error);
    }
}

// Aktualisiere Metadaten-Datenbank
function updateMetadataDB(filename, metadata) {
    const db = loadMetadataDB();
    db.metadata[filename] = {
        ...metadata,
        lastUpdated: new Date().toISOString()
    };
    
    // Generiere Vorschläge für alle Felder
    generateSuggestions(db);
    saveMetadataDB(db);
}

// Generiere Vorschläge aus allen Metadaten
function generateSuggestions(db) {
    const suggestions = {};
    
    // Sammle alle Werte für jedes Feld
    Object.values(db.metadata).forEach(fileMetadata => {
        Object.entries(fileMetadata).forEach(([field, value]) => {
            if (value && typeof value === 'string' && value.trim() !== '' && 
                !['lastUpdated', 'SourceFile', 'FileName'].includes(field)) {
                
                if (!suggestions[field]) {
                    suggestions[field] = new Set();
                }
                suggestions[field].add(value.trim());
            }
        });
    });
    
    // Konvertiere Sets zu Arrays und sortiere
    Object.keys(suggestions).forEach(field => {
        suggestions[field] = Array.from(suggestions[field])
            .sort()
            .slice(0, 50); // Maximal 50 Vorschläge pro Feld
    });
    
    db.suggestions = suggestions;
}

// Initialisiere Metadaten-Datenbank mit vorhandenen Bildern
async function initializeMetadataDB() {
    console.log('Initialisiere Metadaten-Datenbank...');
    const uploadDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
        console.log('Upload-Verzeichnis existiert nicht');
        return;
    }
    
    const files = fs.readdirSync(uploadDir);
    const imageFiles = files.filter(file =>
        file.toLowerCase().endsWith('.jpg') ||
        file.toLowerCase().endsWith('.jpeg') ||
        file.toLowerCase().endsWith('.png') ||
        file.toLowerCase().endsWith('.dng') ||
        file.toLowerCase().endsWith('.nef') ||
        file.toLowerCase().endsWith('.cr2')
    );
    
    console.log(`Gefundene Bilder: ${imageFiles.length}`);
    
    for (const file of imageFiles) {
        try {
            const filePath = path.join(uploadDir, file);
            console.log(`Lade Metadaten für: ${file}`);
            
            // Lade Metadaten mit exiftool (funktioniert für alle Formate)
            const metadata = await exiftool.read(filePath);
            
            // Aktualisiere Datenbank
            updateMetadataDB(file, metadata);
            
        } catch (error) {
            console.error(`Fehler beim Laden der Metadaten für ${file}:`, error.message);
        }
    }
    
    console.log('Metadaten-Datenbank initialisiert');
}


// Testroute
app.get('/', (req, res) => {
    res.send('Hello World!');
});



// Config. name and dir
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // save to "uploads" dir
    },
    filename: function (req, file, cb) {
        // use timestamp additionally to name (unique)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });
app.post('/upload', upload.array('images', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Keine Dateien hochgeladen.');
    }

    res.send({
        message: 'Dateien erfolgreich hochgeladen!',
        files: req.files.map(f => f.filename)
    });
});

// Start Server
app.listen(PORT, async () => {
    console.log(`Server is being hosted on http://localhost:${PORT}`);
    
    // Initialisiere Metadaten-Datenbank
    await initializeMetadataDB();
});

function sanitizeTags(tags) {
    // Prüfe ob tags existiert und ein Objekt ist
    if (!tags || typeof tags !== 'object') {
        return {};
    }

    // Liste der erlaubten Tags für Metadaten-Schreibung (nur echte Metadaten)
    const allowedTags = [
        'Title',
        'Description',
        'Keywords',
        'Artist',
        'Copyright',
        'Credit',
        'Source',
        'Date',
        'Location',
        'Creator',
        'Object Name',
        'Caption-Abstract',
        'City',
        'Date Created',
        'Subject',
        'Category',
        'Supplemental Categories',
        'Urgency',
        'Instructions',
        'By-line',
        'By-line Title',
        'Contact',
        'Transmission Reference',
        'Headline',
        'Caption Writer',
        'Rights Usage Terms',
        'CreatorTool'
    ];

    const sanitized = {};
    const rejectedFields = [];

    for (const key of allowedTags) {
        if (tags[key] !== undefined && tags[key] !== null && tags[key] !== '') {
            // Konvertiere [object Object] zu String falls nötig
            let value = tags[key];
            if (value && typeof value === 'object' && value.toString() === '[object Object]') {
                value = value.toString();
            }
            sanitized[key] = value;
        }
    }

    // Sammle abgelehnte Felder für Debugging
    if (tags && typeof tags === 'object') {
        Object.keys(tags).forEach(key => {
            if (!allowedTags.includes(key)) {
                rejectedFields.push(key);
            }
        });
    }

    if (rejectedFields.length > 0) {
        console.log('Abgelehnte Felder (nicht editierbar):', rejectedFields);
    }

    return sanitized;
}



app.get('/api/images', (req, res) => {
    const uploadDir = path.join(__dirname, 'uploads');

    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            res.status(500).json({error: 'Fehler beim Lesen der Dateien.'});
        }

        const imageFiles = files.filter(file =>
            file.toLowerCase().endsWith('.jpg') ||
            file.toLowerCase().endsWith('.jpeg') ||
            file.toLowerCase().endsWith('.png') ||
            file.toLowerCase().endsWith('.dng') ||
            file.toLowerCase().endsWith('.nef') ||
            file.toLowerCase().endsWith('.cr2')
        );

        res.json(imageFiles);
    });
});

// API-Endpoint für Filter-Optionen
app.get('/api/filter-options', (req, res) => {
    try {
        // Lade aktuelle Metadaten-DB
        const currentMetadataDB = loadMetadataDB();
        
        const artists = new Set();
        const keywords = new Set();
        const copyrights = new Set();
        
        // Durchlaufe alle Metadaten in der Datenbank
        Object.values(currentMetadataDB).forEach(imageData => {
            // Artist behandeln (kann String oder Array sein)
            if (imageData.Artist) {
                if (Array.isArray(imageData.Artist)) {
                    imageData.Artist.forEach(artist => artists.add(artist.toString().trim()));
                } else {
                    artists.add(imageData.Artist.toString().trim());
                }
            }
            
            // Copyright behandeln (kann String oder Array sein)
            if (imageData.Copyright) {
                if (Array.isArray(imageData.Copyright)) {
                    imageData.Copyright.forEach(copyright => copyrights.add(copyright.toString().trim()));
                } else {
                    copyrights.add(imageData.Copyright.toString().trim());
                }
            }
            
            // Keywords behandeln (kann String oder Array sein)
            if (imageData.Keywords) {
                if (typeof imageData.Keywords === 'string') {
                    const keywordList = imageData.Keywords.split(',').map(k => k.trim());
                    keywordList.forEach(keyword => {
                        if (keyword) keywords.add(keyword);
                    });
                } else if (Array.isArray(imageData.Keywords)) {
                    imageData.Keywords.forEach(keyword => {
                        if (keyword) keywords.add(keyword.toString().trim());
                    });
                }
            }
        });
        
        res.json({
            artists: Array.from(artists).sort(),
            keywords: Array.from(keywords).sort(),
            copyrights: Array.from(copyrights).sort()
        });
    } catch (error) {
        console.error('Fehler beim Laden der Filter-Optionen:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Filter-Optionen' });
    }
});

// API-Endpoint für Thumbnails
app.get('/api/thumbnail/:filename', async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const originalPath = path.join(__dirname, 'uploads', filename);
        const ext = path.extname(filename).toLowerCase();
        
        // Prüfe ob Originaldatei existiert
        if (!fs.existsSync(originalPath)) {
            return res.status(404).json({ error: 'Datei nicht gefunden' });
        }
        
        // Für RAW-Dateien: Versuche Thumbnail zu generieren
        if (['.dng', '.nef', '.cr2', '.arw', '.orf', '.rw2'].includes(ext)) {
            // Generiere oder hole Thumbnail
            const thumbnailPath = await getThumbnailPath(originalPath);
            
            if (thumbnailPath && fs.existsSync(thumbnailPath)) {
                // Sende extrahiertes Thumbnail
                res.sendFile(thumbnailPath);
                return;
            } else {
                return res.status(404).json({ error: 'Kein RAW-Thumbnail verfügbar' });
            }
        }
        
        // Für unterstützte Formate: Generiere oder hole Thumbnail
        const thumbnailPath = await getThumbnailPath(originalPath);
        
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            // Sende Thumbnail
            res.sendFile(thumbnailPath);
        } else {
            // Fallback: Sende Original (für unterstützte Formate)
            if (['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'].includes(ext)) {
                res.sendFile(originalPath);
            } else {
                // Unbekanntes Format: Sende Platzhalter
                res.status(404).json({ error: 'Thumbnail nicht verfügbar' });
            }
        }
    } catch (error) {
        console.error('Fehler beim Laden des Thumbnails:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Thumbnails' });
    }
});

app.delete('/api/images/:imageId', (req, res) => {
    try {
        // URL-decode den Dateinamen
        const filename = decodeURIComponent(req.params.imageId);
        const filePath = path.join(__dirname, 'uploads', filename);

        console.log(`Lösche Datei: ${filename}`);
        console.log(`Pfad: ${filePath}`);

        // Sicherheitsprüfung
        if (filename.includes('..')) {
            return res.status(400).json({error: 'Ungültiger Dateiname'});
        }

        // Prüfe ob Datei existiert
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({error: 'Datei nicht gefunden'});
        }

        // Lösche Hauptdatei
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Fehler beim Löschen:', err);
                return res.status(500).json({error: 'Fehler beim Löschen der Datei'});
            }

            // Lösche auch Thumbnail falls vorhanden
            const ext = path.extname(filename);
            const baseName = path.basename(filename, ext);
            const thumbnailPath = path.join(__dirname, 'uploads', 'thumbnails', `${baseName}_thumb.jpg`);
            
            if (fs.existsSync(thumbnailPath)) {
                fs.unlink(thumbnailPath, (thumbErr) => {
                    if (thumbErr) console.log('Thumbnail konnte nicht gelöscht werden:', thumbErr);
                });
            }

            // Entferne aus Metadaten-DB
            const currentMetadataDB = loadMetadataDB();
            if (currentMetadataDB[filename]) {
                delete currentMetadataDB[filename];
                saveMetadataDB(currentMetadataDB);
            }

            console.log(`Datei erfolgreich gelöscht: ${filename}`);
            res.json({message: 'Datei erfolgreich gelöscht'});
        });
    } catch (error) {
        console.error('Fehler beim Löschen:', error);
        res.status(500).json({error: 'Fehler beim Löschen der Datei'});
    }
});

// Download endpoint
app.get('/api/download/:imageId', (req, res) => {
    const filename = decodeURIComponent(req.params.imageId);
    const filePath = path.join(__dirname, 'uploads', filename);

    // Sicherheitscheck
    if (filename.includes('..')) {
        return res.status(400).json({error: 'ungültig'});
    }

    // Prüfe ob Datei existiert
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({error: 'Datei nicht gefunden'});
    }

    // Setze Download-Header
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Download-Fehler:', err);
            res.status(500).json({error: 'Fehler beim Download'});
        }
    });
});

// read metadata
app.get('/api/metadata/:imageId', async (req, res) => {
    const imageId = decodeURIComponent(req.params.imageId);
    const imagePath = path.join(__dirname, 'uploads', imageId);

    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Datei nicht gefunden.' });
    }

    try {
        // try to get iptc-data (jpg only)
        const buffer = fs.readFileSync(imagePath);
        const iptcData = iptc(buffer);

        if (iptcData && Object.keys(iptcData).length > 0) {
            // if iptc was found
            return res.json({ source: "node-iptc", data: iptcData });
        } else {
            // if not, use exif tool (raw-files data)
            const exifData = await exiftool.read(imagePath);
            return res.json({ source: "exiftool", data: exifData });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Lesen der Metadaten.' });
    }
});

app.post('/api/metadata/:imageId', async (req, res) => {
    const imageId = decodeURIComponent(req.params.imageId);
    const imagePath = path.join(__dirname, 'uploads', imageId);

    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Datei nicht gefunden.' });
    }

    // Prüfe ob Request Body vorhanden ist
    if (!req.body || typeof req.body !== 'object') {
        console.log('Request Body fehlt oder ist ungültig:', req.body);
        return res.status(400).json({ 
            error: 'Keine Metadaten im Request Body gefunden.',
            hint: 'Stelle sicher, dass Content-Type: application/json gesetzt ist.',
            receivedBody: req.body
        });
    }

    console.log('Request Body erhalten:', req.body);
    console.log('Dateiname:', imageId);
    console.log('Dateierweiterung:', path.extname(imageId).toLowerCase());

    const isJPEG = imageId.toLowerCase().endsWith('.jpg') || imageId.toLowerCase().endsWith('.jpeg');
    const isPNG = imageId.toLowerCase().endsWith('.png');
    const isRAW = imageId.toLowerCase().endsWith('.dng') || imageId.toLowerCase().endsWith('.nef') || imageId.toLowerCase().endsWith('.cr2');
    
    console.log('Dateiformat-Erkennung:', { isJPEG, isPNG, isRAW });

    try {
        if (isJPEG) {
            // jpg via node-iptc
            const buffer = fs.readFileSync(imagePath);
            const oldData = iptc(buffer);
            const newData = req.body;
            const mergedData = { ...oldData, ...newData };
            const newBuffer = iptc.update(buffer, mergedData);
            fs.writeFileSync(imagePath, newBuffer);

            // Aktualisiere Metadaten-Datenbank
            updateMetadataDB(imageId, newData);

            res.json({
                message: 'IPTC-Daten in JPEG erfolgreich aktualisiert.',
                file: imageId,
                method: 'node-iptc'
            });
        } else if (isPNG) {
            // png via exiftool
            const tags = req.body || {};
            console.log('Empfangene Tags für PNG:', tags ? Object.keys(tags) : 'Keine Tags empfangen');

            const sanitizedTags = sanitizeTags(req.body);
            console.log('Sanitisierte Tags für PNG:', sanitizedTags ? Object.keys(sanitizedTags) : 'Keine sanitisierten Tags');

            if (!sanitizedTags || Object.keys(sanitizedTags).length === 0) {
                console.log('Keine gültigen Metadaten für PNG gefunden');
                console.log('Empfangene Felder:', tags ? Object.keys(tags) : 'Keine');
                console.log('Empfangene Werte:', tags);
                console.log('Sanitisierte Felder:', sanitizedTags ? Object.keys(sanitizedTags) : 'Keine');
                
                return res.status(400).json({ 
                    error: 'Keine gültigen Metadatenfelder angegeben. Nur echte Metadaten-Felder sind editierbar.',
                    receivedFields: tags ? Object.keys(tags) : [],
                    receivedValues: tags,
                    sanitizedFields: sanitizedTags ? Object.keys(sanitizedTags) : [],
                    allowedFields: [
                        'Title', 'Description', 'Keywords', 'Artist', 'Copyright', 'Credit', 'Source',
                        'Date', 'Location', 'Creator', 'Object Name', 'Caption-Abstract', 'City',
                        'Date Created', 'Subject', 'Category', 'Supplemental Categories', 'Urgency',
                        'Instructions', 'By-line', 'By-line Title', 'Contact', 'Transmission Reference',
                        'Headline', 'Caption Writer', 'Rights Usage Terms'
                    ]
                });
            }

            await exiftool.write(imagePath, sanitizedTags, ['-overwrite_original']);
            
            // Aktualisiere Metadaten-Datenbank
            updateMetadataDB(imageId, sanitizedTags);
            
            res.json({
                message: 'Metadaten in PNG-Datei erfolgreich aktualisiert.',
                file: imageId,
                method: 'exiftool',
                updatedFields: Object.keys(sanitizedTags)
            });
        } else if (isRAW) {
            // raw via exiftool
            const tags = req.body || {};
            console.log('Empfangene Tags:', tags ? Object.keys(tags) : 'Keine Tags empfangen');

            const sanitizedTags = sanitizeTags(req.body);
            console.log('Sanitisierte Tags:', sanitizedTags ? Object.keys(sanitizedTags) : 'Keine sanitisierten Tags');

            if (!sanitizedTags || Object.keys(sanitizedTags).length === 0) {
                console.log('Keine gültigen Metadaten gefunden');
                console.log('Empfangene Felder:', tags ? Object.keys(tags) : 'Keine');
                console.log('Empfangene Werte:', tags);
                console.log('Sanitisierte Felder:', sanitizedTags ? Object.keys(sanitizedTags) : 'Keine');
                
                return res.status(400).json({ 
                    error: 'Keine gültigen Metadatenfelder angegeben. Nur echte Metadaten-Felder sind editierbar.',
                    receivedFields: tags ? Object.keys(tags) : [],
                    receivedValues: tags,
                    sanitizedFields: sanitizedTags ? Object.keys(sanitizedTags) : [],
                    allowedFields: [
                        'Title', 'Description', 'Keywords', 'Artist', 'Copyright', 'Credit', 'Source',
                        'Date', 'Location', 'Creator', 'Object Name', 'Caption-Abstract', 'City',
                        'Date Created', 'Subject', 'Category', 'Supplemental Categories', 'Urgency',
                        'Instructions', 'By-line', 'By-line Title', 'Contact', 'Transmission Reference',
                        'Headline', 'Caption Writer', 'Rights Usage Terms'
                    ]
                });
            }

            await exiftool.write(imagePath, sanitizedTags, ['-overwrite_original']);
            
            // Aktualisiere Metadaten-Datenbank
            updateMetadataDB(imageId, sanitizedTags);
            
            res.json({
                message: 'Metadaten in RAW-Datei erfolgreich aktualisiert.',
                file: imageId,
                method: 'exiftool',
                updatedFields: Object.keys(sanitizedTags)
            });
        } else {
            res.status(400).json({ 
                error: 'Dateiformat wird aktuell nicht unterstützt.',
                supportedFormats: ['JPEG (.jpg, .jpeg)', 'PNG (.png)', 'RAW (.dng, .nef, .cr2)'],
                receivedFile: imageId
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Metadaten.' });
    }
});

// API für Autovorschläge
app.get('/api/suggestions/:field', (req, res) => {
    const field = req.params.field;
    const query = req.query.q || '';
    
    const db = loadMetadataDB();
    const fieldSuggestions = db.suggestions[field] || [];
    
    // Filtere Vorschläge basierend auf Query
    let filteredSuggestions = fieldSuggestions;
    if (query && query.trim() !== '') {
        const queryLower = query.toLowerCase();
        filteredSuggestions = fieldSuggestions.filter(suggestion => 
            suggestion.toLowerCase().includes(queryLower)
        );
    }
    
    // Sortiere nach Relevanz (exakte Matches zuerst)
    filteredSuggestions.sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const queryLower = query.toLowerCase();
        
        const aStartsWith = aLower.startsWith(queryLower);
        const bStartsWith = bLower.startsWith(queryLower);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return a.localeCompare(b);
    });
    
    // Limitiere auf 3 Vorschläge (oder 5 bei Suche)
    const limit = query && query.trim() !== '' ? 5 : 3;
    const suggestions = filteredSuggestions.slice(0, limit);
    
    res.json({
        field: field,
        query: query,
        suggestions: suggestions
    });
});

// API um alle verfügbaren Felder zu bekommen
app.get('/api/suggestions', (req, res) => {
    const db = loadMetadataDB();
    const availableFields = Object.keys(db.suggestions).filter(field => 
        db.suggestions[field] && db.suggestions[field].length > 0
    );
    
    res.json({
        availableFields: availableFields,
        totalSuggestions: Object.keys(db.suggestions).length
    });
});

// API für GPS-Koordinaten aller Bilder
app.get('/api/gps-locations', async (req, res) => {
    try {
        const uploadDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadDir);
        const imageFiles = files.filter(file =>
            file.toLowerCase().endsWith('.jpg') ||
            file.toLowerCase().endsWith('.jpeg') ||
            file.toLowerCase().endsWith('.png') ||
            file.toLowerCase().endsWith('.dng') ||
            file.toLowerCase().endsWith('.nef') ||
            file.toLowerCase().endsWith('.cr2')
        );

        const locations = [];

        for (const file of imageFiles) {
            try {
                const filePath = path.join(uploadDir, file);
                const metadata = await exiftool.read(filePath);
                
                if (metadata.GPSLatitude && metadata.GPSLongitude) {
                    locations.push({
                        filename: file,
                        latitude: metadata.GPSLatitude,
                        longitude: metadata.GPSLongitude,
                        title: metadata.Title || metadata['Object Name'] || file,
                        artist: metadata.Artist || metadata.Creator || 'Unbekannt',
                        date: metadata['Date Created'] || metadata.Date || 'Unbekannt'
                    });
                }
            } catch (error) {
                console.error(`Fehler beim Lesen der GPS-Daten für ${file}:`, error.message);
            }
        }

        res.json({
            locations: locations,
            totalImages: imageFiles.length,
            imagesWithGPS: locations.length
        });
    } catch (error) {
        console.error('Fehler beim Laden der GPS-Daten:', error);
        res.status(500).json({ error: 'Fehler beim Laden der GPS-Daten' });
    }
});

// API für komprimierte Downloads
app.get('/api/download/:imageId/compressed', async (req, res) => {
    const filename = decodeURIComponent(req.params.imageId);
    const quality = req.query.quality || 'medium'; // low, medium, high
    const format = req.query.format || 'jpg'; // jpg, png, webp
    
    const filePath = path.join(__dirname, 'uploads', filename);
    
    // Sicherheitscheck
    if (filename.includes('..') || !fs.existsSync(filePath)) {
        return res.status(400).json({error: 'Datei nicht gefunden'});
    }

    try {
        const isRaw = ['.dng', '.nef', '.cr2', '.arw', '.orf', '.rw2'].includes(path.extname(filename).toLowerCase());
        const sourcePath = await getProcessableSourcePath(filePath, isRaw);
        // Schutz: Sharp kann RAW nicht lesen. Ohne eingebettetes Preview/Thumbnail abbrechen.
        if (isRaw && sourcePath === filePath) {
            return res.status(422).json({
                error: 'RAW-Datei hat kein eingebettetes Preview/Thumbnail – Komprimierung nicht möglich',
                hint: 'Lade das Original herunter oder konvertiere extern (z.B. LibRaw/DCRaw).'
            });
        }
        
        // Qualitäts-Einstellungen
        const qualitySettings = {
            low: { quality: 60, width: 800, pngCompression: 9 },
            medium: { quality: 80, width: 1200, pngCompression: 6 },
            high: { quality: 95, width: 1920, pngCompression: 3 }
        };
        
        const settings = qualitySettings[quality] || qualitySettings.medium;
        
        // Erstelle komprimierte Version
        let pipeline = sharp(sourcePath).resize(settings.width, null, { 
            withoutEnlargement: true 
        });
        
        // Format-spezifische Einstellungen
        switch (format) {
            case 'jpg':
            case 'jpeg':
                pipeline = pipeline.jpeg({ quality: settings.quality });
                break;
            case 'png':
                pipeline = pipeline.png({ compressionLevel: settings.pngCompression });
                break;
            case 'webp':
                pipeline = pipeline.webp({ quality: settings.quality });
                break;
            default:
                return res.status(400).json({error: 'Unsupported format'});
        }
        
        const buffer = await pipeline.toBuffer();
        
        // Setze Download-Header
        const downloadFilename = `${path.parse(filename).name}_${quality}.${format}`;
        res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
        res.setHeader('Content-Type', `image/${format}`);
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
    } catch (error) {
        console.error('Komprimierungs-Fehler:', error);
        res.status(500).json({error: 'Fehler bei der Bildkomprimierung'});
    }
});

// API für Dateigröße-Schätzungen
app.get('/api/download/:imageId/estimate', async (req, res) => {
    const filename = decodeURIComponent(req.params.imageId);
    const filePath = path.join(__dirname, 'uploads', filename);
    
    if (filename.includes('..') || !fs.existsSync(filePath)) {
        return res.status(400).json({error: 'Datei nicht gefunden'});
    }

    try {
        const isRaw = ['.dng', '.nef', '.cr2', '.arw', '.orf', '.rw2'].includes(path.extname(filename).toLowerCase());
        const sourcePath = await getProcessableSourcePath(filePath, isRaw);
        if (isRaw && sourcePath === filePath) {
            const originalStats = fs.statSync(filePath);
            return res.json({
                original: { size: originalStats.size, sizeFormatted: formatFileSize(originalStats.size) },
                estimates: {},
                qualityLabels: { low: 'Niedrig (Web)', medium: 'Mittel (Social Media)', high: 'Hoch (Druck)' },
                rawUnsupported: true,
                hint: 'RAW ohne eingebettetes Preview – keine Größen-Schätzung/Komprimierung möglich'
            });
        }
        const originalStats = fs.statSync(sourcePath);
        
        const estimates = {};
        const qualitySettings = {
            low: { quality: 60, width: 800, pngCompression: 9, label: 'Niedrig (Web)' },
            medium: { quality: 80, width: 1200, pngCompression: 6, label: 'Mittel (Social Media)' },
            high: { quality: 95, width: 1920, pngCompression: 3, label: 'Hoch (Druck)' }
        };
        
        for (const [qualityKey, settings] of Object.entries(qualitySettings)) {
            for (const format of ['jpg', 'png', 'webp']) {
                try {
                    let pipeline = sharp(sourcePath).resize(settings.width, null, { 
                        withoutEnlargement: true 
                    });
                    
                    switch (format) {
                        case 'jpg':
                            pipeline = pipeline.jpeg({ quality: settings.quality });
                            break;
                        case 'png':
                            pipeline = pipeline.png({ compressionLevel: settings.pngCompression });
                            break;
                        case 'webp':
                            pipeline = pipeline.webp({ quality: settings.quality });
                            break;
                    }
                    
                    const { info } = await pipeline.toBuffer({ resolveWithObject: true });
                    
                    if (!estimates[qualityKey]) estimates[qualityKey] = {};
                    estimates[qualityKey][format] = {
                        size: info.size,
                        sizeFormatted: formatFileSize(info.size),
                        width: info.width,
                        height: info.height,
                        compressionRatio: ((originalStats.size - info.size) / originalStats.size * 100).toFixed(1)
                    };
                    
                } catch (error) {
                    console.error(`Fehler bei ${qualityKey}/${format}:`, error.message);
                }
            }
        }
        
        res.json({
            original: {
                size: originalStats.size,
                sizeFormatted: formatFileSize(originalStats.size)
            },
            estimates: estimates,
            qualityLabels: Object.fromEntries(
                Object.entries(qualitySettings).map(([key, val]) => [key, val.label])
            )
        });
        
    } catch (error) {
        console.error('Schätzungs-Fehler:', error);
        res.status(500).json({error: 'Fehler bei der Größenschätzung'});
    }
});

// Hilfsfunktion für Dateigröße-Formatierung
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Erzeuge verarbeitbare Quelle für Kompression: bei RAW per Preview/Thumbnail, sonst Original
async function getProcessableSourcePath(filePath, isRaw) {
    if (!isRaw) return filePath;
    try {
        const ext = path.extname(filePath).toLowerCase();
        const baseName = path.basename(filePath, ext);
        const tempPreviewPath = path.join(path.dirname(filePath), 'thumbnails', `${baseName}_preview_tmp.jpg`);
        const thumbsDir = path.dirname(tempPreviewPath);
        if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

        try {
            await exiftool.extractPreview(filePath, tempPreviewPath);
            if (fs.existsSync(tempPreviewPath) && fs.statSync(tempPreviewPath).size > 0) {
                return tempPreviewPath;
            }
        } catch (_) {}

        try {
            await exiftool.extractThumbnail(filePath, tempPreviewPath);
            if (fs.existsSync(tempPreviewPath) && fs.statSync(tempPreviewPath).size > 0) {
                return tempPreviewPath;
            }
        } catch (_) {}

        return filePath;
    } catch {
        return filePath;
    }
}

// Debug-Endpoint für Metadaten-Datenbank
app.get('/api/debug/metadata-db', (req, res) => {
    const db = loadMetadataDB();
    res.json({
        totalFiles: Object.keys(db.metadata).length,
        totalSuggestionFields: Object.keys(db.suggestions).length,
        lastUpdated: db.lastUpdated,
        metadata: db.metadata,
        suggestions: db.suggestions
    });
});



