# Nomae Games

A browser game project with a direct homepage redirect to the NomaeFPS shooter,
plus legacy mini-game code and an attached Arena FPS source tree.

## Run locally

Open `index.html` in a browser, or serve the folder with any static file server.

## Games

- Reaction Dash - wait for the signal and tap as fast as possible.
- Memory Grid - repeat the flashing pattern as it grows each round.
- NomaeFPS - attached Arena FPS source in `games/nomaefps/source`.

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

Do not commit real Firebase config, private keys, API secrets, or local `.env`
files. Keep production credentials in the hosting provider dashboard.

## Structure

- `index.html` - page content and sections
- `styles.css` - responsive arcade UI styling
- `script.js` - playable placeholder games, local lobby, and score interactions
- `games/nomaefps/` - attached FPS game source and launcher page


## Multiplayer plan (NomaeFPS)

1. **Networking model (authoritative server)**
   - Keep server-authoritative hit validation and movement reconciliation in `games/nomaefps/source/server`.
   - Move projectile, cooldown, reload, and health truth entirely server-side.

2. **Matchmaking + rooms**
   - Add quick-play queue plus private room codes.
   - Keep room metadata in Firebase (or Redis) and hand active matches to Node room workers.

3. **Tick/state protocol**
   - Ship compact snapshot deltas at 20–30 Hz with interpolation buffers client-side.
   - Keep full server simulation at 60 Hz for hit precision.

4. **Anti-cheat + fairness**
   - Validate fire-rate, angle deltas, movement caps, and impossible jumps on server.
   - Add lag compensation window for hitscan so high-ping users can still register valid shots.

5. **Scale + deployment**
   - Start with one regional server, then add region selection (NA/EU/AP).
   - Add health checks, room autoscaling, and crash-safe room handoff.

6. **Roadmap milestones**
   - Milestone 1: 1v1 private rooms + scoreboard + reconnect.
   - Milestone 2: 4–8 player public queue + map rotation.
   - Milestone 3: party system + ranked ladder + seasonal stats.
