import type { CopilotAction } from "./contracts"
import { CopilotRuntimeError } from "./contracts"

const recordAudit: CopilotAction = async (input, context) => ({
  recorded: true,
  workflowRunId: context.workflowRunId,
  actionIdempotencyKey: context.idempotencyKey,
  input,
})

const ACTIONS: Readonly<Record<string, CopilotAction>> = Object.freeze({
  recordAudit,
})

export function resolveCopilotAction(actionKey: string): CopilotAction {
  const action = ACTIONS[actionKey]
  if (!action) {
    throw new CopilotRuntimeError(
      "BAD_REQUEST",
      `Unsupported actionKey ${actionKey}. Only explicit server-owned actions can execute.`,
    )
  }
  return action
}

export function listCopilotActionKeys(): readonly string[] {
  return Object.freeze(Object.keys(ACTIONS))
}
