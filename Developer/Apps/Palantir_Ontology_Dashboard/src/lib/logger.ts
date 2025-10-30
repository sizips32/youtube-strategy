type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = import.meta.env.DEV === true;

function log(level: LogLevel, ...args: unknown[]) {
  if (!isDev && (level === "debug" || level === "info")) {
    return; // drop low-level logs in production
  }
  const prefix = "[OntologyDash]";
  switch (level) {
    case "debug":
      return console.debug(prefix, ...args);
    case "info":
      return console.info(prefix, ...args);
    case "warn":
      return console.warn(prefix, ...args);
    case "error":
      return console.error(prefix, ...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args)
};


