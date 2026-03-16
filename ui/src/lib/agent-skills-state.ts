export interface AgentSkillDraftState {
  draft: string[];
  lastSaved: string[];
  hasHydratedSnapshot: boolean;
}

export interface AgentSkillSnapshotApplyResult extends AgentSkillDraftState {
  shouldSkipAutosave: boolean;
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function applyAgentSkillSnapshot(
  state: AgentSkillDraftState,
  desiredSkills: string[],
): AgentSkillSnapshotApplyResult {
  const shouldReplaceDraft = !state.hasHydratedSnapshot || arraysEqual(state.draft, state.lastSaved);

  return {
    draft: shouldReplaceDraft ? desiredSkills : state.draft,
    lastSaved: desiredSkills,
    hasHydratedSnapshot: true,
    shouldSkipAutosave: shouldReplaceDraft,
  };
}
