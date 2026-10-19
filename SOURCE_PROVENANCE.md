# 源码来源与公开边界

- 产品：Meowdesk；早期名称 Meodesk，内部兼容名称沿用。
- 包版本：0.2.0；开发源码基线日期：2026-07-10。
- 来源分支：`claude/tech-debt-phase1`。
- 原始本地提交：`9883004cf0521ebaceb53b156dbad5edf62ebe55`。
- 公开整理日期：2026-10-19。
- 本仓库是该提交的独立公开快照，不包含原工程 Git 历史，也不会自动同步本机开发目录。
- 未包含 B 机 2026-07-11 尚未提交的 Hermes SQLite / Viewer 修复；不将其当作已合入功能。

保留产品源代码、资源、构建配置、lock、测试、架构和历史设计说明。省略 `docs/analysis/` 中含机器路径与外部私人验收信息的旧生成报告；原有审计脚本可重新生成本机报告，历史结果不代表此公开快照的验证结果。历史设计文件只用于追溯，以 README、当前代码和 VALIDATION 为准。

个人设备用户名已替换为匿名样例；文档中的设备路径及生成审阅提示中的路径已泛化；外部 Dev Helper 验收脚本的私人默认路径改为本仓库 `tmp/external-acceptance`，仍支持 `MEOWDESK_DEV_HELPER_DATA_DIR`。没有改变产品界面、功能、运行时数据目录或 Agent 协作逻辑。

不包含 node_modules、dist/out、缓存、真实用户配置、对话记录、Obsidian/Brain2 知识库、凭据或安装包。构建与运行检查见 [VALIDATION](docs/VALIDATION.md)。
