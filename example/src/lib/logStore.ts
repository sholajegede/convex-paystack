import { createContext, useContext } from "react";

export type LogLevel = "info" | "success" | "error";

export type LogEntry = {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
};

export type LogContextValue = {
  logs: LogEntry[];
  log: (message: string, level?: LogLevel) => void;
  clear: () => void;
};

export const LogContext = createContext<LogContextValue | null>(null);

/**
 * A tiny in-memory log the whole app can write to — client-side actions
 * (starting a checkout, verifying a reference) that never touch Convex
 * storage, so they can't come from a reactive query. The Console
 * component merges this with the component's real `listRecentEvents`
 * webhook log to show the full lifecycle in one place.
 */
export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) {
    throw new Error("useLog must be used within a LogProvider");
  }
  return ctx;
}
