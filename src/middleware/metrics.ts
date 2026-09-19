/**
 * Metrics Endpoint — Prometheus-style HTTP handler
 * 
 * Exposes metrics in Prometheus text format at GET /metrics.
 * This is scraped by Prometheus/Grafana for dashboarding and alerting.
 * 
 * Endpoints exposed:
 * - GET /metrics — Prometheus text format (default)
 * - GET /metrics?format=json — JSON format (for non-Prometheus consumers)
 */

import type { Context } from 'hono';
import { getMetricsRegister } from '../observability.js';

export async function metricsHandler(c: Context): Promise<Response> {
  const format = c.req.query('format') || 'text';
  const register = getMetricsRegister();
  
  if (!register) {
    return c.json({
      error: 'Metrics not initialized',
      message: 'Metrics collection has not been initialized. Check server logs.',
    }, 503);
  }
  
  try {
    if (format === 'json') {
      // JSON format for easier consumption by non-Prometheus tools
      const metrics = await register.metrics();
      const metricsObj: Record<string, any> = {};
      
      // Parse the Prometheus text format into JSON
      const lines = metrics.split('\n');
      let currentMetric: string | null = null;
      
      for (const line of lines) {
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.match(/^([a-zA-Z_:][\w:]*){(.+?)}?\s+(.+)$/);
        if (parts) {
          const [, name, labelsStr, value] = parts;
          const labels = labelsStr ? parseLabels(labelsStr) : {};
          
          if (!metricsObj[name]) {
            metricsObj[name] = [];
          }
          
          metricsObj[name].push({
            labels,
            value: parseFloat(value),
          });
        }
      }
      
      return c.json({
        service: 'ipfs-pay-to-pin',
        timestamp: new Date().toISOString(),
        metrics: metricsObj,
      });
    } else {
      // Prometheus text format (default)
      const metrics = await register.metrics();
      c.header('Content-Type', 'application/openmetrics-text; version=1.0.0');
      return c.text(metrics);
    }
  } catch (err) {
    return c.json({
      error: 'Failed to generate metrics',
      message: err instanceof Error ? err.message : String(err),
    }, 500);
  }
}

/**
 * Parse Prometheus label string into an object.
 * Example: `{method="GET",status="200"}` → `{method: "GET", status: "200"}`
 */
function parseLabels(labelsStr: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  
  while ((match = regex.exec(labelsStr)) !== null) {
    labels[match[1]] = match[2];
  }
  
  return labels;
}
