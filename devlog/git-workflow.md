# Fork 多 PR 开发工作流

## 一、角色约定

- **upstream**：上游仓库（如 `anomalyco/opencode`），主开发分支 `dev`
- **origin**：自己的 fork（如 `AvatarGanymede/opencode-dev`）
- **dev**：本地/fork 的 dev 分支，可包含 devlog、脚本等个人提交，不直接用来提 PR
- **feature/xxx**：从 dev 创建的功能分支，提 PR 前做一次「清洗」，使 PR 只包含该功能的提交

## 二、日常：同步 upstream 并在 dev 上写 devlog

每天或每次准备新功能前，让 dev 跟上上游，并可在 dev 上写个人内容：

```bash
git checkout dev
git fetch upstream
git rebase upstream/dev    # 或 git merge upstream/dev
git push origin dev

# 在 dev 上写好 devlog 等内容后，提交并推送：
git add devlog/
git commit -m "docs(devlog): <描述>"
git push origin dev
# 这些提交不会进入后续的 feature PR
```

## 三、从 dev 创建 feature 分支并开发

功能分支从 **fork 的 dev** 创建，开发时能用到 dev 上的 devlog、脚本等：

```bash
git checkout dev
git checkout -b feature/<feature-name>

# 在 feature 分支上开发
git add ...
git commit -m "feat: <描述>"
# 可多次提交
```

此时 `feature/<feature-name>` 的历史 = upstream 提交 + dev 上的个人提交（如 devlog）+ 本功能的提交。若直接提 PR，会把 dev 的个人提交带进去，因此需在提 PR 前做「清洗」。

## 四、feature 分支日常与 upstream dev 保持同步

开发过程中或 PR 挂起时，上游可能有新提交，建议定期把 feature 分支与 `upstream/dev` 对齐，减少冲突、便于合并。

**情况 A：尚未做「清洗」**（feature 仍基于 dev，历史里还带着 devlog）

通过 dev 间接同步：先更新 dev，再把 feature 接到最新的 dev 上：

```bash
# 1. 更新 dev
git checkout dev
git fetch upstream
git rebase upstream/dev
bun install
git push origin dev

# 2. 在 feature 分支上接到最新 dev 后面
git checkout feature/<feature-name>
git rebase dev
```

这样 feature 会包含 upstream 经 dev 带来的新提交，你的功能提交仍在最上面。若已 push 过该 feature，同步后需：`git push -f origin feature/<feature-name>`。

**情况 B：已做过「清洗」或正在 PR 审核**（feature 已直接基于 upstream/dev）

直接让 feature 基于最新的 upstream/dev 即可（与下文「七、PR 审核期间同步」相同）：

```bash
git checkout feature/<feature-name>
git fetch upstream
git rebase upstream/dev
git push -f origin feature/<feature-name>
```

建议：准备提 PR 前或 PR 审核中，至少做一次与 upstream/dev 的同步，再 push，避免 PR 落后太多。

## 五、提 PR 前清洗：只保留 feature 的提交（仅做一次）

目标：PR 里只出现「该 feature 分支上的功能提交」，不包含 dev 上的 devlog 等。

用 `rebase --onto` 把「相对 dev 新增的提交」接到 `upstream/dev` 后面：

```bash
git checkout feature/<feature-name>
git fetch upstream

# 把 (feature 相对 dev 的新增提交) 接到 upstream/dev 后面
git rebase --onto upstream/dev dev feature/<feature-name>
```

成功后，该 feature 分支历史 = `upstream/dev` + 本功能的提交，不再包含 dev 的个人提交。

若该分支已 push 过，需强推：

```bash
git push -f origin feature/<feature-name>
```

## 六、在 GitHub 上创建 PR

- **base**：upstream 的 `dev`（如 `anomalyco/opencode:dev`）
- **compare**：自己 fork 的 `feature/<feature-name>`

PR 将只包含该 feature 的提交。

## 七、PR 审核期间同步 upstream

若 upstream/dev 有更新，在 feature 分支上按「情况 B」rebase 即可：

```bash
git checkout feature/<feature-name>
git fetch upstream
git rebase upstream/dev
git push -f origin feature/<feature-name>
```

dev 可继续独立演化（写 devlog 等），不影响已清洗过的 feature 分支。