# Throw Nerd Online

> A simplified, browser-based darts scoring app. Fast setup, clean scoring, mobile-ready.  
> **Live game types: 301 · 501 · Cricket (Standard & Cut-Throat)**

---

## What Is This?

**Throw Nerd Online** is a streamlined fork of [throw-nerd](https://github.com/mattcallaway/throw-nerd), rebuilt from scratch as a pure web app.

The original is a Flutter/Android app with SQLite, Firebase, player profiles, career stats, league management, and cloud sync. This version strips all of that out and focuses on one thing: **being an excellent in-browser darts scorer** you can use right now on any device.

### Derived From

| | |
|---|---|
| **Source repo** | https://github.com/mattcallaway/throw-nerd |
| **Source commit** | `776c08610ba07ba264eef92e60535bf9996de9c9` |
| **Preserved** | Core X01 + Cricket game engine logic (ported Dart → JavaScript) |

---

## What Was Removed

| Removed | Reason |
|---|---|
| Flutter / Dart mobile app | Not browser-compatible |
| SQLite / Drift database | No backend needed |
| Firebase (Auth, Firestore, Storage) | Unnecessary for session-based play |
| Player profiles & career stats | Out of scope for fast casual play |
| Head-to-head history & analytics | Complexity without casual benefit |
| League / season management | Heavy feature, separate concern |
| fl_chart, Riverpod, Freezed | Flutter-only dependencies |
| Android build system | Not needed for web |

---

## What Was Kept / Added

| Feature | Notes |
|---|---|
| X01 engine (301/501) | Ported from Dart, bust logic intact |
| Cricket engine | Standard + Cut-Throat mode |
| Double-out toggle | Optional for X01 |
| Undo last turn | Both game modes |
| LocalStorage save | Auto-saves; survives refresh |
| Dark neon scoreboard UI | Designed for readability at distance |
| Responsive layout | Works on phones, tablets, desktops |
| PWA support | Installable from browser, works offline |

---

## Feature Scope

### Game Modes
- **X01**: 301 or 501 with optional Double Out
- **Cricket**: Standard or Cut-Throat

### Players
- 1–4 players, named on setup

### X01 Scoring
- Enter 3-dart total per turn
- Quick-score buttons for common scores
- Bust detection with clear feedback
- Remaining score shown prominently

### Cricket Scoring
- Tap ×1, ×2, or ×3 for each target number
- Marks displayed as `/`, `✕`, `⊗` (closed)
- Points calculated per standard rules
- Win: all numbers closed + best score

---

## Local Development

No build step required. Just open the file or serve it with any static server.

```bash
# Option 1: Open directly
start index.html   # Windows
open index.html    # macOS

# Option 2: Serve with npx (no install needed)
npx http-server . -p 3000 -o
# Then open http://localhost:3000

# Option 3: Python
python -m http.server 3000
```

> **Note**: The service worker (PWA) requires serving over HTTP/HTTPS, not `file://`.

---

## Deployment on Linode (Ubuntu + Nginx)

### 1. Provision & Install

```bash
# SSH into your Linode server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Nginx
apt install nginx -y
```

### 2. Deploy the App

```bash
# Clone the repo
git clone https://github.com/mattcallaway/throw-nerd-online /var/www/throw-nerd-online

# Set permissions
chown -R www-data:www-data /var/www/throw-nerd-online
chmod -R 755 /var/www/throw-nerd-online
```

### 3. Configure Nginx

```bash
# Copy the included config
cp /var/www/throw-nerd-online/nginx.conf /etc/nginx/sites-available/throw-nerd

# Edit the server_name line to match your domain or IP
nano /etc/nginx/sites-available/throw-nerd

# Enable site
ln -s /etc/nginx/sites-available/throw-nerd /etc/nginx/sites-enabled/

# Remove default site (optional)
rm /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
```

### 4. HTTPS with Let's Encrypt (Recommended)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

Certbot will update the nginx config automatically. Set up auto-renewal:

```bash
systemctl enable certbot.timer
```

### 5. Updating

```bash
cd /var/www/throw-nerd-online
git pull origin main
# No build step needed — Nginx serves updated files immediately
```

**No Node.js process, no systemd service, no port to manage.** Pure static files.

---

## Project Structure

```
throw-nerd-online/
├── index.html          # App shell, all screens
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline cache)
├── nginx.conf          # Nginx deployment config
├── css/
│   └── style.css       # Dark neon scoreboard theme
└── js/
    ├── models.js        # GameConfig, Dart, Turn (ported from Dart)
    ├── x01Engine.js     # X01 scoring engine (ported from Dart)
    ├── cricketEngine.js # Cricket scoring engine (ported from Dart)
    └── app.js           # UI controller, routing, localStorage
```

---

## Known Limitations

- **X01 uses turn-total input** — You enter 1–3 dart total per turn, not dart-by-dart. This is intentional for speed, but means dart-by-dart stats are not available.
- **No server-side persistence** — Match state lives in browser `localStorage`. Clearing browser data or switching devices loses the match.
- **Double-in not implemented** — Double Out is supported; Double In is not in the MVP.
- **No icons included** — Replace `icons/icon-192.png` and `icons/icon-512.png` for full PWA icon support.
- **No set tracking** — Legs only. Set-based match tracking is not included.

---

## Recommended Next Steps (Post-MVP)

These are not included but make sense as follow-ups:

1. **Dart-by-dart input** — Better for stats; adds per-dart average tracking
2. **Set support** — Track sets + legs per match
3. **Simple match history** — LocalStorage log of completed matches
4. **Sound effects** — Bust clunk, win fanfare, dart hit ticks
5. **Custom icons** — Design a proper 🎯 icon set for PWA installability
6. **QR code join** — Multi-device score display (one tablet as scoreboard)

---

## License

MIT — do whatever you want with it.
