# 提 PR 指南速查

下面是对本项目“提 PR（Pull Request）”要求的精简整理，按你在提交流程中最需要的顺序来写。

## 1. 提 PR 前：必须先关联 Issue

- 所有 PR 都必须引用/关联已有的 Issue；未关联的 PR 可能会在没有评审的情况下被关闭。来源见 `CONTRIBUTING.md` 的 *Issue First Policy*。  
- 在 PR 描述里使用 `Fixes #123` 或 `Closes #123` 来链接对应 Issue。  

## 2. PR 规模与描述要求

- 保持 PR 小而聚焦（small and focused）。
- 清楚解释：这个变更修复了什么问题，以及“为什么你的改动能解决它”。
- 在逻辑改动（非 UI）中要写明验证信息：你测了什么、reviewer 如何复现/确认修复是否有效。

## 3. UI 变更：需要前后对比材料

如果你的 PR 包含 UI 改动，请附上截图或录屏，展示改动前与改动后的效果（before/after）。  

## 4. 避免长篇 AI 生成文本

- 不接受“大段明显 AI 生成的 PR 描述/问题描述”（可能被忽略或直接关闭）。
- 写法要求是：短而聚焦，用你自己的话解释“改了什么、为什么这么做”；如果你不能理解/解释，也至少要说明你到什么程度，并让维护者能判断 PR 的价值。

## 5. PR 标题（Title）规范：conventional commit

PR 标题建议使用下列前缀之一（也可带 scope 表示影响范围）：

- `feat:` 新功能/能力
- `fix:` bug 修复
- `docs:` 文档/README 变更
- `chore:` 维护/依赖更新等
- `refactor:` 重构但不改变行为
- `test:` 新增/更新测试

可选 scope 示例：

- `feat(app): ...`
- `fix(desktop): ...`
- `chore(opencode): ...`

## 6. `.github/pull_request_template.md`：模板逐项填写

你在 GitHub 创建 PR 时，会看到模板里的这些必填/建议项（不按模板可能会被自动拒绝）：

- `Issue for this PR`：在这里用 `Closes #...`/`Fixes #...` 填写关联的 Issue
- `Type of change`：勾选变更类型（Bug fix / New feature / Refactor / Documentation）
- `What does this PR do?`：描述问题、你做了哪些改动、以及为什么这些改动有效  
- `How did you verify your code works?`：写验证过程（本地测试/可复现步骤）
- `Screenshots / recordings`：UI 变更附截图/录屏
- `Checklist`：
  - 已在本地测试（`I have tested my changes locally`）
  - 不包含无关改动（`I have not included unrelated changes in this PR`）

## 引用来源

- `CONTRIBUTING.md`：提 PR 的总体期望、issue 先行、UI/逻辑改动验证、PR 标题规范、以及避免 AI 生成长文本的规则  
  - 链接：[`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- `.github/pull_request_template.md`：PR 模板字段说明与自动拒绝/忽略的提醒  
  - 链接：[`../.github/pull_request_template.md`](../.github/pull_request_template.md)

