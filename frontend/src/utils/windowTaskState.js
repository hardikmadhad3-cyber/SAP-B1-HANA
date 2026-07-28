const isMergeableTaskState = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasDocumentDraft = (state) =>
  isMergeableTaskState(state)
  && Object.keys(state).some((key) => /draft$/i.test(key));

export const mergeWindowTaskState = (existingState, nextState) => {
  if (nextState === undefined) {
    return existingState;
  }

  if (!isMergeableTaskState(existingState) || !isMergeableTaskState(nextState)) {
    return nextState;
  }

  if (hasDocumentDraft(nextState)) {
    return nextState;
  }

  if (hasDocumentDraft(existingState)) {
    return {
      ...existingState,
      ...(nextState.sapWindow ? { sapWindow: nextState.sapWindow } : {}),
    };
  }

  return {
    ...existingState,
    ...nextState,
  };
};

export default mergeWindowTaskState;
