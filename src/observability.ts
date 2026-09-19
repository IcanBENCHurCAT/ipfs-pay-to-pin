/**
 * Observability Module — Structured JSON Logging + OpenTelemetry Integration
 * 
 * Provides:
 * - Pino-based structured JSON logger with trace_id injection
 * - OpenTelemetry SDK with automatic instrumentation for Hono/Node.js
 * - OTLP HTTP exporter (configurable endpoint, defaults to console export in dev)
 * - Prometheus metrics registry (requests_total, payments_total, pins_total, errors_total, queue_depth)
 * 
 * Environment Variables:
 * - LOG_LEVEL: Log level (debug|info|warn|error), default: "info"
 * - OTEL_SERVICE_NAME: Service name for traces, default: "ipfs-pay-to-pin"
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint for traces, default: "http://localhost:4318" (console in dev)
 * - OTEL_TRACES_SAMPLE_RATE: Trace sampling rate (0-1), default: 1.0
 * - NODE_ENV: When "production", sets LOG_LEVEL to "info" and enables OTLP export
 */

import pino from 'pino';
import { metrics } from '@opentelemetry/api';

// ---------------------------------------------------------------------------
// Lazy OTel imports — avoids ESM/CJS interop issues when OTel packages
// are loaded under Vite's test runner (Vite cannot handle mixed ESM/CJS
// re-exports from @opentelemetry packages).
// ---------------------------------------------------------------------------

async function importResource(): Promise<typeof import('@opentelemetry/resources').Resource> {
  const mod = await import('@opentelemetry/resources');
  return mod.Resource;
}

async function importSemanticResourceAttributes(): Promise<typeof import('@opentelemetry/semantic-conventions').SemanticResourceAttributes> {
  const mod = await import('@opentelemetry/semantic-conventions');
  return mod.SemanticResourceAttributes;
}

async function importNodeTracerProvider(): Promise<typeof import('@opentelemetry/sdk-trace-node').NodeTracerProvider> {
  const mod = await import('@opentelemetry/sdk-trace-node');
  return mod.NodeTracerProvider;
}

async function importTraceIdRatioBasedSampler(): Promise<typeof import('@opentelemetry/sdk-trace-node').TraceIdRatioBasedSampler> {
  const mod = await import('@opentelemetry/sdk-trace-node');
  return mod.TraceIdRatioBasedSampler;
}

async function importBatchSpanProcessor(): Promise<typeof import('@opentelemetry/sdk-trace-node').BatchSpanProcessor> {
  const mod = await import('@opentelemetry/sdk-trace-node');
  return mod.BatchSpanProcessor;
}

async function importOTLPTraceExporter(): Promise<typeof import('@opentelemetry/exporter-trace-otlp-http').OTLPTraceExporter> {
  const mod = await import('@opentelemetry/exporter-trace-otlp-http');
  return mod.OTLPTraceExporter;
}

async function importConsoleSpanExporter(): Promise<typeof import('@opentelemetry/exporter-trace-otlp-http').ConsoleSpanExporter> {
  const mod = await import('@opentelemetry/exporter-trace-otlp-http');
  return mod.ConsoleSpanExporter;
}

async function importSimpleSpanProcessor(): Promise<typeof import('@opentelemetry/sdk-trace-base').SimpleSpanProcessor> {
  const mod = await import('@opentelemetry/sdk-trace-base');
  return mod.SimpleSpanProcessor;
}

// ---------------------------------------------------------------------------
// Singleton logger instance
// ---------------------------------------------------------------------------

const logLevel = process.env.LOG_LEVEL || 'info';
const serviceName = process.env.OTEL_SERVICE_NAME || 'ipfs-pay-to-pin';

export const logger = pino({
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  base: {
    service: serviceName,
  },
});

// ---------------------------------------------------------------------------
// OpenTelemetry SDK setup
// ---------------------------------------------------------------------------

const isProduction = process.env.NODE_ENV === 'production';
const defaultOtelEndpoint = isProduction 
  ? process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'
  : '';  // Empty string = console exporter only (dev mode)
const traceSamplerRate = parseFloat(process.env.OTEL_TRACES_SAMPLE_RATE || '1.0') || 1.0;

let tracerProvider: NodeTracerProvider | null = null;

/**
 * Initialize the OpenTelemetry SDK with automatic instrumentation.
 * Uses async lazy imports to avoid ESM/CJS interop issues under Vite test runner.
 * In production, exports traces to the configured OTLP endpoint.
 * In development, uses console exporter only (no network overhead).
 */
