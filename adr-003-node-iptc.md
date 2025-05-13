# ADR 003: Einsatz von node-iptc zur IPTC-Bearbeitung

**Entscheidungsinhaber:** Julian Schuller-Lingner

## Kontext
Die API soll das Auslesen und Bearbeiten von IPTC-Metadaten ermöglichen.

## Entscheidung
Es wird **node-iptc** zur Bearbeitung von IPTC-Metadaten eingesetzt.

## Überlegungen
**Pro:**
- Zugriff auf IPTC-Daten direkt über Buffer
- Keine externen Kommandozeilentools nötig
- Gute Integration in Node.js-Anwendungen

**Contra:**
- Keine Unterstützung für andere Standards wie Exif oder XMP
- Weniger Dokumentation und Community

## Begründung gegenüber Alternativen
- **ExifTool** unterstützt viele Metadatenstandards und Formate, ist jedoch ein Kommandozeilentool. Die Integration in Node.js erfolgt über Child-Prozesse, was zusätzliche Fehlerquellen und Entwicklungsaufwand bedeutet.
- **piexifjs** oder **sharp** unterstützen entweder IPTC nicht oder sind auf andere Formate (z. B. nur JPEG) begrenzt.
→ Für die Bearbeitung von IPTC allein ist `node-iptc` einfacher und effizienter einzubinden.

## Konsequenzen
- Leichtgewichtige Lösung für IPTC-spezifische Anforderungen
- Erweiterungen auf weitere Standards (z. B. Exif) erfordern zusätzliche Tools
