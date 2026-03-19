# feature/session-context-usage

## 零、需求来源

- issue：[`anomalyco/opencode#6152`](https://github.com/anomalyco/opencode/issues/6152)
- 需求核心：提供一个类似 Claude `/context` 的能力，用 TUI dialog 展示当前 session 的 context window usage breakdown，回答“到底是什么在吃掉上下文窗口”这个问题。

从需求描述看，这个 feature 的目标非常明确：

- 展示当前会话上下文消耗
- 对上下文消耗做分项拆解
- 通过估算结合实际 token 使用量做校准
- 尽量避免打断聊天主流程，因此优先采用 dialog 形式而不是直接污染聊天记录

## 一、提交概览

- 提交：`2093380bb`
- 标题：`Add context usage dialog and keybind`
- 目的：在 TUI 中新增一个“上下文使用情况”查看入口，帮助用户快速了解当前会话消耗了多少 context window，并按来源拆解 token 使用。

本次变更共涉及 4 个文件，其中核心是新增 `DialogContext` 组件，并把它接入命令面板、默认快捷键和提示文案。整体实现方向与 issue 中提出的设想基本一致，只是当前版本直接基于现有 TUI 数据进行本地估算与展示。

## 二、用户侧能力变化

这次提交带来的直接能力有：

- 可以通过命令面板打开新的 “View context” 对话框。
- 可以通过 slash command `/context` 进入该对话框。
- 可以通过快捷键 `Ctrl+X I` 进入该对话框，对应配置项为 `context_view`，默认值是 `<leader>i`。
- 对话框会展示当前会话的上下文消耗情况，包括总量、模型上下文上限、占比，以及分项明细。

换句话说，这个功能把原本“黑盒”的上下文消耗显式展示出来，方便用户判断当前会话是否接近模型上下文上限。

## 三、代码层面的主要改动

### 1. 新增 `DialogContext` 组件

新增文件：`packages/opencode/src/cli/cmd/tui/component/dialog-context.tsx`

这是本次提交的主体，实现了一个专门用于展示 context usage 的对话框。核心职责包括：

- 从当前 session 中读取消息、消息 parts、MCP 信息和 provider/model 信息。
- 估算不同来源的 token 消耗。
- 展示总 token 用量、context limit、使用比例和进度条。
- 支持对 `System`、`Tools`、`Messages` 三类数据做展开/收起查看。

组件内部将上下文拆成以下几个大类：

- `System`
- `Tools`
- `Messages`
- `Other`

其中：

- `System` 再拆成 `Environment` 和 `Instructions`
- `Tools` 再拆成 `Mcp` 和 `Skills`
- `Messages` 再拆成 `User Messages`、`Assistant Text`、`Tool Calls`、`Tool Results`

这种拆分方式的价值在于，用户不仅知道“总共用了多少”，还能大致看出“主要是哪里用掉的”。

### 2. 在应用命令列表中接入入口

修改文件：`packages/opencode/src/cli/cmd/tui/app.tsx`

这里做了两件事：

- 引入 `DialogContext`
- 新增一条命令：
  - 标题：`View context`
  - value：`context.view`
  - keybind：`context_view`
  - slash：`/context`
  - 分类：`Session`

用户选择该命令后，会调用 `dialog.replace(() => <DialogContext />)` 打开新对话框。

### 3. 新增默认快捷键配置

修改文件：`packages/opencode/src/config/config.ts`

新增配置项：

```ts
context_view: z.string().optional().default("<leader>i").describe("View context usage")
```

这意味着该功能不仅能从命令面板和 slash command 进入，也被纳入统一的可配置快捷键体系中。

### 4. 更新提示文案

修改文件：`packages/opencode/src/cli/cmd/tui/component/tips.tsx`

新增提示：

```text
Use /context or Ctrl+X I to view context window usage breakdown
```

这样用户在日常使用 TUI 时，就更容易发现这个新能力。

## 四、上下文估算逻辑

这个功能的关键不是“读取一个现成字段然后展示”，而是做了一层“估算 + 校准”。

### 1. 基础估算方法

组件里提供了一个非常直接的 token 估算函数：

```ts
Math.ceil(text.length / 4)
```

也就是用“字符数 / 4”近似估算 token 数。这类估算不是精确 tokenizer，但足够轻量，适合在 TUI 实时展示。

### 2. 一些启发式常量

代码中还定义了几个经验值：

- `AVG_TOOL_TOKENS = 200`
- `AVG_FILE_TOKENS = 500`
- `ENV_TOKEN_FRACTION = 0.05`

含义分别是：

- 每个工具默认按约 200 tokens 估算
- 用户消息中每个文件 part 默认按约 500 tokens 估算
- system prompt 中约 5% 视作环境信息，其余视作指令信息

这说明作者并不是追求 tokenizer 级别的严格精度，而是在“可解释、低成本、可实时展示”之间做了折中。

### 3. 使用真实 token 数据做校准

仅靠启发式估算可能偏差较大，所以组件又利用最近一次 assistant 消息里已有的真实 token 数据来做缩放校准。

主要读取的是真实统计值：

- `input`
- `output`
- `reasoning`
- `cache.read`
- `cache.write`

估算出各部分原始值后，再通过：

```ts
scale = totalInput / estimatedTotal
```

把各分类结果统一缩放到更接近模型实际记录的输入 token。这样做的优点是：

- 保留分类明细的可解释性
- 同时减少纯经验估算带来的整体偏差

### 4. 总量展示逻辑

如果存在 LLM 上报的真实 `totalInput`，组件会把以下值汇总为总 token：

- `input`
- `output`
- `reasoning`
- `cache.read`
- `cache.write`

如果没有真实数据，则退回到估算结果求和。

这保证了在不同数据完整度下，这个对话框都能给出一个可用结果。

## 五、界面表现

从 UI 上看，这个对话框大致包含以下模块：

- 标题区：显示 `Context`，并提供 `esc` 关闭提示
- 模型区：显示当前模型标识，如 `provider/model`
- 明细区：滚动显示 `System / Tools / Messages / Other`
- 总量区：显示总 token 与 context limit 的关系
- 进度条：用字符块直观表示使用比例

其中明细区支持展开/收起，适合在终端有限空间里查看不同层次的信息。

## 六、这次实现的价值

这次提交解决的是“上下文使用不可见”的问题，具体价值包括：

- 让用户更容易感知当前会话是否逼近 context limit
- 帮助判断 token 主要消耗在系统提示、消息历史还是工具调用上
- 为后续做会话裁剪、上下文压缩、提示词优化等能力提供观察基础
- 通过命令、slash、快捷键、tips 四个入口一起接入，降低了新功能的发现门槛

## 七、注意点与局限

虽然这个功能已经很实用，但它本质上仍然是“估算型可视化”，要注意以下几点：

- `System`、`Tools`、`Messages` 的细分值不是 tokenizer 精确结果，而是启发式估算。
- `Environment` 占 `System` 的 5% 属于经验假设，不一定适用于所有 provider 或 prompt 结构。
- `AVG_TOOL_TOKENS`、`AVG_FILE_TOKENS` 也属于粗粒度近似。
- `Other` 本质上是一个兜底项，用来吸收无法精确归类但已计入总输入的部分。

因此，这个对话框更适合用于“趋势判断”和“结构分析”，而不是做严格的计费核算。

## 八、可复用结论

如果后续要继续演进这个功能，这次提交沉淀出的几个思路值得复用：

- 当底层缺少完整精确统计时，可以先做“启发式分解 + 实际值校准”。
- 新功能接入时，最好同时覆盖命令入口、快捷键入口和提示文案入口。
- 对终端界面来说，分层展示和可折叠明细比一次性铺满信息更易读。
- 与上下文相关的可视化，一旦上线，就能直接帮助后续性能优化和提示词治理。
