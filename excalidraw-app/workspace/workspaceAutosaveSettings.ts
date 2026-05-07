export const WORKSPACE_AUTOSAVE_MINUTES_KEY =
  "excalidraw-workspace-autosave-minutes";

export const WORKSPACE_AUTOSAVE_CHANGED_EVENT =
  "excalidraw-workspace-autosave-changed";

export const WORKSPACE_AUTOSAVE_MIN_MINUTES = 0;
export const WORKSPACE_AUTOSAVE_MAX_MINUTES = 120;

/** 0 = autosave off; positive integer = interval in minutes. */
export const getWorkspaceAutosaveMinutes = (): number => {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(WORKSPACE_AUTOSAVE_MINUTES_KEY);
  if (raw === null || raw === "") {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(
    WORKSPACE_AUTOSAVE_MAX_MINUTES,
    Math.max(WORKSPACE_AUTOSAVE_MIN_MINUTES, parsed),
  );
};

export const setWorkspaceAutosaveMinutes = (minutes: number) => {
  if (typeof window === "undefined") {
    return;
  }

  const next = Math.min(
    WORKSPACE_AUTOSAVE_MAX_MINUTES,
    Math.max(
      WORKSPACE_AUTOSAVE_MIN_MINUTES,
      Math.round(Number.isFinite(minutes) ? minutes : 0),
    ),
  );

  window.localStorage.setItem(WORKSPACE_AUTOSAVE_MINUTES_KEY, String(next));
  window.dispatchEvent(new Event(WORKSPACE_AUTOSAVE_CHANGED_EVENT));
};
