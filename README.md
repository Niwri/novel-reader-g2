# Novel Reader G2

Another EPUB reader on the Even Realities G2 platform, dedicated for webnovel readers.

## Framework

React, Vite.js

## Relevant Libraries

- **EvenSDK** for storing persisting EPUB files and G2 display/input capabilities
- **Even-Toolkit** for simplifying the standard Even Realities G2 design guidelines on webview.
- **JSZip** for parsing EPUB files

## Current Notable Features

- Unlimited scrolling during reading. The text container updates as you scroll without breaking the flow (In other words, no sudden changes in text as it updates).
- Continue reading where you left off
- Add novels via EPUB files on your phone storage

## Features to Add

- Adding novels via webnovel links, akin to [WebToEpub](https://github.com/dteviot/WebToEpub)
- Add voice assistant to navigate through novels

## Steps to run (for developer use)

1. `npm run dev`
2. `evenhub-simulator http://localhost:5174`
3. `evenhub qr --url "http://<YOUR-IPV4>:5174"`

## Steps to build (for developer use)

1. `npm run build`
2. `evenhub pack app.json dist -o myapp.ehpk`
