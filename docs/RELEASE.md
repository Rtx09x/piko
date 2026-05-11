# Release Notes: Piko 0.3.0

Piko 0.3.0 adds a lightweight three-goal focus stack.

## Highlights

- Set a goal and keep it visible in the popup.
- Keep up to three active goals at once.
- Focus, complete, and drop goals from chat or the popup.
- Chat with Piko using Gemini.
- Receive gentle browser nudges based on tab switching, likely distraction loops, and active goal age.
- Store finite local memory that compacts when it gets full.
- Personalize your name, preferences, tone, and Piko's personality.
- Give nudge feedback so Piko can learn what helps and what feels like too much.
- Use companion commands: `/done`, `/remember`, `/think`, `/idea`, and `/search`.
- Use goal commands: `/goals`, `/focus 2`, `/done 1`, and `/drop 3`.
- Put Piko to sleep for 20 minutes, 1 hour, or with `/sleep`.
- Wake Piko with `/wake`.
- Keep data local by default.
- Import recent browser history only after granting optional History permission.

## Install From Source

1. Download the release ZIP or clone the repository.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the extension folder.

## Status

Implemented, syntax-checked, and locally smoke-tested by unpacked extension use.

Chrome Web Store submission is not included in this release because it requires a paid Chrome Web Store developer account.
