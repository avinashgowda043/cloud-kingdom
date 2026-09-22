# Cloud Kingdom

**Cloud Kingdom** is an original, browser-based 3D platformer built with [Three.js](https://threejs.org/)
and [Vite](https://vite.dev/). Guide **Pip**, a small sky sprite, across floating islands, collect sky
coins, bounce on Blorbs, dodge thorn orbs and reach the Sky Gate.

Everything you see is generated procedurally from code — original characters, geometry, colours and
sound. No third-party, paid, or copyrighted game assets are used.

## Gameplay

- **Goal:** reach the glowing Sky Gate at the end of the course.
- **Sky coins:** 24 coins are scattered along the route; they add to your end-of-run score.
- **Blorbs:** purple hoppers. Land on top of one to bounce off it — touching one from the side sends
  you back to your last checkpoint.
- **Thorn orbs:** spiky hazards that always hurt. Time your jumps around them.
- **Flags:** touch a checkpoint flag to save your progress; falling off the islands returns you there.
- **Scoring:** coins add points, a time bonus rewards a quick run, and each fall costs points. The best
  score is stored locally in your browser (and silently skipped if storage is unavailable).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `W` `A` `S` `D` or arrow keys | Left analogue stick |
| Jump / double jump | `Space` (press again in mid-air) | Right **Jump** button |
| Pause / resume | `P` or `Esc` | Pause button in the HUD |
| Sound on/off | Sound button in the HUD | Sound button in the HUD |

Tips: jumps are height-sensitive — tap for a hop, hold for a full jump. Short "coyote time" and jump
buffering make edge jumps forgiving.

## Run it locally

Requires Node.js 22.12 or newer (the pinned Vite and Vitest versions need it).

```bash
npm install     # install dependencies
npm run dev     # start the dev server (http://localhost:5173)
npm test        # run the gameplay unit tests
npm run build   # production build into dist/
npm run preview # preview the production build locally
```

> The production build uses the base path `/cloud-kingdom/`, so `npm run preview` serves the game at
> `http://localhost:4173/cloud-kingdom/`. The dev server uses `/`.

## Project structure

```
index.html            page shell, HUD and menus
src/main.js           bootstrap, game loop, UI wiring
src/style.css         responsive, accessible UI styling
src/game/config.js    tunable gameplay constants
src/game/physics.js   pure movement, gravity and collision helpers
src/game/state.js     coins, checkpoints, enemies, hazards, win/respawn rules
src/game/level.js     the level layout as plain data
src/game/world.js     Three.js scene, lighting, sky and animation
src/game/character.js procedural model of Pip, the hero
src/game/input.js     keyboard + touch input
src/game/audio.js     procedural Web Audio sound effects
src/game/storage.js   optional local best-score storage
tests/                unit tests for the pure gameplay logic
```

The gameplay rules are deliberately separated from rendering so they can be unit tested in Node
without a browser.

## Deploying to GitHub Pages

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site with
the official `actions/upload-pages-artifact` and `actions/deploy-pages` actions and runs on every push
to `main` (and on demand via *Run workflow*). It requests only the minimum permissions: read access to
the repository for the build job and `pages: write` / `id-token: write` for the deploy job.

To enable publishing:

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the *Deploy to GitHub Pages* workflow manually) and wait for it to finish.

**Prerequisites and caveats**

- This repository is currently **private**. GitHub Pages for private repositories is only available on
  certain GitHub plans; on other plans you need to make the repository public before Pages can serve
  the site. Check **Settings → Pages** for the exact message shown for your account — the repository's
  visibility has intentionally not been changed here.
- Once Pages is enabled and the workflow has completed successfully, the game is expected to be
  available at **`https://avinashgowda043.github.io/cloud-kingdom/`** (expected URL — it only works
  after a successful deployment). That is the link you can share with friends.
- The build is configured for that exact path. If you rename the repository or deploy elsewhere,
  update `base` in `vite.config.js`.
- No deployment has been verified from this branch; nothing is claimed to be live yet.

## Accessibility and compatibility

- Keyboard-only play is fully supported; menus and HUD controls are real buttons with labels and
  visible focus outlines.
- Touch controls appear automatically on coarse-pointer devices, and the layout adapts to small
  screens and safe areas (notches).
- `prefers-reduced-motion` reduces decorative animation (spinning coins, drifting clouds, sparkle
  bursts, idle bobbing).
- Audio is procedural and is only created after the first user interaction, so it never autoplays; it
  can be muted at any time and is skipped entirely if the Web Audio API is unavailable.
- A clear message is displayed if JavaScript or WebGL is not available.

## Limitations

- Single-player only, and a single (fairly compact) level — there is no backend and no multiplayer.
  "Sharing with friends" means sharing the hosted URL above.
- Local best-score storage is per-browser and best-effort; it is ignored if storage is blocked.
- The Three.js bundle is around 550 kB (≈140 kB gzipped), so the first load needs a moment on slow
  connections.
- Automated tests cover the pure gameplay logic (physics, collisions, scoring, level rules). Rendering
  was verified manually with a headless Chromium smoke test; there is no automated visual regression
  testing.

## Licence

Code and generated art in this repository are original work by the repository owner.
