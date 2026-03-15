- 每天 / 每次准备新功能前
```bash
git checkout dev
git fetch upstream
git rebase upstream/dev
git push origin dev
```
- 新功能 F 的完整流程
```bash
git checkout dev
git checkout -b feature/F-something

# 开发...
git add ...
git commit -m "feat: F xxx"

git push -u origin feature/F-something
# 去 GitHub 从 origin/feature/F-something -> upstream/dev 创建 PR
```
- PR review 中，同步 upstream 的更新
```bash
git checkout feature/F-something
git fetch upstream
git rebase upstream/dev
# 解决冲突
git push -f origin feature/F-something
```
- 开 feature 分支
```bash
# 切回本地的 dev 分支
git checkout dev

# 从 upstream 拉取最新代码
git fetch upstream

# 用 upstream/dev 更新本地 dev（推荐 rebase，历史更干净）
git rebase upstream/dev

# 把同步后的 dev 推回自己的 fork（可选，但通常推荐）
git push origin dev

# 确保在最新的 dev 上
git checkout dev
git pull origin dev   # 或 fetch+rebase 如上

# 从 dev 创建功能分支
git checkout -b feature/xxx
```