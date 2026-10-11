# Obsidian Image Rename

Give pasted or dropped images meaningful names **before** they are saved, then insert an embed pointing to the actual file.

Built for research notes, experiment logs, and everyday writing. Runs entirely inside your vault: no uploads, conversion, compression, AI service, or telemetry.

**Fork of [Paste Image Rename](https://github.com/reorx/obsidian-paste-image-rename) by [Reorx](https://github.com/reorx), based on upstream version 1.6.1 and distributed under its MIT license.** This independently maintained research-oriented adaptation reuses the upstream naming-template and settings implementation while replacing vault-wide rename listeners with editor-scoped, save-before-insert handling. Original attribution is preserved in [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

[中文说明](README.zh-CN.md)

## Features

- A naming dialog appears before an image is written, with a preview and its final attachment path.
- Optionally prefix filenames with the originating note's name: `Experiment Notes-Architecture.png`.
- Respect Obsidian's attachment-folder and link-format settings.
- Resolve file and directory collisions with `-1`, `-2`, etc., including case-insensitive and Unicode-normalized names.
- Preserve the original image bytes and format.
- Name multiple images one at a time; canceling stops the remaining batch without undoing already saved images.
- Support external image drops at the current editor caret.
- Guard against note switches, closed editors, changed content, and Chinese IME composition.
- Leave existing attachments, synchronized files, ordinary text, URLs, and mixed attachment pastes alone.

## Installation

Requires Obsidian **1.5.7 or later**. Desktop behavior has been tested on Windows; macOS installation uses the same plugin files. Mobile compatibility has not been verified.

This repository is a standalone plugin project, not an Obsidian Community Plugins listing.

1. Download this repository using **Code → Download ZIP**, or clone it.
2. Create `<your-vault>/.obsidian/plugins/research-image-rename/`.
3. Copy only `main.js`, `manifest.json`, `styles.css`, and `LICENSE` into that directory.
4. Restart Obsidian and enable **Obsidian Image Rename** under **Settings → Community plugins**.

The stable plugin ID is `research-image-rename`, preserving compatibility with existing installations. The GitHub repository name is `obsidian-image-rename`; do not use that name as the installation folder.

Do not enable another plugin that also intercepts image pastes or automatically renames the same attachments.

## Usage

The current dialog and settings interface uses Simplified Chinese; this README and repository metadata are in English. Filenames support English and other Unicode text.

1. Paste a screenshot or a copied image file into a Markdown note.
2. In **图片命名** (Image naming), enter a descriptive name without changing the extension.
3. Check **保存位置** (Save location), then click **保存并插入** (Save and insert) or press Enter.

With **名称包含所属笔记** (Include note name) enabled, entering `Architecture` in `Experiment Notes.md` saves `Experiment Notes-Architecture.png`. Disable that option to use a fully custom name.

For a vault configured to put attachments in `./Attachments`, images go to the originating note's sibling `Attachments` directory. Other attachment settings are respected without changing the vault configuration.

## Settings

| Setting | Default | Behavior |
| --- | --- | --- |
| Ask before saving | On | Prompt for each image; disable to use the naming template directly. |
| Include note name | On | Add the originating note's name unless it is already present. |
| Default naming template | `{{fileName}}-图` | Configurable suggestion; `图` means figure. |
| Always add a number | Off | Number only collisions; enable to start every filename at `-1`. |
| Handle external image drops | On | Insert at the current editor caret, not the mouse drop position. |

Supported upstream template variables: `{{fileName}}`, `{{dirName}}`, `{{firstHeading}}`, and `{{imageNameKey}}`. Supply `imageNameKey` in note Properties/frontmatter if desired. For an English default, change the template to `{{fileName}}-figure`.

## Safety and limitations

- Canceling does not write the current image. Attachment-path preview may create an empty attachment directory through Obsidian's public API.
- If the originating note closes, switches, or changes before saving, the operation stops instead of inserting into the wrong note.
- If an image was saved before the note changed, the image is preserved and its path is reported; note content is not overwritten.
- SVG images are saved without a rendered preview to avoid loading embedded active content or external references. Preview support for other formats depends on Obsidian's embedded browser.
- Original formats and bytes are preserved. Unsupported clipboard payloads and mixed image/non-image attachments fall back to Obsidian's normal handling.
- The plugin never bulk-renames old files and does not register vault-wide file-creation rename listeners.

## Development

Node.js 20+ is recommended. No third-party build or test dependencies are required; `obsidian` is supplied by the host application at runtime.

```sh
node build.cjs
node --test tests/plugin.test.cjs
```

Equivalent npm scripts: `npm run build` and `npm test`. In restricted environments that cannot spawn test subprocesses, Node.js 24 can run `node --test --test-isolation=none tests/plugin.test.cjs`.

- `src/upstream.js`: unmodified MIT-licensed upstream release bundle.
- `src/naming.js`: filename validation, note prefixes, and collision handling.
- `src/adapter.js`: editor events, naming dialog, attachment saving, and settings.
- `build.cjs`: deterministic bundler producing the installable `main.js`.
- `tests/plugin.test.cjs`: 44 isolated tests using mocked Obsidian APIs; no real notes or images are touched.

After changing source files, rebuild `main.js` and reload the plugin in Obsidian. Keep development files outside the vault's plugin runtime directory.

## Verification

All 44 isolated tests pass. A real Windows clipboard-paste test verified the naming dialog, correct attachment folder, matching embed, collision suffix, cancel behavior, and byte-for-byte preservation of the input PNG. The plugin files have also been synchronized to macOS; native macOS clipboard behavior has not yet been tested.

## License

MIT. The upstream copyright notice and license are retained. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
