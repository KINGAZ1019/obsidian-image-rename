"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { imageExtension, validateStem, safeNoteStem, withNotePrefix, uniqueName } = require("../src/naming.js");

for (const [input, expected] of [
  [{ type: "image/png", name: "random" }, "png"],
  [{ type: "image/jpeg", name: "photo.png" }, "jpg"],
  [{ type: "", name: "截图.PNG" }, "png"],
  [{ type: "application/octet-stream", name: "scan.tiff" }, "tiff"],
  [{ type: "application/pdf", name: "fake.png" }, null],
  [{ type: "", name: "readme.md" }, null],
  [{ type: "text/html", name: "" }, null]
]) test("image type: " + JSON.stringify(input), () => assert.equal(imageExtension(input), expected));

for (const invalid of ["", ".", "..", "../secret", "dir\\img", "a:b", "a#b", "a[b]", "a^b", "CON", "nul.txt", "LPT1", "尾点.", "x".repeat(151)]) {
  test("reject invalid filename: " + invalid.slice(0, 30), () => assert.throws(() => validateStem(invalid, "png")));
}
test("Unicode and matching extension", () => {
  assert.equal(validateStem("  架构图.PNG  ", "png"), "架构图");
  assert.equal(validateStem("cafe\u0301", "png"), "café");
  assert.throws(() => validateStem("图.jpg", "png"), /格式保持/);
});
test("safe note prefix and no double prefix", () => {
  assert.equal(safeNoteStem("CON"), "笔记-CON");
  assert.equal(safeNoteStem("实验#1/模型"), "实验-1-模型");
  assert.equal(withNotePrefix("架构图", "笔记", true), "笔记-架构图");
  assert.equal(withNotePrefix("笔记-架构图", "笔记", true), "笔记-架构图");
  assert.equal(withNotePrefix("架构图", "笔记", false), "架构图");
});
test("deduplicate case-insensitively without overwrite", () => {
  assert.equal(uniqueName("Figure", "png", ["FIGURE.PNG", "figure-1.PNG"]), "Figure-2.png");
  assert.equal(uniqueName("图", "png", []), "图.png");
  assert.equal(uniqueName("图", "png", [], true), "图-1.png");
  assert.equal(uniqueName("café", "png", ["cafe\u0301.png"]), "café-1.png");
});

