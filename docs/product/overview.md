# Product Overview

## Purpose

NiceTab is a browser extension for collecting, organizing, restoring, and syncing tabs across browsing sessions and devices.

It is positioned as a richer alternative to tools like OneTab, Toby, SessionBuddy, and similar tab managers.

## Core User Flows

### Capture Tabs

Users can send tabs into NiceTab from:

- toolbar popup
- context menu
- keyboard commands
- extension actions triggered from the dashboard

Capture strategies include:

- all tabs
- all tabs in all windows
- current tab
- current tab group
- left tabs
- right tabs
- other tabs
- selected domain-based actions such as GitHub or Zhihu

### Manage Saved Tabs

The dashboard organizes data as:

- tag
- group
- tab

Users can create, rename, reorder, merge, deduplicate, move, copy, star, lock, restore, and delete entities within that hierarchy.

### Restore Tabs

Saved tabs can be reopened:

- in the current window
- in a new window
- as grouped tabs when browser support exists
- in configured tab order
- optionally discarded for lower resource usage

### Snapshot Opened Tabs

The extension supports saving and restoring snapshots of currently opened tabs, including automatic and manual snapshot flows.

### Import And Export

Supported import/export workflows include:

- NiceTab JSON
- OneTab text
- Toby JSON
- SessionBuddy JSON import
- KepTab JSON
- Netscape-style bookmark HTML conversion

### Remote Sync

Remote sync supports:

- GitHub Gists
- Gitee Gists
- WebDAV

Sync can include tab data and, optionally, selected settings.

Both manual and automatic sync modes exist, with merge and force variants.

## Product Invariants

These behaviors are important and should not be changed casually:

- The static staging-area tag must remain valid and available.
- Popup module visibility is settings-driven.
- If popup modules are empty, clicking the extension action sends tabs directly instead of opening the popup.
- Import/export and sync must preserve a valid NiceTab hierarchy.
- Recycle-bin behavior must remain recoverable for deleted entities where applicable.
- Firefox limitations around privileged URLs and tab-group capability must remain explicit in UX and code.

## Settings Areas

Main settings domains include:

- common preferences
- send-tab behavior
- restore/open behavior
- page-title customization
- global search
- deletion safeguards
- display and popup modules
- sync and auto-sync

Any feature work that changes these user expectations must update docs and validation.
