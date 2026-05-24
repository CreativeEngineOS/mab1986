# MAB 1986 Baseball Season Manager Update

The latest version of the app has been fully updated and packaged for you! Here is a summary of everything that was accomplished in this sprint.

## Title & Menu Updates
- The application natively reads as **MAB 1986** on the home screen and window bar.
- The `README.md` documentation has been updated to reflect the new **MAB 1986 Baseball Season Manager** name.
- The main dropdown menu (with Help and About) is now accessible directly from the home screen upon launch.

## 8-Bit Styling
- The game status labels (`PRE-GAME`, `IN PROGRESS`, `FINAL`) now feature a jagged, classic 8-bit arcade font.
- The glowing shadow has been removed from the timeline nodes to give them a flatter, more retro aesthetic.
- The franchise name in the top dashboard navigator now displays in the team's primary color with a crisp 1px white border.

## Authentic Tick-Up Counter
- When you click "PLAY GAME," the scores no longer simply count up by 1. Instead, they tick up in random bursts of `0`, `1`, or `2` runs per interval to accurately simulate random innings and tally counts! The final score will always match the exact historical data.

## 🏆 Double-Elimination Post-Season Engine
A massive new architectural engine has been added to the game!

- **The PS Node**: At the end of your 14-game timeline, a new `PS` button appears.
- **Bracket Generation**: Clicking the `PS` button instantly transforms your timeline track into a 19-game **Post-Season Bracket**. The engine automatically sorts the 10 franchises based on their regular season records and Elo tiebreakers, assigning them seeds 1 through 10.
- **Auto-Populating Games**: The engine maps the 19 playoff games exactly to your Double Elimination document. As you input scores for playoff games (even ones your franchise isn't playing in), the engine calculates the winners and losers and automatically injects them into future slots (e.g., winning Game 1 automatically pushes a team into Game 5).
- **Game 19 Rule**: The engine intelligently tracks Game 18. If the Winner's Bracket team wins Game 18, Game 19 is automatically wiped from the schedule.
- **The Championship**: Once the final game concludes, the app will instantly pop up a massive 8-bit Championship screen declaring the ultimate victor!

> [!TIP]
> The Post-Season bracket dynamically updates your team's Elo rating as you input scores. If you use the Dashboard tabs (Elo Trend, PF vs PA), you can actively monitor the power shifts of the entire league throughout the playoffs!

## 🚀 Marketing & Distribution Release

### 1. Playable Web Trial
- The **Playable Web Trial** is officially live at [https://CreativeEngineOS.github.io/mab1986](https://CreativeEngineOS.github.io/mab1986)!
- It has a built-in **5-game trial limit** for the regular season, after which it prompts the user to download the full Mac App to play the complete 14-game season and double-elimination post-season.
- Switched your local codebase back to the `main` branch to ensure that your local desktop/Mac App installation remains **completely unlocked**.

### 2. Automated 30-Second Trailer Video
- An automated ghost-player walkthrough recording has been generated via Playwright.
- The exported video file is saved at `/Users/bastiaan/Desktop/MAB_1986_Trailer.webm`.
- It demonstrates gameplay by choosing a team, simulating a couple of games, cycling through all dashboard tabs (Elo Trend, Pythagorean %, PF vs PA, etc.), and advancing the timeline.

### 3. 🎮 Gamepad Home Menu Fix
- Fixed the gamepad menu navigation on the home/team selection screen.
- Reprioritized input checks in the polling loop so that when the Home Menu is opened, the controller immediately focuses on menu items rather than selecting teams on the grid.
- Reset the active index highlight when opening menus to ensure smooth, clean menu-item selection.
- Commits with this fix have been successfully pushed to both the `main` (desktop) and `gh-pages` (web trial) remote branches on GitHub.
