/**
 * Observability - structured JSON logging and in-memory metrics.
 *
 * Dependency-free on purpose: the gateway image stays lean (no pino/prom-client).
 * - logger: JSON log lines on stdout with child() binding support.
 * - incrementCounter / setGauge: process-local counters and gauges.
 * - getMetricsRegister: exposes them in Prometheus text format for /metrics.
 * - initOtel / shutdownOtel: no-ops until the feat-otel-tracing branch lands.
 */

export type LogBindings = Record<string, unknown>;

export interface Logger {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  child(bindings: LogBindings): Logger;
}

function writeLog(level: string, bindings: LogBindings, obj: unknown, msg?: string): void {
  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    service: "ipfs-pay-to-pin",
    ...bindings,
  };
  if (typeof obj === "object" && obj !== null) {
    Object.assign(entry, obj);
  } else if (obj !== undefined) {
    entry.data = obj;
  }
  if (msg !== undefined) entry.msg = msg;
  console.log(JSON.stringify(entry));
}

function makeLogger(bindings: LogBindings = {}): Logger {
  const debugEnabled = (): boolean => (process.env.LOG_LEVEL || "info").toLowerCase() === "debug";
  return {
    debug: (obj, msg) => { if (debugEnabled()) writeLog("debug", bindings, obj, msg); },
    info: (obj, msg) => writeLog("info", bindings, obj, msg),
    warn: (obj, msg) => writeLog("warn", bindings, obj, msg),
    error: (obj, msg) => writeLog("error", bindings, obj, msg),
    child: (b) => makeLogger({ ...bindings, ...b }),
  };
}

export const logger: Logger = makeLogger();

export type MetricLabels = Record<string, string>;

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

function metricKey(name: string, labels: MetricLabels): string {
  const parts = Object.keys(labels).sort().map((k) => `${k}="${labels[k]}"`);
  return parts.length > 0 ? `${name}{${parts.join(",")}}` : name;
}

export function incrementCounter(name: string, labels: MetricLabels = {}, by = 1): void {
  const k = metricKey(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + by);
}

export function setGauge(name: string, value: number, labels: MetricLabels = {}): void {
  gauges.set(metricKey(name, labels), value);
}

export interface MetricsRegister {
  metrics(): Promise<string>;
}

export function getMetricsRegister(): MetricsRegister {
  return {
    async metrics(): Promise<string> {
      const lines: string[] = [];
      for (const [k, v] of counters) lines.push(`${k} ${v}`);
      for (const [k, v] of gauges) lines.push(`${k} ${v}`);
      return lines.join("\n") + "\n";
    },
  };
}

export function initMetrics(): void {
  // In-memory store is ready on import; hook for future backends.
}

export function isMetricsAvailable(): boolean {
  return true;
}

export function initOtel(): void {
  // OpenTelemetry wiring is in progress on the feat-otel-tracing branch; no-op on main.
}

export async function shutdownOtel(): Promise<void> {
  // No-op until OTel is wired up.
}
