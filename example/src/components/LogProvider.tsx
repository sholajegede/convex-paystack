import { useCallback, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { LogContext, type LogEntry, type LogLevel } from "../lib/logStore";

export function LogProvider({ children }: PropsWithChildren) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const counter = useRef(0);

  const log = useCallback((message: string, level: LogLevel = "info") => {
    counter.current += 1;
    const entry: LogEntry = {
      id: `client-${Date.now()}-${counter.current}`,
      ts: Date.now(),
      level,
      message,
    };
    setLogs((prev) => [...prev.slice(-99), entry]);
  }, []);

  const clear = useCallback(() => setLogs([]), []);

  return <LogContext.Provider value={{ logs, log, clear }}>{children}</LogContext.Provider>;
}
