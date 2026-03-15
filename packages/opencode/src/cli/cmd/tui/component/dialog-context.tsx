import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { useTerminalDimensions } from "@opentui/solid"
import { Show, createMemo, createSignal, type JSX } from "solid-js"
import type {
  AssistantMessage,
  UserMessage,
  Part,
  Provider,
  ToolPart,
} from "@opencode-ai/sdk/v2"

const AVG_TOOL_TOKENS = 200
const AVG_FILE_TOKENS = 500
// Fraction of system prompt estimated as environment info (env vars, cwd, etc.)
const ENV_TOKEN_FRACTION = 0.05

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface ContextBreakdown {
  system: { total: number; environment: number; instructions: number }
  tools: { total: number; mcp: number; skills: number }
  messages: {
    total: number
    userMessages: number
    assistantText: number
    toolCalls: number
    toolResults: number
  }
  other: number
  totalInput: number
  totalOutput: number
  totalReasoning: number
  totalCacheRead: number
  totalCacheWrite: number
  modelLabel: string | undefined
  contextLimit: number | undefined
}

function estimateContextBreakdown(
  messages: (UserMessage | AssistantMessage)[],
  parts: { [messageID: string]: Part[] },
  mcpKeys: string[],
  providers: Provider[],
): ContextBreakdown {
  const lastAssistant = messages.findLast(
    (m) => m.role === "assistant" && m.tokens.output > 0,
  ) as AssistantMessage | undefined

  const lastUser = messages.findLast(
    (m) => m.role === "user",
  ) as UserMessage | undefined

  const totalInput = lastAssistant?.tokens.input ?? 0
  const totalOutput = lastAssistant?.tokens.output ?? 0
  const totalReasoning = lastAssistant?.tokens.reasoning ?? 0
  const totalCacheRead = lastAssistant?.tokens.cache.read ?? 0
  const totalCacheWrite = lastAssistant?.tokens.cache.write ?? 0

  // Model label and context limit
  let modelLabel: string | undefined
  let contextLimit: number | undefined
  if (lastAssistant) {
    modelLabel = lastAssistant.providerID + "/" + lastAssistant.modelID
    const model = providers.find(
      (p) => p.id === lastAssistant.providerID,
    )?.models[lastAssistant.modelID]
    if (model?.limit.context) {
      contextLimit = model.limit.context
    }
  }

  // MCP prefix matching
  const sanitizedMcpPrefixes = mcpKeys.map(
    (key) => key.replace(/[^a-zA-Z0-9_-]/g, "_") + "_",
  )

  // System prompt: split into environment + instructions
  const systemRaw = lastUser?.system ? estimateTokens(lastUser.system) : 0
  const environmentRaw = Math.round(systemRaw * ENV_TOKEN_FRACTION)
  const instructionsRaw = systemRaw - environmentRaw

  // Tools: split into MCP, skills, builtin
  const toolMap = lastUser?.tools ?? {}
  const enabledTools = Object.keys(toolMap).filter((t) => toolMap[t])
  let mcpToolCount = 0
  let skillToolCount = 0
  let builtinToolCount = 0
  for (const toolName of enabledTools) {
    if (sanitizedMcpPrefixes.some((prefix) => toolName.startsWith(prefix))) {
      mcpToolCount++
    } else if (toolName.startsWith("skill_") || toolName === "skill") {
      skillToolCount++
    } else {
      builtinToolCount++
    }
  }
  const toolsTotalRaw =
    (builtinToolCount + mcpToolCount + skillToolCount) * AVG_TOOL_TOKENS
  const mcpRaw = mcpToolCount * AVG_TOOL_TOKENS
  const skillsRaw = skillToolCount * AVG_TOOL_TOKENS

  // Messages by part type
  let userMessagesRaw = 0
  let assistantTextRaw = 0
  let toolCallsRaw = 0
  let toolResultsRaw = 0

  for (const msg of messages) {
    const msgParts = parts[msg.id] ?? []
    for (const part of msgParts) {
      if (msg.role === "user") {
        if (part.type === "text") {
          userMessagesRaw += estimateTokens(part.text)
        } else if (part.type === "file") {
          userMessagesRaw += AVG_FILE_TOKENS
        }
      } else {
        if (part.type === "text") {
          assistantTextRaw += estimateTokens(part.text)
        } else if (part.type === "reasoning") {
          // reasoning tokens are not counted in input on replay
        } else if (part.type === "tool") {
          const tp = part as ToolPart
          const inputStr = JSON.stringify(tp.state.input ?? {})
          toolCallsRaw += estimateTokens(inputStr)
          if (tp.state.status === "completed") {
            toolResultsRaw += estimateTokens(tp.state.output ?? "")
          } else if (tp.state.status === "error") {
            toolResultsRaw += estimateTokens(tp.state.error ?? "")
          }
        }
      }
    }
  }

  const messagesTotalRaw =
    userMessagesRaw + assistantTextRaw + toolCallsRaw + toolResultsRaw
  const estimatedTotal = systemRaw + toolsTotalRaw + messagesTotalRaw

  // Calibrate estimates against actual input tokens (scale=1 if no actual data)
  const scale =
    estimatedTotal > 0 && totalInput > 0 ? totalInput / estimatedTotal : 1

  const cEnvironment = Math.round(environmentRaw * scale)
  const cInstructions = Math.round(instructionsRaw * scale)
  const cSystem = cEnvironment + cInstructions

  const cMcp = Math.round(mcpRaw * scale)
  const cSkills = Math.round(skillsRaw * scale)
  const cToolsTotal = Math.round(toolsTotalRaw * scale)

  const cUserMessages = Math.round(userMessagesRaw * scale)
  const cAssistantText = Math.round(assistantTextRaw * scale)
  const cToolCalls = Math.round(toolCallsRaw * scale)
  const cToolResults = Math.round(toolResultsRaw * scale)
  const cMessages = cUserMessages + cAssistantText + cToolCalls + cToolResults

  const cOther =
    totalInput > 0
      ? Math.max(0, totalInput - cSystem - cToolsTotal - cMessages)
      : 0

  return {
    system: {
      total: cSystem,
      environment: cEnvironment,
      instructions: cInstructions,
    },
    tools: { total: cToolsTotal, mcp: cMcp, skills: cSkills },
    messages: {
      total: cMessages,
      userMessages: cUserMessages,
      assistantText: cAssistantText,
      toolCalls: cToolCalls,
      toolResults: cToolResults,
    },
    other: cOther,
    totalInput,
    totalOutput,
    totalReasoning,
    totalCacheRead,
    totalCacheWrite,
    modelLabel,
    contextLimit,
  }
}

