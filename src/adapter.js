"use strict";

// The MIT upstream retains its template/settings implementation.
// Do not call its onload: vault-wide rename listeners and bulk commands are not used.
const Upstream = require("./upstream.js").default;
const { Modal, Notice, PluginSettingTab, Setting, normalizePath } = require("obsidian");
const { imageExtension, validateStem, safeNoteStem, withNotePrefix, uniqueName } = require("./naming.js");

const DEFAULTS = {
  imageNamePattern: "{{fileName}}-图",
  includeNoteName: true,
  askBeforeSave: true,
  handleDrop: true,
  dupNumberDelimiter: "-",
  dupNumberAtStart: false,
  dupNumberAlways: false
};

class ResearchImageRename extends Upstream {
  constructor(...args) {
    super(...args);
    this.queue = Promise.resolve();
    this.activeModal = null;
    this.stopped = false;
  }

  async onload() {
    await this.loadSettings();
    this.settings = { ...this.settings, ...DEFAULTS, ...(await this.loadData() || {}) };
    this.stopped = false;
    this.registerEvent(this.app.workspace.on("editor-paste", (event, editor, info) => {
      this.handleInput(event, editor, info, false);
    }));
    this.registerEvent(this.app.workspace.on("editor-drop", (event, editor, info) => {
      this.handleInput(event, editor, info, true);
    }));
    this.addSettingTab(new ResearchSettings(this.app, this));
  }

  handleInput(event, editor, info, isDrop) {
    if (this.stopped || event.defaultPrevented || (isDrop && !this.settings.handleDrop)) return;
    const transfer = isDrop ? event.dataTransfer : event.clipboardData;
    if (!transfer || !info.file || info.file.extension !== "md") return;
    let files = Array.from(transfer.files || []);
    if (!files.length) {
      files = Array.from(transfer.items || []).filter(item => item.kind === "file")
        .map(item => item.getAsFile()).filter(Boolean);
    }
    // Preserve normal Obsidian handling of mixed files, text, URLs and internal drags.
    if (!files.length || files.some(file => !imageExtension(file))) return;
    const owner = this.app.workspace.getLeavesOfType("markdown")
      .map(leaf => leaf.view).find(view => view.editor === editor && view.file === info.file);
    if (!owner) return;
    const from = { ...editor.getCursor(isDrop ? undefined : "from") };
    const to = isDrop ? { ...from } : { ...editor.getCursor("to") };
    const context = {
      owner, editor, source: info.file, noteName: info.file.basename,
      expectedText: editor.getValue(), from, to
    };
    event.preventDefault();
    this.queue = this.queue.then(() => this.processFiles(files, context)).catch(error => {
      console.error("[科研图片命名]", error);
      new Notice("图片未插入：" + error.message, 10000);
    });
  }

  assertContext(context, cancelled = () => false) {
    if (this.stopped || cancelled()) throw new Error("操作已取消。");
    const { owner, editor, source } = context;
    const stillOpen = this.app.workspace.getLeavesOfType("markdown").some(leaf => leaf.view === owner);
    if (!stillOpen || owner.file !== source || owner.editor !== editor ||
        this.app.vault.getAbstractFileByPath(source.path) !== source) {
      throw new Error("原笔记已关闭或切换，请回到原笔记重新粘贴。");
    }
    if (editor.getValue() !== context.expectedText) {
      throw new Error("笔记内容已变化，为避免插入到错误位置，请重新粘贴。");
    }
  }

  suggestedStem(extension, context) {
    try {
      return validateStem(this.generateNewName({ extension }, context.source).stem, extension);
    } catch {
      return safeNoteStem(context.noteName) + "-图";
    }
  }

  effectiveStem(raw, extension, context) {
    return validateStem(
      withNotePrefix(validateStem(raw, extension), context.noteName, this.settings.includeNoteName),
      extension
    );
  }

  async targetPath(raw, extension, context) {
    const stem = this.effectiveStem(raw, extension, context);
    // Public API follows this vault's attachment settings using the originating note.
    const available = normalizePath(await this.app.fileManager.getAvailablePathForAttachment(
      stem + "." + extension, context.source.path
    ));
    const lastSlash = available.lastIndexOf("/");
    const folder = lastSlash < 0 ? "" : available.slice(0, lastSlash);
    const listed = await this.app.vault.adapter.list(folder);
    const siblings = [...listed.files, ...listed.folders].map(path => path.slice(path.lastIndexOf("/") + 1));
    const name = uniqueName(stem, extension, siblings, this.settings.dupNumberAlways);
    return normalizePath(folder ? folder + "/" + name : name);
  }