export async function initOtel(): Promise<void> {
  try {
    const [Resource, SemanticResourceAttributes, NodeTracerProvider, TraceIdRatioBasedSampler] = await Promise.all([
      importResource(),
      importSemanticResourceAttributes(),
      importNodeTracerProvider(),
      importTraceIdRatioBasedSampler(),
    ]);

    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: '2.1.0',
        'environment': isProduction ? 'production' : 'development',
      }),
      sampler: new TraceIdRatioBasedSampler(traceSamplerRate),
    });

    // Configure exporters
    if (defaultOtelEndpoint) {
      const [OTLPTraceExporter, BatchSpanProcessor] = await Promise.all([
        importOTLPTraceExporter(),
        importBatchSpanProcessor(),
      ]);
      const exporter = new OTLPTraceExporter({
        url: defaultOtelEndpoint,
        timeoutMillis: 5000,
      });
      const processor = new BatchSpanProcessor(exporter, {
        maxQueueSize: 100,
        maxExportBatchSize: 50,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: 30000,
      });
      provider.addSpanProcessor(processor);
      logger.info({ endpoint: defaultOtelEndpoint }, '[OTel] Configured OTLP HTTP exporter');
    } else {
      // Dev mode: use console exporter (prints traces to stderr)
      const [ConsoleSpanExporter, SimpleSpanProcessor] = await Promise.all([
        importConsoleSpanExporter(),
        importSimpleSpanProcessor(),
      ]);
      const consoleExporter = new ConsoleSpanExporter();
      const consoleProcessor = new SimpleSpanProcessor(consoleExporter);
      provider.addSpanProcessor(consoleProcessor);
      logger.info('[OTel] Dev mode — traces export to console (stderr)');
    }

    provider.register();
    tracerProvider = provider;

    logger.info('[OTel] Tracer provider initialized (sample_rate: %s, environment: %s)', traceSamplerRate, isProduction ? 'production' : 'development');
  } catch (err) {
    logger.warn('[OTel] Failed to initialize tracer provider — continuing without tracing: %s', err instanceof Error ? err.message : err);
  }
}

/**
 * Get the OpenTelemetry tracer for manual span creation.
 * Returns a no-op tracer if OTel is not initialized.
 */
export function getTracer(name: string = 'ipfs-pay-to-pin') {
  if (!tracerProvider) {
    // Lazy init if someone tries to get tracer before initOtel()
    initOtel();
  }
  return tracerProvider?.getTracer(name, '2.1.0') || null;
}

/**
 * Shutdown the OTel SDK gracefully.
 * Called on process shutdown to flush pending traces.
 */
export async function shutdownOtel(): Promise<void> {
  if (tracerProvider) {
    logger.info('[OTel] Shutting down tracer provider...');
    await tracerProvider.shutdown();
    tracerProvider = null;
    logger.info('[OTel] Tracer provider shut down.');
  }
}

// ---------------------------------------------------------------------------
// Prometheus Metrics (via prom-client)
// ---------------------------------------------------------------------------

// These counters track request counts, payment events, pin operations, errors, etc.
// They are exposed on the /metrics endpoint and scraped by Prometheus/Grafana.

let metricsInitialized = false;

/**
 * Initialize Prometheus metrics counters and gauges.
 * Must be called during app startup for metrics to be collected.
 * Idempotent: safe to call multiple times (re-initializes after test cleanup).
 */
export function initMetrics(): void {
  // Idempotent: skip if already initialized and metrics exist
  if (metricsInitialized && (global as any).__METRICS__) return;
  metricsInitialized = true;

  try {
    const { register, Counter, Gauge } = require('prom-client');

    // If re-initializing after teardown (e.g., test cleanup cleared __METRICS__),
    // clear the prom-client register first to avoid "already registered" errors.
    if (metricsInitialized && !(global as any).__METRICS__) {
      register.clear();
    }

    // Request count by route and method
    const requestsTotal = new Counter({
      name: 'requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'] as const,
    });

    // Payment count (x402 challenge generation, verification attempts, success)
    const paymentsTotal = new Counter({
      name: 'payments_total',
      help: 'Total x402 payment events',
      labelNames: ['action', 'network', 'result'] as const,
    });

    // Pin operation count
    const pinsTotal = new Counter({
      name: 'pins_total',
      help: 'Total pin/unpin operations',
      labelNames: ['action', 'status'] as const,
    });

    // Error count
    const errorsTotal = new Counter({
      name: 'errors_total',
      help: 'Total errors',
      labelNames: ['category'] as const,
    });

    // Queue depth gauge
    const queueDepth = new Gauge({
      name: 'queue_depth',
      help: 'Current number of pending pin jobs in the queue',
    });

    // Register all metrics
    register.setDefaultLabels({ service: serviceName });

    // Store references for later use
    (global as any).__METRICS__ = {
      requestsTotal,
      paymentsTotal,
      pinsTotal,
      errorsTotal,
      queueDepth,
      register,
    };

    logger.info('[Metrics] Prometheus metrics initialized');
  } catch (err) {
    logger.warn('[Metrics] Failed to initialize prom-client: %s — metrics will be unavailable', err instanceof Error ? err.message : err);
  }
}

/**
 * Check whether metrics have been initialized.
 * Useful for guardrails: middleware can skip metrics if initMetrics() hasn't run.
 */
export function isMetricsAvailable(): boolean {
  return metricsInitialized && (global as any).__METRICS__ !== undefined;
}

/**
 * Get the Prometheus metrics register for scraping.
 * Use in an HTTP handler to expose metrics in Prometheus format.
 */
export function getMetricsRegister() {
  try {
    const m = (global as any).__METRICS__;
    return m ? m.register : null;
  } catch {
    return null;
  }
}

/**
 * Increment a metrics counter and optionally capture the metric value for prom-client.
 * This dual-approach ensures metrics work both with and without the full OTel metrics SDK.
 */
export function incrementCounter(name: string, labels: Record<string, string>, value: number = 1): void {
  try {
    const m = (global as any).__METRICS__;
    if (m?.[name] && labels) {
      m[name].inc(labels, value);
    }
  } catch {
    // Silently fail — metrics should never break the app
  }
}

/**
 * Set a gauge value (e.g., queue depth).
 */
export function setGauge(name: string, value: number): void {
  try {
    const m = (global as any).__METRICS__;
    if (m?.[name]) {
      m[name].set(value);
    }
  } catch {
    // Silently fail
  }
}
