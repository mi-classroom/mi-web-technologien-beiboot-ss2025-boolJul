# Implementierung eines Webservers für Bild-Uploads und IPTC-Metadatenbearbeitung

## Status
Proposed

## Kontext und Problemstellung
Im Rahmen eines studentischen Projekts soll ein Webserver entwickelt werden, der es ermöglicht:
- Bilder hochzuladen (z.B. JPEG, PNG)
- IPTC-Metadaten auszulesen und zu bearbeiten.

Die API soll zwei Hauptendpunkte bereitstellen:
- `GET /api/metadata/:imageId` (Metadaten lesen)
- `POST /api/metadata/:imageId` (Metadaten ändern)

Der Fokus liegt auf schneller Implementierung, Verständlichkeit, Wartbarkeit und Nutzung gängiger Technologien.

## Entscheidungsinhaber
Julian Schuller-Lingner

## Überlegungen

### Webserver-Framework: Express.js (Node.js)
**Pro:**
- Sehr weit verbreitet, große Community.
- Viele Tutorials und Dokumentation verfügbar.
- Flexibel und minimalistisch (nur die benötigten Funktionen müssen hinzugefügt werden).
- Einfach in bestehende Projekte integrierbar.

**Contra:**
- Manuelle Fehlerbehandlung notwendig.
- Weniger strikte Struktur als in größeren Frameworks (z.B. Django, NestJS).

**Begründung gegen Alternativen:**
Frameworks wie Django (Python) oder NestJS (Node.js) bieten umfangreichere Funktionen, erfordern aber eine steilere Einarbeitung.
Für die Zielsetzung des Projekts — schnelle Entwicklung einer schlanken API — ist Express.js besser geeignet.
Ein Frameworkwechsel hätte den zeitlichen Rahmen gesprengt, ohne wesentlichen Mehrwert für das Projekt zu bieten.

### Dateiupload: Multer
**Pro:**
- Speziell für Express entwickelt.
- Einfacher Umgang mit Formulardaten (multipart/form-data).
- Weit verbreitet, aktiv gepflegt.

**Contra:**
- Begrenzte Kontrolle bei komplexen Speicheranforderungen.
- Keine eingebaute Validierung von Dateiinhalten.

**Begründung gegen Alternativen:**
Alternativen wie `formidable` oder `busboy` bieten mehr Flexibilität, sind aber schwerer zu konfigurieren und für einfache Uploads unnötig komplex.

### IPTC-Datenbearbeitung: node-iptc
**Pro:**
- Direkter Zugriff auf IPTC-Metadaten über Buffers.
- Keine externen Kommandozeilentools erforderlich.
- Native Integration in Node.js-Umgebungen.

**Contra:**
- Begrenzte Unterstützung anderer Metadatenstandards (z.B. Exif, XMP).
- Geringere Dokumentation als größere Tools.

**Begründung gegen Alternativen:**
ExifTool bietet umfassendere Funktionen, hätte aber zusätzliche Prozesssteuerung (Child Processes) und komplexere Fehlerbehandlung erfordert.
Für IPTC-spezifische Anforderungen ist `node-iptc` einfacher und zielführender.

### Erweiterung: RAW-Formatunterstützung und ExifTool

**Zusätzliche Entscheidung:**
Zusätzlich zu `node-iptc` wird `exiftool-vendored` eingesetzt, um Metadaten aus RAW-Formaten (z.B. DNG, NEF) auszulesen.

**Pro:**
- ExifTool unterstützt EXIF, IPTC und XMP umfassend.
- Funktioniert mit nahezu allen Bildformaten, inklusive RAW.
- Portable Version, keine separate Systeminstallation notwendig.

**Contra:**
- Erhöhte Komplexität durch eine weitere Abhängigkeit.
- Leicht höherer Ressourcenverbrauch bei Metadatenleseoperationen.

**Begründung gegen Alternativen:**
Andere Bibliotheken wie `piexifjs` oder `sharp` decken entweder nicht alle Metadatenarten ab oder unterstützen RAW-Formate nicht umfassend.
ExifTool ist das De-facto-Standardwerkzeug und bietet die stabilste und breiteste Unterstützung.

## Entscheidung
- Webserver wird mit **Express.js** entwickelt.
- Dateiupload wird mit **Multer** umgesetzt.
- IPTC-Metadaten werden primär mit **node-iptc** bearbeitet.
- Zusätzlich wird **exiftool-vendored** genutzt, um Metadaten aus RAW-Formaten auszulesen.
- Bilder werden lokal auf dem Server abgelegt, organisiert nach eindeutiger Bild-ID.

## Konsequenzen
**Positiv:**
- Schnelle und einfache Umsetzung durch Node.js-Ökosystem.
- Erweiterte Unterstützung für Metadaten aus RAW-Formaten durch ExifTool.


**Negativ:**
- Lokale Speicherung ohne zusätzliche Backup- oder Recovery-Maßnahmen.
- Leicht erhöhter Aufwand bei der Pflege aufgrund der zusätzlichen Abhängigkeit von ExifTool.
