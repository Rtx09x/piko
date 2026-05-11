# Chrome Web Store Listing Draft

## Name

Piko

## Short Description

A tiny AI focus companion that gives gentle browser nudges around your current goal.

## Detailed Description

Piko is a small browser companion for staying on track without turning productivity into a punishment system.

Set a current goal, keep browsing normally, and Piko quietly watches lightweight browser signals like tab titles, domains, time spent, and tab switching. When it looks useful, Piko gives a small nudge back toward the thing you meant to do.

Piko can also chat with you when you need a quick reset, a next step, or a summary of your recent browsing context.

Features:

- current goal tracking with `/goal`,
- gentle focus nudges,
- Gemini-powered chat and nudge wording,
- local browser activity context,
- sleep and wake controls,
- optional recent browser-history import,
- blocked and allowed domain controls,
- local-first storage,
- no keylogging,
- no full-page scraping by default.

Piko is built to be dismissible. It should help you notice drift, not guilt you for being human.

## Category

Productivity

## Single Purpose

Piko helps users stay focused by tracking local browser activity around a user-set goal and providing gentle AI-powered nudges.

## Permission Justifications

### tabs

Used to read the active tab title, URL, and domain so Piko can understand lightweight browser context around the user's current goal.

### storage

Used to store local settings, the current goal, recent activity summaries, and chat history.

### alarms

Used to periodically check whether a focus nudge would be useful.

### scripting

Used to show the Piko nudge overlay on normal web pages.

### history optional permission

Used only when the user clicks `Import recent browser history`. It imports a rough recent browser-history snapshot for context.

## Remote Code Statement

Piko does not execute remote code. It calls the Gemini API for text generation when the user provides a Gemini API key, but it does not load or execute remote JavaScript.

## Privacy Policy URL

Host `PRIVACY.md` somewhere public before submitting to the Chrome Web Store.
