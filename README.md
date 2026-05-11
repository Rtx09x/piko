# Piko

Piko is a tiny focus companion for Chrome.

Set a goal, browse normally, and Piko gives gentle nudges when your tabs start drifting away from what you meant to do.

## Features

- Three active goals with a primary focus
- Goal-based focus nudges
- Small page overlay
- Gemini-powered chat
- Finite local memory with compaction
- Personalization for your name, preferences, and Piko's personality
- Local browser activity context
- Sleep and wake controls
- Nudge feedback so Piko can back off or learn what helps
- Optional recent history import
- Allowed and blocked domain controls
- Local-first settings and activity storage

## Install

Download the latest ZIP from [Releases](https://github.com/Rtx09x/piko/releases), then load it in Chrome:

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the unzipped Piko folder

## Gemini

Piko uses your own Gemini API key.

Open Piko settings, paste the key, and save. The default model is:

```text
gemini-2.5-flash
```

Without a Gemini key, Piko can still show simple fallback nudges.

## Commands

Use these in Piko chat:

```text
/goal write the report
/goal research UI components
/goals
/focus 2
/done 1
/drop 3
/goal
/sleep
/sleep 20
/wake
/done
/remember short nudges are best
/think how should I structure this feature
/idea UI polish
/search Chrome extension screenshots
```

## Privacy

Piko does not keylog and does not read full page text.

By default, Piko stores local browser context such as:

- page titles
- domains
- visit duration
- tab switching

Full URLs are stored only if you enable URL storage in settings.

Recent browser history import is optional and only runs after you grant Chrome History permission.

See [PRIVACY.md](./PRIVACY.md) for the full policy.

## License

MIT
