// These thresholds are tuned against current real-log regression samples.
// Keep them centralized so follow-up pressure tests can adjust them in one place.
export const LOG_TIMELINE_LIMITS = {
  importMaxBytes: 50 * 1024 * 1024,
  importMaxLines: 300_000,
  highlightDecorationMaxCount: 1_500,
  scrollMarkerSampleMaxCount: 800
} as const