function setup(options = {}) {
  const modals = [], notices = [], elements = [];
  function el() {
    const listeners = {};
    const element = {
      text: "", disabled: false, listeners,
      addClass() {}, setText(text) { this.text = text; },
      createDiv(opts) { const child = el(); child.text = opts?.text || ""; return child; },
      createEl(tag, opts) { const child = el(); child.text = opts?.text || ""; return child; },
      empty() {}, addEventListener(type, callback) { listeners[type] = callback; },
      focus() {}, select() {}
    };
    elements.push(element);
    return element;
  }
  class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest; this.registered = []; this.commands = []; }
    async loadData() { return options.settings || null; }
    async saveData(settings) { this.persisted = { ...settings }; }
    registerEvent(event) { this.registered.push(event); }
    addSettingTab(tab) { this.settingsTab = tab; }
    addCommand(command) { this.commands.push(command); }
  }
  class Modal {
    constructor(app) {
      this.app = app; this.modalEl = el(); this.contentEl = el(); this.titleEl = el();
      this.scope = { handlers: [], register: (keys, key, fn) => this.scope.handlers.push({ key, fn }) };
      modals.push(this);
    }
    open() { this.onOpen(); }
    close() { if (!this.closed) this.onClose(); }
  }
  class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = el(); } }
  class Setting {
    constructor() {}
    setName() { return this; }
    setDesc() { return this; }
    addText(fn) {
      const component = {
        inputEl: el(),
        setValue(value) { this.value = value; return this; },
        onChange(callback) { this.callback = callback; return this; }
      };
      fn(component); return this;
    }
    addButton(fn) {
      const component = {
        setButtonText(text) { this.text = text; return this; },
        setCta() { return this; },
        setDisabled(value) { this.disabled = value; return this; },
        onClick(fn) { this.callback = fn; return this; }
      };
      fn(component); return this;
    }
    addToggle(fn) { fn({ setValue() { return this; }, onChange() { return this; } }); return this; }
  }
  class TFile {}
  const api = {
    Plugin, Modal, PluginSettingTab, Setting, TFile, MarkdownView: class {},
    Notice: class { constructor(message) { notices.push(message); } },
    normalizePath: value => value.replace(/\\/g, "/")
  };
  const contextModule = { exports: {} };
  const sandbox = {
    module: contextModule, exports: contextModule.exports,
    require: name => { assert.equal(name, "obsidian"); return api; },
    console: { log() {}, warn() {}, error() {} },
    window: { moment: () => ({ format: () => "2026-10-10" }) },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../main.js"), "utf8"), sandbox);
  const source = Object.assign(new TFile(), {
    path: "Research/实验记录.md", basename: "实验记录", name: "实验记录.md", extension: "md", parent: { name: "Research" }
  });
  let content = "开头\n结尾";
  let cursor = { line: 0, ch: 2 }, end = { ...cursor };
  const editor = {
    getValue: () => content, setValue: value => { content = value; },
    getCursor: which => ({ ...(which === "to" ? end : cursor) }),
    setSelection: (from, to) => { cursor = from; end = to; },
    posToOffset: pos => content.split("\n").slice(0, pos.line).reduce((n, line) => n + line.length + 1, 0) + pos.ch,
    offsetToPos: offset => {
      const lines = content.slice(0, offset).split("\n");
      return { line: lines.length - 1, ch: lines.at(-1).length };
    },
    replaceRange: (text, from, to) => {
      const start = editor.posToOffset(from), finish = editor.posToOffset(to);
      content = content.slice(0, start) + text + content.slice(finish);
    },
    setCursor: pos => { cursor = end = pos; }
  };
  const owner = { file: source, editor };
  const leaves = [{ view: owner }];
  const entries = new Map([[source.path, source]]);
  for (const p of options.existing || []) entries.set(p, { path: p });
  const savedBytes = new Map(), attachmentRequests = [], linkRequests = [], events = {};
  const app = {
    workspace: {
      getLeavesOfType: () => leaves,
      on: (name, callback) => { events[name] = callback; return { name, callback }; }
    },
    metadataCache: { getFileCache: () => options.metadata || {} },
    vault: {
      getAbstractFileByPath: p => entries.get(p),
      adapter: {
        list: async folder => ({
          files: [...entries.keys()].filter(p => p.slice(0, p.lastIndexOf("/")) === folder),
          folders: options.folders || []
        })
      },
      createBinary: async (p, data) => {
        if (options.beforeCreate) await options.beforeCreate(p, entries, owner, editor);
        if ([...entries.keys()].some(existing => existing.toLowerCase() === p.toLowerCase())) throw new Error("File already exists.");
        const f = Object.assign(new TFile(), { path: p, name: p.slice(p.lastIndexOf("/") + 1) });
        entries.set(p, f); savedBytes.set(p, Buffer.from(data));
        if (options.afterCreate) await options.afterCreate(p, owner, editor);
        return f;
      }
    },
    fileManager: {
      getAvailablePathForAttachment: async (name, sourcePath) => {
        attachmentRequests.push(sourcePath);
        const folder = options.attachmentFolder ?? sourcePath.slice(0, sourcePath.lastIndexOf("/")) + "/Attachments";
        return folder ? folder + "/" + name : name;
      },
      generateMarkdownLink: (file, sourcePath) => {
        linkRequests.push(sourcePath);
        return options.markdown ? "[" + file.name + "](" + file.path.replace(/ /g, "%20") + ")" : "[[" + file.path + "]]";
      }
    }
  };
  const plugin = new contextModule.exports.default(app, { id: "research-image-rename" });
  const bytes = Buffer.from([137, 80, 78, 71, 0, 255, 1]);
  const file = {
    type: "image/png", name: "Pasted image 202610100001.png",
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
  const noteContext = () => ({
    owner, editor, source, noteName: source.basename, expectedText: content,
    from: editor.getCursor("from"), to: editor.getCursor("to")
  });
  const paste = (files = [file], extra = {}) => {
    const event = {
      defaultPrevented: false, clipboardData: { files },
      preventDefault() { this.defaultPrevented = true; }, ...extra
    };
    events["editor-paste"](event, editor, { file: source });
    return event;
  };
  return { plugin, app, editor, source, owner, leaves, entries, savedBytes, bytes, file,
    modals, notices, attachmentRequests, linkRequests, noteContext, paste, events, elements };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("register only paste/drop, no global rename listeners or batch commands", async () => {
  const h = setup(); await h.plugin.onload();
  assert.deepEqual(Object.keys(h.events).sort(), ["editor-drop", "editor-paste"]);
  assert.equal(h.plugin.commands.length, 0);
  assert.equal(h.plugin.settings.askBeforeSave, true);
});
test("preserve upstream frontmatter/template variables", async () => {
  const h = setup({ settings: { imageNamePattern: "{{imageNameKey}}-{{firstHeading}}", includeNoteName: false },
    metadata: { frontmatter: { imageNameKey: "R01" }, headings: [{ level: 1, heading: "架构" }] } });
  await h.plugin.onload();
  assert.equal(h.plugin.suggestedStem("png", h.noteContext()), "R01-架构");
});
test("paste prompts BEFORE saving; writes same bytes, originating folder, matching embed", async () => {
  const h = setup(); await h.plugin.onload();
  const evt = h.paste(); await tick();
  assert.equal(evt.defaultPrevented, true);
  assert.equal(h.savedBytes.size, 0);
  assert.equal(h.modals.length, 1);
  h.modals[0].raw = "架构图";
  await h.modals[0].save(); await h.plugin.queue;
  const p = "Research/Attachments/实验记录-架构图.png";
  assert.deepEqual(h.savedBytes.get(p), h.bytes);
  assert.equal(h.editor.getValue(), "开头![[" + p + "]]\n结尾");
  assert.ok(h.attachmentRequests.every(p => p === h.source.path));
  assert.deepEqual(h.linkRequests, [h.source.path]);
});
test("cancel initial prompt writes no image and changes no note", async () => {
  const h = setup(); await h.plugin.onload(); h.paste(); await tick();
  h.modals[0].close(); await h.plugin.queue;
  assert.equal(h.savedBytes.size, 0);
  assert.equal(h.editor.getValue(), "开头\n结尾");
});
test("multiple images: first saved, cancel stops remaining", async () => {
  const h = setup(); await h.plugin.onload(); h.paste([h.file, h.file, h.file]); await tick();
  h.modals[0].raw = "步骤"; await h.modals[0].save(); await tick();
  assert.equal(h.modals.length, 2);
  h.modals[1].close(); await h.plugin.queue;
  assert.equal(h.savedBytes.size, 1);
  assert.equal(h.modals.length, 2);
});
test("multiple images use sequential filenames and correct subsequent caret", async () => {
  const h = setup({ settings: { askBeforeSave: false } }); await h.plugin.onload();
  h.paste([h.file, h.file]); await h.plugin.queue;
  const paths = [...h.savedBytes.keys()];
  assert.deepEqual(paths, ["Research/Attachments/实验记录-图.png", "Research/Attachments/实验记录-图-1.png"]);
  assert.equal(h.editor.getValue(), "开头![[" + paths[0] + "]]\n![[" + paths[1] + "]]\n结尾");
});
test("actual selection is replaced, not unrelated note content", async () => {
  const h = setup({ settings: { askBeforeSave: false } }); await h.plugin.onload();
  h.editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 2 });
  h.paste(); await h.plugin.queue;
  assert.equal(h.editor.getValue(), "![[Research/Attachments/实验记录-图.png]]\n结尾");
});
test("case-insensitive file or folder collision gets next suffix", async () => {
  const h = setup({ existing: ["Research/Attachments/实验记录-图.PNG"],
    folders: ["Research/Attachments/实验记录-图-1.png"] });
  await h.plugin.onload();
  assert.equal(await h.plugin.targetPath("图", "png", h.noteContext()), "Research/Attachments/实验记录-图-2.png");
});
test("racing file creation retries without overwriting existing image", async () => {
  let raced = false;
  const h = setup({ beforeCreate: (p, entries) => {
    if (!raced) { raced = true; entries.set(p, { path: p, original: true }); }
  } });
  await h.plugin.onload();
  const p = await h.plugin.saveImage("图", h.file, "png", h.noteContext(), false);
  assert.equal(p, "Research/Attachments/实验记录-图-1.png");
  assert.equal(h.entries.get("Research/Attachments/实验记录-图.png").original, true);
});
test("switch original note before save refuses without writing anything", async () => {
  const h = setup(); await h.plugin.onload();
  const ctx = h.noteContext(); h.owner.file = { path: "Other.md" };
  await assert.rejects(h.plugin.saveImage("图", h.file, "png", ctx, false), /原笔记/);
  assert.equal(h.savedBytes.size, 0);
});
test("edit source before save refuses without replacing changed content", async () => {
  const h = setup(); await h.plugin.onload(); const ctx = h.noteContext();
  h.editor.setValue("用户新内容");
  await assert.rejects(h.plugin.saveImage("图", h.file, "png", ctx, false), /内容已变化/);
  assert.equal(h.savedBytes.size, 0); assert.equal(h.editor.getValue(), "用户新内容");
});
test("source changes DURING save: keep saved image, report its path, don't insert", async () => {
  const h = setup({ afterCreate: (_p, _owner, editor) => editor.setValue("变化后正文") });
  await h.plugin.onload();
  await assert.rejects(h.plugin.saveImage("图", h.file, "png", h.noteContext(), false), /图片已保存到「Research\/Attachments\/实验记录-图.png」/);
  assert.equal(h.savedBytes.size, 1); assert.equal(h.editor.getValue(), "变化后正文");
});
test("full custom names and Markdown link preference are preserved", async () => {
  const h = setup({ settings: { includeNoteName: false }, attachmentFolder: "", markdown: true });
  await h.plugin.onload();
  const p = await h.plugin.saveImage("Figure 1.png", h.file, "png", h.noteContext(), false);
  assert.equal(p, "Figure 1.png");
  assert.equal(h.editor.getValue(), "开头![Figure 1.png](Figure%201.png)\n结尾");
});
test("plain text and mixed attachments fall through untouched", async () => {
  const h = setup(); await h.plugin.onload();
  assert.equal(h.paste([]).defaultPrevented, false);
  assert.equal(h.paste([h.file, { type: "application/pdf", name: "paper.pdf" }]).defaultPrevented, false);
  assert.equal(h.modals.length, 0); assert.equal(h.savedBytes.size, 0);
});
test("already claimed paste is not intercepted twice", async () => {
  const h = setup(); await h.plugin.onload();
  h.paste([h.file], { defaultPrevented: true }); await tick();
  assert.equal(h.modals.length, 0);
});
test("clipboard item fallback also prompts", async () => {
  const h = setup(); await h.plugin.onload();
  h.paste([], { clipboardData: { files: [], items: [{ kind: "file", getAsFile: () => h.file }] } });
  await tick(); assert.equal(h.modals.length, 1); h.modals[0].close(); await h.plugin.queue;
});
test("Chinese IME Enter does not save prematurely", async () => {
  const h = setup(); await h.plugin.onload(); h.paste(); await tick();
  const modal = h.modals[0];
  modal.input.listeners.compositionstart();
  modal.input.listeners.keydown({ key: "Enter", isComposing: true, keyCode: 229 });
  await tick(); assert.equal(h.savedBytes.size, 0);
  modal.input.listeners.compositionend(); modal.close(); await h.plugin.queue;
});
test("unload cancels pending modal", async () => {
  const h = setup(); await h.plugin.onload(); h.paste(); await tick();
  h.plugin.onunload(); await h.plugin.queue;
  assert.equal(h.modals[0].closed, true); assert.equal(h.savedBytes.size, 0);
});
test("closing modal during binary read cancels without creating a file", async () => {
  const h = setup(); await h.plugin.onload();
  let continueRead; const waiting = new Promise(resolve => { continueRead = resolve; });
  const file = { ...h.file, arrayBuffer: async () => { await waiting; return h.file.arrayBuffer(); } };
  h.paste([file]); await tick(); const saving = h.modals[0].save();
  h.modals[0].close(); continueRead(); await saving; await h.plugin.queue;
  assert.equal(h.savedBytes.size, 0); assert.equal(h.editor.getValue(), "开头\n结尾");
});
test("drop defaults to current caret and can be disabled", async () => {
  const h = setup({ settings: { askBeforeSave: false } }); await h.plugin.onload();
  const event = { dataTransfer: { files: [h.file] }, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; } };
  h.events["editor-drop"](event, h.editor, { file: h.source }); await h.plugin.queue;
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.savedBytes.size, 1);
  h.plugin.settings.handleDrop = false;
  event.defaultPrevented = false; h.events["editor-drop"](event, h.editor, { file: h.source });
  assert.equal(event.defaultPrevented, false);
});
