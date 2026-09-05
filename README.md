# Research Reader

Research Reader 是一个面向生物医学英文文献的本地优先 macOS 阅读器。

本项目源代码采用 [Apache License 2.0](LICENSE) 发布。第三方依赖仍受其各自许可证约束。

当前版本已经实现：

- PDF 文件导入与 PDF.js 页面渲染
- 示例论文阅读页、页码跳转、70%–500% 缩放和移动端布局
- 选中文字后的浮动工具栏
- 可插拔翻译 Provider 接口、默认 MyMemory 在线英译中和离线 Local glossary demo
- Vocabulary、Writing、Knowledge、Method、Data、Figure、Idea 七类 Quick Save
- 知识库全文检索、类型/标签筛选、时间线和跳回原页
- ChatGPT Prompt 生成、复制与打开网页入口
- Figure 区域框选、PNG 截图预览、页码/边界框/哈希元数据和 Knowledge 关联
- JSON、Markdown、CSV、XLSX、BibTeX、RIS、Anki TSV、完整 ZIP 归档和本地备份下载
- localStorage 持久化元数据、IndexedDB 持久化导入 PDF 与自动备份快照
- 可拖拽调整 PDF 与右侧 inspector 宽度，双击分隔条可恢复默认宽度
- 侧栏 Collection/Tag 筛选与本地新增、阅读器搜索/书签/适配宽度和按钮状态反馈
- 深色高对比 Research Reader Dock 图标与浏览器 favicon
- SwiftUI 原生 macOS 窗口、Dock 进程、File 菜单、⌘O、PDF 文件关联和 WKWebView 本地资源协议

## 启动

```bash
pnpm install
pnpm dev
```

也可以直接使用已安装依赖：

```bash
./node_modules/.bin/vite --host 127.0.0.1 --port 4173
```

浏览器打开 `http://127.0.0.1:4173`。

## 构建并运行 macOS 应用

```bash
./script/build_and_run.sh --verify
```

脚本会先构建 React 资源，再用 SwiftPM 编译原生 macOS 壳，生成并启动：
`dist/ResearchReader.app`。也支持 `run`、`--debug`、`--logs`、`--telemetry`。

原生壳负责窗口、菜单、PDF 文件面板、文件关联和本地资源协议；阅读器界面继续复用已验证的 React/PDF.js 实现。点击原生 File → Open PDF… 或 ⌘O 后，PDF 会通过原生桥接送入本地阅读器。

## 打包与 GitHub Release

本地生成不启动应用的发布 ZIP：

```bash
PACKAGE_VERSION=0.1.0 ./script/build_and_run.sh package
```

推送 `v*` 标签后，`.github/workflows/macos-release.yml` 会在 macOS runner 上重新构建并创建 GitHub Release。当前构建面向 Apple Silicon（arm64），尚未配置 Developer ID 签名与 Apple 公证；未签名下载包可能需要在系统设置中手动允许打开。

## 与实施计划的边界

当前 macOS 版本采用 SwiftUI + WKWebView + SwiftPM，而不是强行引入缺失的 Rust/Tauri 工具链。它已经是可启动的 `.app`，但尚未做 Developer ID 签名、公证和 DMG 发布；生产发布时还需要补充签名、公证、自动更新和更细粒度的原生 SQLite/Keychain 迁移。当前数据仍由 WebKit 本地数据存储承载：元数据使用 localStorage，PDF 与 Figure 资产使用 IndexedDB。

MyMemory 在线翻译需要网络，并会把选中的文本发送到第三方翻译服务；敏感内容可在 Settings → Translation 切换到离线 Local glossary。Baidu 选项仍需要安全后端配置，不会把密钥放进前端。ZIP 归档会尽可能带上 IndexedDB 中已保存的原始 PDF，并同时包含知识库、Figure PNG、sidecar 元数据、Markdown、表格和文献目录。

邮箱注册/登录暂不加入当前版本：本软件的定位仍是本地优先科研阅读，账户体系会引入服务端、密码重置、会话、同步冲突和临床/未发表数据隐私责任。只有在确定要做跨设备同步、团队共享或云端备份后，再单独设计账户与安全架构。
