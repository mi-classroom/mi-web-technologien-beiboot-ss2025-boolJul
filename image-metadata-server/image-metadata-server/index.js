console.log("Testausgabe erscheint.");
const express = require('express');
const app = express();
app.use(express.json());
console.log('Serverstart beginnt...');
const PORT = 4800;
const multer = require('multer');
const iptc = require('node-iptc');
const fs = require('fs');
const path = require('path');
const { exiftool } = require('exiftool-vendored');


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


// Start Server
app.listen(PORT, () => {
    console.log(`Server is being hosted on http://localhost:${PORT}`);
});

function sanitizeTags(tags) {
    const allowedTags = [
        'Title',
        'Description',
        'Keywords',
        'Artist',
        'Copyright'
    ];

    const sanitized = {};

    for (const key of allowedTags) {
        if (tags[key] !== undefined && tags[key] !== null && tags[key] !== '') {
            sanitized[key] = tags[key];
        }
    }

    return sanitized;
}


// Upload-Route
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('Keine Datei hochgeladen.');
    }
    res.send({
        message: 'Datei erfolgreich hochgeladen!',
        file: req.file
    });
});

// read metadata
app.get('/api/metadata/:imageId', async (req, res) => {
    const imageId = req.params.imageId;
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
    const imageId = req.params.imageId;
    const imagePath = path.join(__dirname, 'uploads', imageId);

    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Datei nicht gefunden.' });
    }

    const isJPEG = imageId.toLowerCase().endsWith('.jpg') || imageId.toLowerCase().endsWith('.jpeg');
    const isRAW = imageId.toLowerCase().endsWith('.dng') || imageId.toLowerCase().endsWith('.nef') || imageId.toLowerCase().endsWith('.cr2');

    try {
        if (isJPEG) {
            // jpg via node-iptc
            const buffer = fs.readFileSync(imagePath);
            const oldData = iptc(buffer);
            const newData = req.body;
            const mergedData = { ...oldData, ...newData };
            const newBuffer = iptc.update(buffer, mergedData);
            fs.writeFileSync(imagePath, newBuffer);

            res.json({
                message: 'IPTC-Daten in JPEG erfolgreich aktualisiert.',
                file: imageId,
                method: 'node-iptc'
            });
        } else if (isRAW) {
            // raw via exiftool
            const tags = req.body;

            const sanitizedTags = sanitizeTags(req.body);

            if (Object.keys(sanitizedTags).length === 0) {
                return res.status(400).json({ error: 'Keine gültigen Metadatenfelder angegeben.' });
            }

            await exiftool.write(imagePath, sanitizedTags, ['-overwrite_original']);
            res.json({
                message: 'Metadaten in RAW-Datei erfolgreich aktualisiert.',
                file: imageId,
                method: 'exiftool'
            });
        } else {
            res.status(400).json({ error: 'Dateiformat wird aktuell nicht unterstützt.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Metadaten.' });
    }
});



