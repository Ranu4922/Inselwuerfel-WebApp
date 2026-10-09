# Inselwürfel – CATAN Würfelbegleiter (inoffizielle Fan-App)

Installierbare Web-App (PWA) für iPhone, Android und PC. Grundspiel/Seefahrer: **zwei Zahlenwürfel**. Städte & Ritter: **roter, weißer Zahlenwürfel + Ereigniswürfel** (3× Schiff, 1× grünes Stadttor, 1× blaues Stadttor, 1× gelbes Stadttor).

## Was schon funktioniert

- Responsives Handy-Layout mit Startseite, Spielmodi, Lobby, Würfelansicht
- Offline-Partie ohne Server oder Internet; Spielstand im Browser gespeichert
- Direkter Online-Multiplayer für maximal 2–6 Teilnehmer über PeerJS + WebRTC: Gastgeber-Code, Teilnehmer sehen synchronisierte Würfe, gemeinsamen Verlauf und Statistiken
- Unabhängige faire Würfel durch Crypto API; bei 3 Würfeln Summe nur aus zwei Zahlenwürfeln
- Barbaren rücken automatisch bei Schiffssymbolen auf einer Strecke von 7 Schritten vor. Am Ende gibt es einen Angriffshinweis. Nach Abwicklung setzt der Host zurück.
- Würfelhistorie, Gesamt- und pro-Spieler-Statistik, Ereignisverteilung, Undo des letzten Wurfs, PWA-Installation.

## Öffnen und ausprobieren

Wegen Service Worker und Browser-Sicherheitsregeln die Dateien von einem lokalen Server aus öffnen (nicht per Doppelklick `file://`):

```bash
cd catan_wuerfel_webapp
python -m http.server 8000
```

Danach `http://localhost:8000` öffnen und **Offline ausprobieren** wählen. Alternativ die App als statische Website auf GitHub Pages / Netlify / Cloudflare Pages veröffentlichen. Für eine installierbare PWA auf anderen Geräten ist HTTPS erforderlich. Alle Dateien im Verzeichnis müssen mit veröffentlicht werden.

### Kostenlos auf GitHub Pages veröffentlichen

1. Neues GitHub-Repository erstellen, `Inselwuerfel-WebApp` (öffentlich).
2. Inhalt **dieses Verzeichnisses** in das Repository hochladen (`index.html` muss im Hauptverzeichnis liegen).
3. GitHub → Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.
4. GitHub zeigt danach den HTTPS-Link `https://ranu4922.github.io/Inselwuerfel-WebApp/` (kann nach dem Veröffentlichen kurz dauern).
5. Link auf allen Handys öffnen. iPhone: Safari → Teilen → Zum Home-Bildschirm. Android: Chrome-Menü → App installieren.

## Wie Online-Multiplayer funktioniert

- Browser lädt nur für Online-Partien die JavaScript-Bibliothek `peerjs@1.5.5` von jsDelivr (Fallback unpkg). Die öffentliche **PeerServer Cloud** vermittelt WebRTC-Verbindungen. Die Datenübertragung zwischen den Geräten erfolgt direkt und verschlüsselt.
- Host besitzt die autoritative Partiestatus-Kopie. Er erzeugt alle Würfe und verteilt den neuen Stand an alle verbundenen Teilnehmer. Gäste schicken nur Würfel-Anfragen.
- Gäste treten mit vierstelligem Raumcode bei, z. B. `7KQ3`. Während einer Partie muss die Web-App des Hosts erreichbar bleiben.
- Bei eingeschränkten Netzwerken/NAT-Konstellationen können Verbindungen mit öffentlichem STUN scheitern. Für einen zuverlässigen dauerhaften Betrieb empfiehlt sich später eine eigene Echtzeit-Datenbank oder ein eigener Signalisierungs-/TURN-Dienst.
- Es gibt **keinen dauerhaft laufenden Spielserver**: Wenn der Host sein Gerät schließt oder iOS die App im Hintergrund pausiert, werden Gäste getrennt. Wiederaufnahme über „Letztes Spiel fortsetzen“; bisherige Daten liegen beim Host lokal im Browser. Bei gelöschten Browserdaten geht das Spiel verloren.
- PeerJS Cloud und externe CDNs sind unabhängige Drittanbieter. Die Online-Funktion benötigt Internet und deren Erreichbarkeit.

## Quellen zu den Würfelregeln

- CATAN Städte & Ritter Anleitung: https://www.catan.de/sites/default/files/2025-01/CATAN_St%C3%A4dte%20und%20Ritter_Anleitung_E1.pdf
- CATAN Städte & Ritter: https://www.catan.com/cities-knights
- PeerJS Cloud: https://peerjs.com/server/cloud

## Technisches

HTML/CSS/JavaScript ohne Buildprozess, PWA-Manifest, Service Worker. `core.js` enthält die vom UI unabhängige Spiel- und Würfellogik. Tests: `node --test tests/core.test.cjs`.

Keine offizielle CATAN App; keine lizenzierten Bilder oder Logos werden verwendet. CATAN ist Marke der jeweiligen Rechteinhaber.