function formatApprox(n: number): string {
  if (n >= 1000) {
    return "~" + (n / 1000).toFixed(1) + "k"
  }
  return "~" + n.toString()
}

function pctOf(value: number, total: number): string {
  if (total === 0) return ""
  return " (" + ((value / total) * 100).toFixed(1) + "%)"
}

function progressBar(fraction: number, width: number): string {
  const clamped = Math.min(1, Math.max(0, fraction))
  const filled = Math.round(clamped * width)
  const empty = width - filled
  return "\u2588".repeat(filled) + "\u2591".repeat(empty)
}

function Row(props: { label: string; value: string; indent?: boolean; bold?: boolean; expanded?: boolean; onClick?: () => void; children?: JSX.Element }) {
  const { theme } = useTheme()
  const prefix = () =>
    props.onClick
      ? props.expanded
        ? "\u25bc "
        : "\u25b6 "
      : props.indent
        ? "    "
        : ""
  return (
    <box>
      <box flexDirection="row" justifyContent="space-between">
        <text
          fg={props.indent ? theme.textMuted : theme.text}
          onMouseUp={props.onClick}
          attributes={props.bold || props.onClick ? TextAttributes.BOLD : undefined}
        >
          <span style={{ fg: theme.textMuted }}>{prefix()}</span>
          <span>{props.label}</span>
        </text>
        <text fg={theme.textMuted}>{props.value}</text>
      </box>
      {props.children}
    </box>
  )
}

