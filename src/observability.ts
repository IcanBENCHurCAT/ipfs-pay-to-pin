/**
 * Observability Module — Centralized logging, metrics, and tracing
 *
 * Provides:
 * - Pino logger for structured JSON logging
 * - Prometheus counters and gauges via prom-client
 * - Global registry for metrics collection
 *
 * Consumers:
 *   import { logger, incrementCounter, setGauge, getMetricsRegister } from './observability.js';
 */

import pino from 'pino';
import { Registry, Counter, Gauge } from 'prom-client';

// ─── Logger ───────────────────────────────────────────────────────────────────

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ─── Metrics Registry ─────────────────────────────────────────────────────────

const registry = new Registry();

export function getMetricsRegister(): Registry {
  return registry;
}

// ─── Counters ─────────────────────────────────────────────────────────────────

interface CounterMap {
  [name: string]: Counter<string>;
}

const counterMap: CounterMap = {};

/**
 * Increment a Prometheus counter with optional labels.
 * Creates the counter on first use if it does not exist.
 */
export function incrementCounter(
  name: string,
  labels?: Record<string, string>
): void {
  if (!counterMap[name]) {
    counterMap[name] = new Counter({
      name,
      help: `Auto-created counter: ${name}`,
    });
    registry.registerMetric(counterMap[name]);
  }

  const counter = registry.getSingleMetric(name) as Counter<string> | undefined;

  if (!counter) {
    counterMap[name] = new Counter({
      name,
      help: `Auto-created counter: ${name}`,
    });
    registry.registerMetric(counterMap[name]);
    (counterMap[name] as Counter<string>).inc(labels || {});
    return;
  }

  counter.inc(labels || {});
}

// ─── Gauges ───────────────────────────────────────────────────────────────────

interface GaugeMap {
  [name: string]: Gauge<string>;
}

const gaugeMap: GaugeMap = {};

/**
 * Set a Prometheus gauge value with optional labels.
 * Creates the gauge on first use if it does not exist.
 */
export function setGauge(
  name: string,
  value: number,
  labels?: Record<string, string>
): void {
  if (!gaugeMap[name]) {
    gaugeMap[name] = new Gauge({
      name,
      help: `Auto-created gauge: ${name}`,
    });
    registry.registerMetric(gaugeMap[name]);
  }

  const gauge = registry.getSingleMetric(name) as Gauge<string> | undefined;
  if (gauge) {
    gauge.set(labels || {}, value);
  }
}
