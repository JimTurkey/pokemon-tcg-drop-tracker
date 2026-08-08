import { TRACKER_POLICY_V1 } from './tracker-policy.v1';
import { isRetailerId, ReadinessBand } from './tracker-types';

export type StockEvidenceLevel = 'confirmed' | 'likely' | 'none';

export interface ReadinessInput {
  confidenceScore: number;
  independentSourceCount: number;
  daysToNextRelease: number | null;
  stockEvidence: StockEvidenceLevel;
  retailer: string;
}

export interface ReadinessBreakdown {
  confidence: number;
  independentSources: number;
  releaseProximity: number;
  stockEvidence: number;
  approvedRetailer: number;
}

export interface ReadinessResult {
  score: number;
  band: ReadinessBand;
  breakdown: ReadinessBreakdown;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function releaseProximityPoints(days: number | null): number {
  if (days === null || !Number.isFinite(days) || days < 0) return 0;

  const points = TRACKER_POLICY_V1.readiness.releaseProximityPoints;
  if (days <= 2) return points.within2Days;
  if (days <= 7) return points.within7Days;
  if (days <= 14) return points.within14Days;
  if (days <= 30) return points.within30Days;
  return 0;
}

function stockEvidencePoints(level: StockEvidenceLevel): number {
  if (level === 'confirmed') {
    return TRACKER_POLICY_V1.readiness.confirmedStockEvidencePoints;
  }
  if (level === 'likely') {
    return TRACKER_POLICY_V1.readiness.likelyStockEvidencePoints;
  }
  return 0;
}

export function getReadinessBand(score: number): ReadinessBand {
  const normalizedScore = clamp(Math.round(Number.isFinite(score) ? score : 0), 0, 100);
  const rule = TRACKER_POLICY_V1.readinessBands.find(
    (band) => normalizedScore >= band.min && normalizedScore <= band.max
  );

  return rule?.band ?? 'normal';
}

export function calculateReadiness(input: ReadinessInput): ReadinessResult {
  const policy = TRACKER_POLICY_V1.readiness;
  const confidenceScore = clamp(
    Number.isFinite(input.confidenceScore) ? input.confidenceScore : 0,
    0,
    100
  );
  const independentSourceCount = Math.max(
    0,
    Math.floor(Number.isFinite(input.independentSourceCount) ? input.independentSourceCount : 0)
  );

  const breakdown: ReadinessBreakdown = {
    confidence: Math.round(confidenceScore * policy.confidenceWeight),
    independentSources:
      Math.min(independentSourceCount, policy.independentSourceCap) *
      policy.independentSourcePoints,
    releaseProximity: releaseProximityPoints(input.daysToNextRelease),
    stockEvidence: stockEvidencePoints(input.stockEvidence),
    approvedRetailer: isRetailerId(input.retailer)
      ? policy.approvedRetailerPoints
      : 0,
  };

  const score = clamp(
    Object.values(breakdown).reduce((total, value) => total + value, 0),
    0,
    100
  );

  return {
    score,
    band: getReadinessBand(score),
    breakdown,
  };
}
