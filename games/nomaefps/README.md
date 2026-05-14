# NomaeFPS

This folder contains the attached Arena FPS project as `source/`.

The client source was adjusted for public static hosting:

- Vite uses relative asset paths.
- The menu includes an offline practice entry point.
- The full multiplayer mode still needs the WebSocket server in `source/server`.

Build client:

```bash
cd source/client
npm install
npm run build
```
