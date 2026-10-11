# Third-party notices

## Paste Image Rename

Obsidian Image Rename is a **source-code fork of Paste Image Rename 1.6.1**, not a wholly original implementation. It is published in an independently created repository rather than GitHub's native fork network.

- Author: Reorx
- Project: https://github.com/reorx/obsidian-paste-image-rename
- Upstream release: 1.6.1
- License: MIT
- Copyright: Copyright (c) 2022 Reorx

`src/upstream.js` contains the unmodified upstream release bundle. Its code is also included in the built `main.js`. This adaptation reuses upstream template generation and settings persistence, but does not call the upstream `onload` implementation or its vault-wide rename listeners and bulk commands.

The complete upstream license is included in `LICENSE`, which must accompany distribution of the plugin.
