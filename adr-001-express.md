# ADR 001: Einsatz von Express.js als Webserver-Framework

**Entscheidungsinhaber:** Julian Schuller-Lingner

## Kontext
Im Rahmen eines Projekts soll eine REST-API für den Upload und die Metadatenbearbeitung von Bildern entwickelt werden. Die API soll einfach, schnell und verständlich implementierbar sein.

## Entscheidung
Der Webserver wird mit **Express.js** entwickelt.

## Überlegungen
**Pro:**
- Sehr weit verbreitetes Framework mit großer Community
- Viele Tutorials und Beispiele verfügbar
- Minimalistisch: nur benötigte Funktionen müssen hinzugefügt werden
- Gut integrierbar in bestehende Node.js-Projekte

**Contra:**
- Manuelle Fehlerbehandlung erforderlich
- Weniger strukturierter Aufbau im Vergleich zu z. B. NestJS

## Begründung gegenüber Alternativen
- **NestJS** (ebenfalls Node.js) bietet eine klarere Struktur und fortgeschrittene Features (z. B. Dependency Injection), würde aber mehr Einarbeitungszeit erfordern.
- **Django** (Python) ist ein vollwertiges Webframework mit ORM, Admininterface usw., jedoch nicht Teil des bestehenden Node.js-Stacks und unnötig komplex für dieses Projekt.

## Konsequenzen
- Schnelle Umsetzung möglich
- Lernaufwand gering
- Ggf. wachsender organisatorischer Aufwand bei steigender Komplexität des Projekts
