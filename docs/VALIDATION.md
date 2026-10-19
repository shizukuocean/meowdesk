# 公开源码验证记录

日期：2026-10-19。对象为本公开副本，来源是 2026-07-10 的 `9883004`，不把旧内部报告当作本次验证结果。

## 已通过

| 检查 | 结果 |
|---|---|
| `npm run typecheck:renderer` | TypeScript 检查 exit 0 |
| `npm run build:renderer` | Vite 构建 exit 0，1869 modules |
| `npm run test:workbench-contract` | MVP baseline 和工作台契约通过；35 个桥接方法匹配 |
| `npm run test:runtime-safety` | 本地打开边界、vault 读取、产品包路径、工具启动与会话隔离等现有检查通过 |
| `npm run test:meow-viewer-parser` | 现有 fixtures 通过，包含匿名化设备路径样例 |
| 脱敏脚本语法 | `dev-helper-acceptance-check.js`、`project-evaluation-packet.js` 的 node syntax check 通过 |
| Electron 启动 | `node scripts/renderer-smoke.js next --scenario next-route-hash --screenshot docs/images/current-lobby.png` exit 0；到达 `#lobby`，截图非空 |

本次使用原本机已安装的依赖进行检查，公开副本的 node_modules 通过临时目录联接使用它们；联接和依赖目录不提交。没有把这次检查称为全新机器上的 `npm ci` 验收。

环境：Windows，Node.js 24.15，Electron 33.4.11，React 19.2.6，TypeScript 6.0.3，Vite 8.0.14，node-pty 1.1.0。

## 未验证与已知边界

- 未在干净新电脑安装全部依赖；尤其原生 node-pty / Electron 安装可能取决于本机工具链。
- 本轮没有跑完整 `verify:renderer` 的所有历史场景、真实第三方 Agent 交互、打包升级/回滚、安装程序或签名验证。
- 外部 Dev Helper 私人验收账本没有公开，没有用空数据证明原来的业务验收通过。需要该检查时，维护者应自行提供 `MEOWDESK_DEV_HELPER_DATA_DIR`。
- 不能据此声称正式发布、最终视觉验收、所有平台兼容或商业化验证通过。
- B 机 7 月 11 日未提交的 Hermes SQLite / Viewer 兼容修复不在本源码内，当前版本对该 Hermes 版本的真实会话显示仍有已知缺口。

## 隐私检查

公开前逐项检查提交文件。原始密钥扫描匹配到的三处 `meowdesk.devLedger.records.v1` 是同一个固定 localStorage 命名空间，分别位于实现、测试和说明文档；经人工确认后仅对此固定值进行精确放行，不关闭密钥检测规则。生成的 dist 和第三方 node_modules 不在发布集合。

使用隔离用户数据生成 README 截图，不上传真实对话、个人文件、知识库或运行数据。审计与来源范围见 [源码来源](../SOURCE_PROVENANCE.md)。
