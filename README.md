# ♞ Gambit Quest

A chess RPG for the browser. You start with five pawns on a tiny 5×5 board, beat easy enemies to earn coins,
recruit knights, bishops and queens, and work your way through five realms to the Dragon Queen.

Built with Vite, React and TypeScript. It is a static site (GitHub Pages), with Google sign-in and cloud
saves through Firebase.

## Features

- **Campaign:** 5 realms with 10 stages each; stage 10 is the boss. Boards grow from 5×5 to 8×8, and the AI gets stronger as you go.
- **Bonus stages:** each realm has 2 extra stages, unlocked by stars earned in its 10 main stages. The first needs 27 of 30 stars, the second all 30.
- **Economy:** you get coins for each enemy piece you capture (stronger pieces give more), for hitting a boss,
  for promoting a pawn and for winning. The first win on a stage pays double.
- **Shop:** 9 piece types. Besides the classic pieces there are fairy pieces: Warden, Cardinal (Bishop+Knight),
  Marshal (Rook+Knight) and Amazon (Queen+Knight). Each one unlocks after you clear a certain stage.
- **Buy or hire:** a piece you buy is yours forever. Even if it is captured, it comes back after the battle. A
  hired mercenary costs about a quarter of the price but leaves after one battle. You can own any number of each
  piece.
- **Leadership:** command points that limit how big an army you can deploy. Upgrading it is the main long-term
  coin sink.
- **Deployment:** before each fight you place pieces from your army in your rows of the board. You can
  auto-deploy, reuse your last formation, and tap enemies to see how they move.
- **Bosses** take up 2×2 squares and have HP. Attacking a boss deals damage, and the attacking piece stays where
  it is. Bosses crush pieces they land on, summon minions, and warn you one turn before an area attack
  (quake, fire breath).
- **Move hints** for your pieces and enemy scouting. You can turn both off in Settings.
- **Endless Arena:** generated battles with growing rewards, and a boss every 5 levels.
- **Stars:** ★ for a win, ★★ if you lost at most one piece, ★★★ if you lost none.
- Pawns that reach the last row become Queens for the rest of the battle.
- Synthesized sound effects, animations, and a layout that works on phones.

### Rules

- You win by capturing every enemy piece. On boss stages you win by killing the boss.
- Every stage has a turn limit. When it runs out, the side with more material wins. On boss stages, running out
  of time is a loss.
- There are no kings and no check. The Warden moves like a king, but losing it does not lose the game.
- If you have no legal move, you pass. If both sides pass in a row, the battle ends and is decided on points.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine/AI/stage-data tests (vitest)
npm run build      # typecheck + production build into dist/
```

Without Firebase settings the game still runs, with guest mode only (saves stay in the browser).

## Firebase setup (Google login + cloud saves)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method →** enable **Google**.
3. **Authentication → Settings → Authorized domains →** add `<your-github-user>.github.io` (`localhost` is
   already there).
4. **Firestore Database →** create a database (production mode). Then open **Rules**, paste the contents of
   [`firestore.rules`](firestore.rules) and publish.
5. **Project settings → Your apps →** add a **Web app** and copy its config values.
6. For local development, copy `.env.example` to `.env.local` and fill in the values.

The Firebase web config is not a secret. Access to the saves is protected by `firestore.rules`: each user can
only read and write `saves/{their uid}`.

## Deploy to GitHub Pages

1. Push this repo to GitHub on the `main` branch.
2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables tab:** add these four repository variables:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
4. Push again, or run the **Deploy to GitHub Pages** workflow by hand. The game is published at
   `https://<user>.github.io/<repo>/`.

The workflow is in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It runs the tests, builds the
site and deploys it.

## Project structure

```
src/
  game/            pure game logic (no React)
    types.ts       shared types
    pieces.ts      piece definitions: movement, prices, command cost
    bosses.ts      boss definitions and abilities
    engine.ts      board state, move generation, rules, boss abilities
    ai.ts          negamax + alpha-beta + quiescence; difficulty = depth/blunder/noise
    ai.worker.ts   runs the AI off the main thread
    campaign.ts    realms, stages, unlocks, Endless Arena generator
    economy.ts     loot, rewards, stars, leadership prices
  state/
    store.ts       app state (zustand), auth flow, local + cloud persistence
    save.ts        save format + migration
    actions.ts     buy / revive / deploy / finish battle
    firebase.ts    Google auth + Firestore
  components/      Board, pieces, top bar, modals
  screens/         Login, Campaign, Arena, Shop, Barracks, Deploy, Battle
```

### Balancing

All the numbers are in a few files:

- Piece prices and command costs: `src/game/pieces.ts`
- Stage rewards, AI strength and layouts: `src/game/campaign.ts`
- Leadership prices and loot formulas: `src/game/economy.ts`

Stages are defined per realm in the `WORLDS` table in `campaign.ts`. Layouts are plain strings, one per row from the top: `p n b w r q c m a` are enemy pieces, `#` is a rock
and `.` is an empty square.

## Ideas for next steps

- **Veterans:** pieces that survive battles gain ranks and perks (for example, a veteran pawn can always move two
  squares).
- **Relics:** passive items dropped by bosses, such as a free first move, a shield that saves the first fallen
  pawn, or +10% loot.
- **More terrain:** water (only knights can cross), forests (stop sliding pieces) and shrines (promotion squares
  in the middle of the board).
- **Daily challenge:** a fixed army against a fixed puzzle, with a leaderboard in Firestore.
- **Achievements and cosmetic piece skins** to give coins another use.
- **Asynchronous PvP:** save your formation as a "ghost army" that other players fight.
- **Server-side checks** with Cloud Functions. Coins are currently trusted from the client, which is fine for a
  single-player game but not for leaderboards.
