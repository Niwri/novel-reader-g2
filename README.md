# Novel Reader G2
Another EPUB reader on the Even Realities G2 platform, dedicated for webnovel readers. 

## Framework
React, Vite.js

## Relevant Libraries
- **EvenSDK** for storing persisted EPUB files and G2 display/input capabilities
- **Even-Toolkit** for simplifying the standard Even Realities G2 design guidelines 
- **JSZip** for parsing EPUB files

## Features to Add
- Adding novels via webnovel links, akin to [WebToEpub](https://github.com/dteviot/WebToEpub)
- Add voice assistant to navigate through novels

## Steps to run
1. `npm run dev`
2. `evenhub-simulator http://localhost:5174`
3. `evenhub qr --url "http://<YOUR-IPV4>:5174"`