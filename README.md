# Steam Achiever

A desktop app for looking at your Steam achievements and, if you want, unlocking
or locking them by hand for games you own.

Everything runs on your own computer. It reads the achievement lists Steam
already stores locally and talks to the Steam client the same way a game does.

---

## Install it on Windows

1. Open the [Releases page](https://github.com/DanielSpasov/steam-achiever/releases).
2. Under the newest release, download **`Steam-Achiever-Setup-x.x.x.exe`**.
3. Double-click the downloaded file.
4. Windows shows a blue box that says **"Windows protected your PC"**. This is
   normal for any app that is not from the Microsoft Store. Click **More info**,
   then **Run anyway**.
5. Click through the installer. It adds a Start Menu entry and a desktop shortcut.
6. **Start Steam and sign in.** Then open Steam Achiever from the Start Menu.
7. The first launch shows a page explaining the risks. Read it, then click
   **I understand and accept the risks**.

If your antivirus flags it: the app is unsigned (no paid certificate), not
malware. Allow it, or do not run it if you are not comfortable.

### Mac

Download the `.dmg` (`-arm64` for Apple Silicon, `-x64` for Intel), drag the app
to Applications. First open: right-click the app, choose **Open**, then **Open**
again.

### Linux

Download the `.AppImage`, mark it executable (right-click, Properties,
Permissions), and double-click.

### Notes for everyone

- The Steam client must be **running and signed in** to change anything.
  Without it the app is view-only.
- It starts **read-only** every time. To make changes, click the **Read-only**
  button at the top and confirm.
- No Steam API key is needed. Setting one (in Settings) only adds playtime and
  achievement lists for games you own but have not installed.

---

## How to use it

- **Pick a game** on the left. You will see its achievements with an icon, a
  description, and a switch.
- The app opens **read-only**. To make changes, click **Read-only** in the top
  bar and confirm. It goes back to read-only every time you restart.
- Flip a switch to unlock or lock that achievement. It takes effect on your
  Steam account straight away. **Unlock all** and **Lock all** do the whole game.
- Use the **Filter** button to narrow the list, including a **Safe games only**
  option.

### Badges you will see

| Badge | Meaning |
| --- | --- |
| Installed / Not installed | Whether the game is on this computer |
| VAC | Uses Valve Anti-Cheat. The app will not touch these at all. |
| PvP / Online | An online-only game. Every achievement asks for confirmation. |
| Has PvP | Has online modes next to a single-player mode. |

---

## Can I get banned?

Short version: **VAC will not ban you for this**, but some individual games run
their own checks and a few have banned accounts for faking stats (Rust is the
known example). Achievements can also be wiped by games that check them online.

The app tries to keep you out of trouble:

- It refuses to touch VAC games and closes itself if you launch one.
- Online and PvP achievements need an extra confirmation.
- Nothing changes until you turn editing on and click something.

Safest use: single-player games only, and do not run it while playing anything
with anti-cheat. You are doing this to your own account at your own risk.

---

## Building and releasing (for the maintainer)

```bash
npm install
npm start          # run it from source
npm run dist       # build an installer for the current OS into release/
```

To publish installers for all three systems, push a version tag:

```bash
npm version patch        # bumps package.json and creates a git tag
git push --follow-tags
```

The GitHub Action in `.github/workflows/release.yml` then builds Windows, macOS
and Linux and attaches them to a GitHub Release for that tag. Nothing is code
signed, which is why users see the security prompts above.

---

## How it works

No Steam Web API key is needed for the basics. A key (optional, set in Settings)
adds exact ownership, playtime, and achievement lists for games Steam has not
cached locally.

| Source | Used for |
| --- | --- |
| `steamapps/appmanifest_*.acf` | installed games |
| `appcache/librarycache/` | owned games not installed here, and cover art |
| `appcache/appinfo.vdf` | names, VAC flag, online categories, image paths |
| `appcache/stats/UserGameStatsSchema_*.bin` | achievement names, text, icons |
| Steamworks API, via a small worker process | reading unlock state, applying changes |
| Steam Web API | full library and any missing achievement lists, if a key is set |

The Steamworks API only allows one game per process, so a short-lived worker
process is started for whichever game you are looking at.

### Project layout

```
src/            main process (Node)
  main.ts         window and app lifecycle
  ipc.ts          all the calls the window can make
  context.ts      shared state
  worker-pool.ts  starts and talks to the Steamworks worker
  worker.ts       the worker itself, one Steam connection at a time
  vac-guard.ts    quits the app when a VAC game starts
  settings.ts     settings.json
  steam/          reading Steam's local files and the Web API
renderer/         the window (HTML, CSS, TypeScript)
  ui/             built into renderer/app.js by esbuild
```

Only macOS has been tested so far; Windows and Linux paths are in place but
unverified.
