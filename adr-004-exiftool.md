# ADR 004: Erweiterung durch exiftool-vendored für RAW-Formate

**Entscheidungsinhaber:** Julian Schuller-Lingner

## Kontext
Zur Unterstützung von RAW-Bildformaten (z. B. NEF, DNG) soll zusätzlich ein Tool eingesetzt werden, das alle gängigen Metadatenstandards lesen kann.

## Entscheidung
**exiftool-vendored** wird zusätzlich verwendet, um Metadaten aus RAW-Formaten auszulesen.

## Überlegungen
**Pro:**
- Unterstützt eine Vielzahl von Formaten und Standards (IPTC, Exif, XMP)
- Besonders geeignet für RAW-Formate
- Portable Version (kein externes Installationssetup nötig)

**Contra:**
- Komplexere Anbindung über asynchrone Prozesse
- Etwas erhöhter Ressourcenverbrauch

## Begründung gegenüber Alternativen
- **sharp** eignet sich gut für einfache Bildverarbeitung, deckt Metadaten aber nur sehr begrenzt ab.
- **piexifjs** ist browserorientiert und nicht für Node.js oder RAW-Formate geeignet.
→ `exiftool-vendored` ist das robusteste Werkzeug mit umfassender Unterstützung und akzeptabler Integrationskomplexität.

## Konsequenzen
- Erweiterte Kompatibilität mit verschiedensten Bildformaten
- Einführung einer weiteren Abhängigkeit mit erhöhtem Pflegeaufwand
