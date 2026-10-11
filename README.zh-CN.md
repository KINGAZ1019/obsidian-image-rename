# Obsidian Image Rename（科研图片命名）

独立插件项目（安装 ID：research-image-rename，1.0.0）。需要 Obsidian 1.5.7 或更新版本。插件显示名为 Obsidian Image Rename，弹窗和设置界面保留中文。[English documentation](README.md)

## 调研与复用

- [Paste Image Rename](https://github.com/reorx/obsidian-paste-image-rename) 已有命名弹窗、文件改名、引用更新和命名模板，满足基础需求。
- [Image Converter](https://github.com/xRyul/obsidian-image-converter) 也支持命名和目录规则，但还包含压缩、转换、裁剪等功能，这次不需要。

**本插件是 [Reorx](https://github.com/reorx) 的 [Paste Image Rename](https://github.com/reorx/obsidian-paste-image-rename) 1.6.1 的 fork（代码分支），不是完全原创实现。** 基于其 MIT 代码改造，保留命名模板和设置读写实现。原版发布文件保存在 src/upstream.js，原作者版权和许可在 LICENSE 中保留。新增逻辑在 src/adapter.js 与 src/naming.js。

关键调整：不使用原插件的全库文件创建监听器和无确认批量重命名命令，而是处理当前编辑器的图片粘贴/外部拖入事件。在保存前确认名称，避免先保存随机名再改名，也避免同步附件触发误操作。

## 使用

在 设置 → 第三方插件 中启用「Obsidian Image Rename」。如果列表尚未发现本地新插件，关闭并重新打开设置；仍未出现时，保存笔记后重启 Obsidian。不要同时启用另一个会接管图片粘贴或自动改名的插件。

1. 在笔记编辑区域粘贴截图或复制的图片文件。
2. 中文弹窗展示所属笔记、图片预览和实际保存路径。
3. 输入描述，例如「架构图」，点击「保存并插入」或按 Enter。
4. 以「笔记名-架构图.png」这样的名称保存实际文件，同时插入正确的图片引用。

默认保留所属笔记名作为前缀。想完全自定义文件名，可在插件设置中关闭「名称包含所属笔记」。无需输入扩展名；原图片格式和字节保留，不做压缩或转换。

若仓库附件配置为 ./Attachments，图片会保存在原笔记所在目录的 Attachments 文件夹；插件遵循 Obsidian 的附件设置，不修改全库目录配置。重名自动添加 -1、-2 等编号，也检查大小写差异和同名目录，不覆盖文件。

## 行为与边界

- 多张图片按顺序逐张命名。取消不写入本张图片，并停止处理本批剩余图片；已经确认保存的图片保留。
- 外部拖入图片也支持命名，插入到当前光标处，并非鼠标落点。可在设置关闭此功能。
- 普通文本、网络图片链接、库内拖动、混合图片与非图片附件继续由 Obsidian 原本流程处理。
- 保存前若原笔记关闭、切换或内容发生变化，会停止写入，提示重新粘贴，避免把引用插入错误笔记。
- 保存过程中笔记变化或窗口关闭时，已经成功保存的图片不会删除；提示具体路径，正文保持原样，可自行补上引用。
- 取消不会生成图片；路径预览调用 Obsidian 的附件接口，可能创建一个空的附件文件夹。
- SVG 不展示预览，避免加载其潜在外部内容。支持的其他格式能否预览取决于 Obsidian 内置浏览器。
- 中文输入法确认选词的 Enter 不会误触发保存。
- 不监听同步创建的文件，不批量修改现有图片，不更改旧引用。
- 完全本地运行：没有网络请求、AI 服务、遥测或图片上传。

## 默认设置

- 粘贴时询问名称：开启
- 名称包含所属笔记：开启
- 默认名称规则：{{fileName}}-图
- 始终添加序号：关闭（只在重名时编号）
- 也处理外部拖入的图片：开启

命名规则沿用上游：{{fileName}}、{{dirName}}、{{firstHeading}}、{{imageNameKey}}。imageNameKey 可放在笔记 Properties/frontmatter 中。非法文件名或过长名称会提示修改。

## 维护

无需安装依赖。修改 src/adapter.js 或 src/naming.js 后，用 Node.js 执行 `node build.cjs` 生成 main.js，然后在 Obsidian 中重新启用插件。`node --test tests/plugin.test.cjs` 运行隔离测试，测试不触碰真实笔记或图片。

部署必需文件为 main.js、manifest.json、styles.css 和 LICENSE；其他文件是维护说明与源码，应留在独立项目目录，不放进 .obsidian 的插件运行目录。

## 验证记录（2026-10-10）

- 44 项隔离测试通过，覆盖命名校验、重名、取消、多图、笔记切换/编辑、中文输入法与保存异常等。
- 在当前 Obsidian 1.14.4 中启用，已写入仓库的启用插件列表。
- 用临时笔记实测从 Windows 文件夹复制 PNG 并粘贴：中文弹窗、实际中文文件名、所属笔记的附件目录与正确图片引用均正常。
- 保存后文件与原图的 SHA-256 一致；再次输入同名时预览自动追加 -1，取消后未生成额外图片，正文未改变。
