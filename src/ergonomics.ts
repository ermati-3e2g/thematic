import type { AiSettings, ErgonomicsProjectState, ErgonomicsSettings } from "./types";

export function defaultErgonomicsProject(): ErgonomicsProjectState {
  return {
    focusItems: [],
    recoveryCheckpoints: [],
    drafts: [],
    sessionCompletedItems: 0,
  };
}

export function defaultErgonomicsSettings(): ErgonomicsSettings {
  return {
    density: "comfortable",
    showResumePrompt: true,
    breakReminders: false,
    breakIntervalMinutes: 50,
    sessionTargetKind: "none",
    sessionTargetValue: 4,
    quickCapture: true,
    projects: {},
  };
}

export function normalizeErgonomics(settings: AiSettings): ErgonomicsSettings {
  const fallback = defaultErgonomicsSettings();
  const current = settings.ergonomics;
  return {
    ...fallback,
    ...current,
    density: current?.density && ["comfortable", "compact", "presentation"].includes(current.density) ? current.density : fallback.density,
    breakIntervalMinutes: Math.min(180, Math.max(15, current?.breakIntervalMinutes ?? fallback.breakIntervalMinutes)),
    sessionTargetValue: Math.min(100, Math.max(1, current?.sessionTargetValue ?? fallback.sessionTargetValue)),
    projects: Object.fromEntries(Object.entries(current?.projects ?? {}).map(([projectId, project]) => [projectId, {
      ...defaultErgonomicsProject(),
      ...project,
      focusItems: project.focusItems ?? [],
      recoveryCheckpoints: project.recoveryCheckpoints ?? [],
      drafts: project.drafts ?? [],
    }])),
  };
}

export function projectErgonomics(settings: AiSettings, projectId: string): ErgonomicsProjectState {
  return normalizeErgonomics(settings).projects[projectId] ?? defaultErgonomicsProject();
}
