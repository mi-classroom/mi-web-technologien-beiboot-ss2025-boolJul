# ADR 002: Nutzung von Multer für Datei-Uploads

**Entscheidungsinhaber:** Julian Schuller-Lingner

## Kontext
Der Webserver soll Bild-Uploads über HTTP entgegennehmen und diese serverseitig verarbeiten können.

## Entscheidung
Für den Dateiupload wird **Multer** als Middleware verwendet.

## Überlegungen
**Pro:**
- Speziell für Express.js entwickelt
- Einfache Handhabung von `multipart/form-data`
- Gut dokumentiert und aktiv gepflegt

**Contra:**
- Weniger Kontrolle über komplexe Speicher- oder Validierungslogik
- Keine eingebaute Validierung der Dateiinhalte

## Begründung gegenüber Alternativen
- **formidable** und **busboy** bieten mehr Flexibilität und Kontrolle, z. B. bei großen Datei-Streams oder komplexer Validierung.
  Diese zusätzlichen Features sind im Projekt jedoch nicht erforderlich und erhöhen nur die Komplexität.
- Multer ist für einfache Uploads schneller einsatzbereit und leichter zu konfigurieren.

## Konsequenzen
- Einfache, wartbare Lösung für Standard-Uploads
- Bei komplexeren Anforderungen ggf. späterer Wechsel notwendig
