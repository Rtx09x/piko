# Piko Product Plan

## Thesis

Piko is a small browser companion that nudges the user back toward their current goal using consented browser context. The first product loop is intentionally simple: set a goal, let Piko observe tab-level signals, receive a gentle nudge when drift patterns show up, and optionally chat for a reset.

## V1 scope

Implemented as a Chrome Manifest V3 extension.

| Area | V1 behavior |
|---|---|
| Goal | User sets a goal in the popup or with `/goal ...` |
| Context | Active tab title, domain, visit duration, tab switching, optional rough history import |
| AI | Gemini REST only, via `generateContent` |
| Nudges | Rule-triggered with variable timing; Gemini writes wording when configured |
| Chat | Popup chat with local context and slash commands |
| Privacy | Local storage, blocked domains, allowed domains, no full-page scraping |
| Sleep | `/sleep`, `/sleep 20`, `/wake`, plus popup sleep controls |

## Product rules

- Piko never keylogs.
- Piko does not read full page text in V1.
- Piko only nudges when a goal is active.
- Piko uses deterministic trigger rules first and AI wording second.
- Piko should be dismissible and quiet by default.
- Piko should never guilt the user.

## Nudge triggers

| Trigger | Signal |
|---|---|
| Tab switching | Many active-tab changes in a short window |
| Distraction loop | Repeated time on likely distraction domains |
| Goal check | Goal has been active for a while with enough browser activity |
| Current distraction | User is currently on a likely distracting domain |

## Slash commands

```text
/goal finish the report
/goal
/sleep
/sleep 20
/wake
```

## Provider strategy

V1 is Gemini-only. The extension code keeps AI calls in one function, so later provider growth should add a provider adapter layer instead of scattering API logic across the UI.

Future provider shape:

```text
src/providers/
  gemini.js
  openai.js
  local.js
```

## Desktop companion path

Whole-PC history is intentionally not in V1. Browser extensions should not fake that capability.

When the browser loop is proven, add a small local companion app that can expose consented desktop signals:

- foreground app name,
- window title,
- optional app-level time tracking,
- pause/private mode,
- local-only event API for the extension.

## Next milestones

1. Load unpacked extension and verify popup/options render in Chrome.
2. Add a Gemini key and test one chat response.
3. Set `/goal ship Piko MVP`, browse for 20-30 minutes, and verify one nudge appears.
4. Tune nudge thresholds from real use.
5. Add provider adapters only after the Gemini loop feels useful.
