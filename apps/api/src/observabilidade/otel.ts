import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

/**
 * Inicializa a instrumentacao OpenTelemetry. Deve ser chamada ANTES de importar
 * qualquer coisa que gere spans (por isso e carregada no topo do main.ts).
 */
export function iniciarObservabilidade(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    // Sem endpoint configurado: nao inicia exportadores para evitar ruido em dev.
    return;
  }

  const nomeServico = process.env.OTEL_SERVICE_NAME || 'arcco-api';

  sdk = new NodeSDK({
    resource: new Resource({ [ATTR_SERVICE_NAME]: nomeServico }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    sdk.start();
  } catch (erro) {
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar OpenTelemetry:', erro);
  }
}
