# Nomae Games

A static HTML game hub for Nomae Games with a multiplayer-ready lobby surface.

## Run locally

Open `index.html` in a browser, or serve the folder with any static file server.

## Deploy

This project has no build step. It can be deployed to GitHub Pages, Netlify,
Vercel, Cloudflare Pages, or any static host by publishing the repository root.

## Recommended free hosting

Use GitHub Pages for the website:

1. Open the repository settings on GitHub.
2. Go to Pages.
3. Set the source to `Deploy from a branch`.
4. Pick `main` and `/root`.
5. Save.

Use Firebase Spark plan for multiplayer:

- Anonymous Authentication for player sessions.
- Realtime Database for rooms, player presence, and score sync.
- Security rules that only let players write to their own room/player record.

This keeps the frontend free and static while still allowing live multiplayer.
If games later need authoritative low-latency server logic, move those specific
games to Cloudflare Pages plus Durable Objects.

Suggested Firebase data shape:

```json
{
  "rooms": {
    "ABCD": {
      "game": "Reaction Dash",
      "status": "waiting",
      "players": {
        "uid_1": { "name": "Nomae", "score": 0, "online": true }
      }
    }
  },
  "leaderboards": {
    "reaction-dash": {
      "uid_1": { "name": "Nomae", "score": 9820 }
    }
  }
}
```

## Structure

- `index.html` - page content and sections
- `styles.css` - responsive arcade UI styling
- `script.js` - lightweight local lobby and score interactions