export function DialogContext() {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()
  const route = useRoute()

  const [systemExpanded, setSystemExpanded] = createSignal(false)
  const [toolsExpanded, setToolsExpanded] = createSignal(false)
  const [messagesExpanded, setMessagesExpanded] = createSignal(true)

  const messages = createMemo(() => {
    const id = route.data.type === "session" ? route.data.sessionID : undefined
    return id ? (sync.data.message[id] ?? []) : []
  })

  const mcpKeys = createMemo(() => Object.keys(sync.data.mcp))

  const breakdown = createMemo(() => {
    const msgs = messages()
    if (msgs.length === 0) return undefined
    return estimateContextBreakdown(
      msgs,
      sync.data.part,
      mcpKeys(),
      sync.data.provider,
    )
  })

  const contextLimit = createMemo(() => breakdown()?.contextLimit)

  // Total tokens: use LLM-reported input when available, otherwise sum of estimates
  const totalTokens = createMemo(() => {
    const b = breakdown()
    if (!b) return 0
    if (b.totalInput > 0) {
      return (
        b.totalInput +
        b.totalOutput +
        b.totalReasoning +
        b.totalCacheRead +
        b.totalCacheWrite
      )
    }
    return b.system.total + b.tools.total + b.messages.total + b.other
  })

  const fmtVal = (value: number) => {
    const limit = contextLimit()
    return formatApprox(value) + (limit ? pctOf(value, limit) : "")
  }

  const dimensions = useTerminalDimensions()
  const breakdownHeight = createMemo(() => Math.max(4, Math.floor(dimensions().height * 0.2)))

  return (
    <box paddingLeft={2} paddingRight={2}>
      {/* Title module */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Context
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>

      <Show
        when={breakdown()}
        fallback={
          <box marginTop={1}>
            <text fg={theme.textMuted}>
              No context data available. Start a conversation first.
            </text>
          </box>
        }
      >
        {(b) => (
          <>
            {/* Model module */}
            <Show when={b().modelLabel}>
              {(label) => (
                <box marginTop={1}>
                  <text fg={theme.text}>
                    <span style={{ fg: theme.textMuted }}>Model: </span>
                    {label()}
                  </text>
                </box>
              )}
            </Show>

            {/* Context breakdown module (scrollable) */}
            <scrollbox
              height={breakdownHeight()}
              marginTop={1}
              scrollbarOptions={{
                visible: false,
              }}
            >
              <Row
                label="System"
                value={fmtVal(b().system.total)}
                expanded={systemExpanded()}
                onClick={() => setSystemExpanded(!systemExpanded())}
              >
                <Show when={systemExpanded()}>
                  <Row label="Environment" value={fmtVal(b().system.environment)} indent />
                  <Row label="Instructions" value={fmtVal(b().system.instructions)} indent />
                </Show>
              </Row>

              <Row
                label="Tools"
                value={fmtVal(b().tools.total)}
                expanded={toolsExpanded()}
                onClick={() => setToolsExpanded(!toolsExpanded())}
              >
                <Show when={toolsExpanded()}>
                  <Row label="Mcp" value={fmtVal(b().tools.mcp)} indent />
                  <Row label="Skills" value={fmtVal(b().tools.skills)} indent />
                </Show>
              </Row>

              <Row
                label="Messages"
                value={fmtVal(b().messages.total)}
                expanded={messagesExpanded()}
                onClick={() => setMessagesExpanded(!messagesExpanded())}
              >
                <Show when={messagesExpanded()}>
                  <Row label="User Messages" value={fmtVal(b().messages.userMessages)} indent />
                  <Row label="Assistant Text" value={fmtVal(b().messages.assistantText)} indent />
                  <Row label="Tool Calls" value={fmtVal(b().messages.toolCalls)} indent />
                  <Row label="Tool Results" value={fmtVal(b().messages.toolResults)} indent />
                </Show>
              </Row>

              <Row label="Other" value={fmtVal(b().other)} bold />
            </scrollbox>

            {/* Separator module */}
            <box marginTop={1} border={["top"]} borderColor={theme.textMuted} />

            {/* Total module */}
            <box marginTop={1} marginBottom={1}>
              <box flexDirection="row" justifyContent="space-between">
                <text fg={theme.text} attributes={TextAttributes.BOLD}>
                  Total
                </text>
                <text fg={theme.textMuted}>
                  <Show
                    when={contextLimit()}
                    fallback={formatApprox(totalTokens()) + " tokens"}
                  >
                    {(limit) => (
                      <span>
                        {formatApprox(totalTokens()) +
                          " / " +
                          formatApprox(limit()) +
                          " tokens" +
                          pctOf(totalTokens(), limit())}
                      </span>
                    )}
                  </Show>
                </text>
              </box>
              <Show when={contextLimit()}>
                {(limit) => (
                  <text fg={theme.success} width="100%" wrapMode="none">
                    {progressBar(totalTokens() / limit(), 200)}
                  </text>
                )}
              </Show>
            </box>
          </>
        )}
      </Show>
    </box>
  )
}
