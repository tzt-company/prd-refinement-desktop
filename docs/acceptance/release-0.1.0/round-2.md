# Round 2：v0.1.0 tag 发布验证

日期：2026-09-14

## FAIL 证据

- GitHub Actions run `34797497917` 绑定 tag `v0.1.0` 和源码 `2cfee85c8dbf56637d63a9d014084ad1c3001dec`，最终结论为 `failure`。
- Windows 与 macOS job 的 203 个测试均通过，两个平台的安装包也已进入产物生成阶段。
- 两个平台随后均报错 `GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"`；根因是 `electron-builder` 在 tag 环境自动选择发布行为。
- 两个平台的上传步骤均跳过，Release job 因依赖失败而跳过；因此不得声称 `v0.1.0` 已发布。

## 后续处理

- 在打包脚本显式传入 `--publish never`，将安装包构建与唯一持有 `contents: write` 权限的 Release job 分离。
- 不改写远程 `v0.1.0` 标签；修复后使用 `v0.1.1` 重新发布。