  async saveImage(raw, file, extension, context, addNewline, cancelled = () => false) {
    this.assertContext(context, cancelled);
    const binary = await file.arrayBuffer();
    this.assertContext(context, cancelled);
    let saved;
    for (let attempt = 0; attempt < 5; attempt++) {
      const path = await this.targetPath(raw, extension, context);
      this.assertContext(context, cancelled);
      try {
        saved = await this.app.vault.createBinary(path, binary);
        break;
      } catch (error) {
        // Another client/plugin may have created this name after the preview.
        if (!this.app.vault.getAbstractFileByPath(path) || attempt === 4) throw error;
      }
    }
    if (!saved) throw new Error("无法保存图片，请稍后重试。");
    try {
      this.assertContext(context, cancelled);
      const link = "!" + this.app.fileManager.generateMarkdownLink(saved, context.source.path);
      const text = link + (addNewline ? "\n" : "");
      const startOffset = context.editor.posToOffset(context.from);
      context.editor.replaceRange(text, context.from, context.to);
      const next = context.editor.offsetToPos(startOffset + text.length);
      context.editor.setCursor(next);
      context.expectedText = context.editor.getValue();
      context.from = context.to = next;
      return saved.path;
    } catch (error) {
      // Never delete a saved image, or overwrite a note that changed during the save.
      throw new Error("图片已保存到「" + saved.path + "」，但未插入引用：" + error.message);
    }
  }

  async processFiles(files, context) {
    for (let index = 0; index < files.length; index++) {
      this.assertContext(context);
      const file = files[index];
      const extension = imageExtension(file);
      const suggested = this.suggestedStem(extension, context);
      if (this.settings.askBeforeSave) {
        const confirmed = await new Promise(resolve => {
          const modal = new NamingModal(this.app, this, context, file, extension,
            suggested, index, files.length, resolve);
          this.activeModal = modal;
          modal.open();
        });
        if (!confirmed) return;
      } else {
        await this.saveImage(suggested, file, extension, context, index < files.length - 1);
      }
    }
  }

  onunload() {
    this.stopped = true;
    if (this.activeModal) this.activeModal.close();
    this.activeModal = null;
  }
}

class NamingModal extends Modal {
  constructor(app, plugin, context, file, extension, suggested, index, total, resolve) {
    super(app);
    Object.assign(this, { plugin, context, file, extension, raw: suggested, index, total, resolve });
    this.finished = false;
    this.saving = false;
    this.closed = false;
    this.previewVersion = 0;
    this.composing = false;
    this.objectUrl = null;
  }

