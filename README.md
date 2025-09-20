# IPTC Metadata Editor

Eine moderne Web-Anwendung zur Bearbeitung von IPTC- und EXIF-Metadaten in Bildern. Die Anwendung unterstützt verschiedene Bildformate inklusive RAW-Dateien und bietet eine intuitive Benutzeroberfläche mit Drag & Drop-Upload, GPS-Kartenansicht und erweiterten Filteroptionen.

## 🚀 Features

- **Multi-Format Support**: JPEG, PNG, RAW-Dateien (DNG, NEF, CR2, ARW, ORF, RW2)
- **Drag & Drop Upload**: Einfaches Hochladen mehrerer Bilder gleichzeitig
- **Metadaten-Editor**: Bearbeitung von IPTC- und EXIF-Daten
- **GPS-Kartenansicht**: Visualisierung von Aufnahmeorten auf einer interaktiven Karte
- **Thumbnail-Generierung**: Automatische Vorschau-Erstellung für alle unterstützten Formate
- **Erweiterte Filter**: Filtern nach Format, Künstler, Keywords, Copyright
- **Automatische Vorschläge**: Intelligente Vorschläge basierend auf vorhandenen Metadaten
- **Komprimierte Downloads**: Verschiedene Qualitätsstufen und Formate
- **Responsive Design**: Optimiert für Desktop und mobile Geräte

## 📋 Voraussetzungen

- **Node.js** (Version 16 oder höher)
- **npm** (Node Package Manager)
- **ExifTool** (wird automatisch über exiftool-vendored installiert)

## 🛠️ Installation & Setup

### 1. Repository klonen
```bash
git clone <repository-url>
cd image-metadata-server/image-metadata-server
```

### 2. Abhängigkeiten installieren
```bash
npm install
```

### 3. Server starten
```bash
npm start
```

Die Anwendung ist dann unter `http://localhost:4800` erreichbar.

## 📖 Nutzung

### Bilder hochladen
1. **Drag & Drop**: Ziehen Sie Bilder direkt in den Upload-Bereich
2. **Datei-Auswahl**: Klicken Sie auf "Dateien auswählen" und wählen Sie Bilder aus
3. **Unterstützte Formate**: JPEG, PNG, DNG, NEF, CR2, ARW, ORF, RW2

### Metadaten bearbeiten
1. **Bild auswählen**: Klicken Sie auf ein Bild in der Galerie
2. **Metadaten anzeigen**: Die aktuellen Metadaten werden in der rechten Seitenleiste angezeigt
3. **Bearbeiten**: Klicken Sie auf die Metadaten-Felder, um sie zu bearbeiten
4. **Speichern**: Änderungen werden automatisch gespeichert

### Filter und Suche
- **Textsuche**: Verwenden Sie das Suchfeld für Namen, Künstler oder Keywords
- **Format-Filter**: Filtern Sie nach RAW, JPEG oder PNG
- **Metadaten-Filter**: Filtern Sie nach Künstler, Keywords oder Copyright
- **Sortierung**: Sortieren Sie nach Aufnahmedatum, Uploaddatum oder Name

### GPS-Kartenansicht
- **Aufnahmeorte**: Alle Bilder mit GPS-Daten werden auf der Karte angezeigt
- **Marker-Klick**: Klicken Sie auf einen Marker, um das entsprechende Bild zu fokussieren
- **Statistiken**: Sehen Sie die Anzahl der Bilder mit GPS-Daten

### Downloads
- **Original**: Laden Sie das Originalbild herunter
- **Komprimiert**: Wählen Sie verschiedene Qualitätsstufen (Niedrig, Mittel, Hoch)
- **Formate**: JPEG, PNG oder WebP

## 🏗️ Technische Details

### Backend (Node.js/Express)
- **Express.js**: Web-Framework
- **Multer**: File-Upload-Handling
- **ExifTool-vendored**: Metadaten-Extraktion und -Schreibung
- **Sharp**: Bildverarbeitung und Thumbnail-Generierung
- **Node-IPTC**: IPTC-Metadaten für JPEG-Dateien

### Frontend
- **Vanilla JavaScript**: Keine externen Frameworks
- **Leaflet**: Interaktive Karten
- **Responsive CSS**: Mobile-optimiertes Design

### Unterstützte Metadaten-Felder
- Title, Description, Keywords
- Artist, Creator, Copyright
- Credit, Source, Location
- Date Created, City, Subject
- Category, Urgency, Instructions
- By-line, Contact, Headline
- Caption Writer, Rights Usage Terms

## 📁 Projektstruktur

```
image-metadata-server/
├── index.js              # Hauptserver-Datei
├── package.json          # Abhängigkeiten
├── metadata-db.json      # Metadaten-Datenbank
├── uploads/              # Hochgeladene Bilder
│   └── thumbnails/       # Generierte Thumbnails
└── public/               # Frontend-Dateien
    ├── index.html        # Haupt-HTML
    ├── script.js         # Frontend-JavaScript
    └── style.css         # Styling
```

## 🔧 API-Endpunkte

- `GET /api/images` - Liste aller Bilder
- `GET /api/metadata/:imageId` - Metadaten eines Bildes abrufen
- `POST /api/metadata/:imageId` - Metadaten eines Bildes aktualisieren
- `GET /api/thumbnail/:filename` - Thumbnail eines Bildes
- `GET /api/gps-locations` - GPS-Koordinaten aller Bilder
- `GET /api/filter-options` - Verfügbare Filter-Optionen
- `GET /api/suggestions/:field` - Autovorschläge für Metadaten-Felder
- `DELETE /api/images/:imageId` - Bild löschen
- `GET /api/download/:imageId` - Bild herunterladen
- `GET /api/download/:imageId/compressed` - Komprimiertes Bild herunterladen

## 🐛 Fehlerbehebung

### Häufige Probleme

1. **Port bereits belegt**: Ändern Sie den Port in `index.js` (Zeile 20)
2. **ExifTool-Fehler**: Stellen Sie sicher, dass ExifTool installiert ist
3. **Thumbnail-Probleme**: Überprüfen Sie die Berechtigungen im `uploads/thumbnails/` Ordner
4. **RAW-Dateien**: Nicht alle RAW-Formate haben eingebettete Thumbnails

### Logs überprüfen
Der Server gibt detaillierte Logs in der Konsole aus. Überprüfen Sie diese bei Problemen.

## 📝 Architectural Decision Records (ADR)

Die technischen Entscheidungen dieses Projekts sind in den ADR-Dateien dokumentiert:
- `adr-001-express.md` - Express.js Framework
- `adr-002-multer.md` - Multer für File-Uploads
- `adr-003-node-iptc.md` - Node-IPTC für JPEG-Metadaten
- `adr-004-exiftool.md` - ExifTool für Metadaten-Extraktion

## 👨‍💻 Autor

Julian Schuller-Lingner

---

*Entwickelt im Rahmen des Moduls "Web Technologien" Sommersemester 2025*
