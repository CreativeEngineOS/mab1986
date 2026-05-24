# Marketing & Distribution Execution

- [x] Automated 30-Second Trailer
  - Create `record_trailer.py` using `playwright`
  - Implement "Ghost Player" logic (hovering, clicking, advancing time, cycling tabs)
  - Output to `/Users/bastiaan/Desktop/MAB_1986_Trailer.webm`
- [x] Playable GitHub Web Trial
  - Clone/Create a local Git repo for distribution
  - Inject 5-game lock logic in `app.js` for the trial version
  - Add "Buy Full App" modal when lock is triggered
  - Push branch to `gh-pages` branch on GitHub `Creative_Engine_OS/mab1986` repository
- [x] Gamepad Home Menu Fix
  - Reprioritize the isMenuOpen check in pollGamepad before isSelectView
  - Reset menuSelectedIndex when opening menus to avoid visual offset
  - Update and push fixes to both main and gh-pages branches