  onOpen() {
    this.modalEl.addClass("research-image-name-modal");
    this.titleEl.setText("图片命名" + (this.total > 1 ? " · " + (this.index + 1) + "/" + this.total : ""));
    this.contentEl.createDiv({ cls: "research-image-source", text: "所属笔记：" + this.context.source.path });
    // SVGs may contain active content / remote references; don't render their preview.
    if (this.extension !== "svg") {
      this.objectUrl = URL.createObjectURL(this.file);
      this.contentEl.createEl("img", {
        cls: "research-image-preview", attr: { src: this.objectUrl, alt: "待保存图片预览" }
      });
    }
    new Setting(this.contentEl)
      .setName("图片名称")
      .setDesc("无需输入扩展名。保存后的文件名与笔记引用一致。")
      .addText(text => {
        this.input = text.inputEl;
        text.setValue(this.raw).onChange(value => { this.raw = value; this.refreshPreview(); });
      });
    this.pathEl = this.contentEl.createDiv({ cls: "research-image-path" });
    this.errorEl = this.contentEl.createDiv({
      cls: "research-image-error", attr: { role: "alert" }
    });
    this.contentEl.createDiv({
      cls: "research-image-hint",
      text: "重名会自动加编号，不覆盖旧图片。取消不保存本张图片" +
        (this.total > 1 ? "，并停止处理本批剩余图片。" : "。")
    });
    new Setting(this.contentEl)
      .addButton(button => {
        this.saveButton = button;
        button.setButtonText("保存并插入").setCta().onClick(() => this.save());
      })
      .addButton(button => {
        this.cancelButton = button;
        button.setButtonText("取消").onClick(() => { if (!this.saving) this.close(); });
      });
    this.input.addEventListener("compositionstart", () => { this.composing = true; });
    this.input.addEventListener("compositionend", () => { this.composing = false; });
    this.input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.isComposing && !this.composing && event.keyCode !== 229) {
        event.preventDefault();
        this.save();
      }
    });
    this.scope.register([], "Escape", () => {
      if (!this.saving) this.close();
      return false;
    });
    this.input.focus();
    this.input.select();
    this.refreshPreview();
  }

  async refreshPreview() {
    const version = ++this.previewVersion;
    this.errorEl.setText("");
    try {
      const path = await this.plugin.targetPath(this.raw, this.extension, this.context);
      if (version !== this.previewVersion || this.finished || this.closed) return;
      this.pathEl.setText("保存位置：" + path);
      this.saveButton.setDisabled(this.saving);
    } catch (error) {
      if (version !== this.previewVersion || this.closed) return;
      this.pathEl.setText("");
      this.errorEl.setText(error.message);
      this.saveButton.setDisabled(true);
    }
  }

  async save() {
    if (this.saving || this.finished || this.closed || this.composing) return;
    this.saving = true;
    this.previewVersion++;
    this.input.disabled = true;
    this.saveButton.setButtonText("保存中…").setDisabled(true);
    this.cancelButton.setDisabled(true);
    try {
      await this.plugin.saveImage(this.raw, this.file, this.extension, this.context,
        this.index < this.total - 1, () => this.closed);
      this.finished = true;
      this.resolve(true);
      this.close();
    } catch (error) {
      if (this.closed) {
        if (error.message.startsWith("图片已保存到")) new Notice(error.message, 15000);
        return;
      }
      this.errorEl.setText(error.message);
      if (error.message.startsWith("图片已保存到")) {
        this.finished = true;
        this.resolve(false);
        this.saveButton.setButtonText("已保存").setDisabled(true);
        this.cancelButton.setButtonText("关闭").setDisabled(false);
      } else {
        this.input.disabled = false;
        this.saveButton.setButtonText("保存并插入").setDisabled(false);
        this.cancelButton.setDisabled(false);
      }
    } finally {
      this.saving = false;
    }
  }

  onClose() {
    this.closed = true;
    this.previewVersion++;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    if (!this.finished) {
      this.finished = true;
      this.resolve(false);
    }
    if (this.plugin.activeModal === this) this.plugin.activeModal = null;
    this.contentEl.empty();
  }
}

class ResearchSettings extends PluginSettingTab {
  display() {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "科研图片命名" });
    this.containerEl.createEl("p", {
      text: "只处理本次粘贴或外部拖入的图片；保留原格式，使用仓库的附件目录，不上传图片，不批量改动旧附件。"
    });
    new Setting(this.containerEl).setName("粘贴时询问名称")
      .setDesc("推荐开启；关闭后直接按默认名称保存。")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.askBeforeSave)
        .onChange(async value => { this.plugin.settings.askBeforeSave = value; await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName("名称包含所属笔记")
      .setDesc("例如输入“架构图”，实际保存为“笔记名-架构图.png”。关闭可完全自定义名称。")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.includeNoteName)
        .onChange(async value => { this.plugin.settings.includeNoteName = value; await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName("默认名称规则")
      .setDesc("沿用 Paste Image Rename：{{fileName}}、{{dirName}}、{{firstHeading}}、{{imageNameKey}}。")
      .addText(text => text.setValue(this.plugin.settings.imageNamePattern)
        .onChange(async value => { this.plugin.settings.imageNamePattern = value; await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName("始终添加序号")
      .setDesc("开启后从 -1 开始；关闭时只在重名时加序号。")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.dupNumberAlways)
        .onChange(async value => { this.plugin.settings.dupNumberAlways = value; await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName("也处理外部拖入的图片")
      .setDesc("会插入到当前光标处。库内图片拖动、链接、混合类型文件继续由 Obsidian 处理。")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.handleDrop)
        .onChange(async value => { this.plugin.settings.handleDrop = value; await this.plugin.saveSettings(); }));
  }
}

module.exports = { default: ResearchImageRename };
