import type { ExtractionMethod, PriceCandidate } from '../contracts';

export interface PriceConsensus {
  price: PriceCandidate | null;
  hasConsensus: boolean;
  groups: PriceCandidate[][];
}

export interface AnchorCandidateSelection {
  candidate: PriceCandidate;
  relativeDifference: number;
  withinTolerance: boolean;
}

/** Preserve PriceGhost's strict "less than 5%" price matching rule. */
export function pricesMatch(price1: number, price2: number): boolean {
  if (price1 === price2) return true;
  const diff = Math.abs(price1 - price2);
  const avg = (price1 + price2) / 2;
  return (diff / avg) < 0.05;
}

export function findPriceConsensus(candidates: PriceCandidate[]): PriceConsensus {
  if (candidates.length === 0) {
    return { price: null, hasConsensus: false, groups: [] };
  }
  if (candidates.length === 1) {
    return { price: candidates[0], hasConsensus: true, groups: [[candidates[0]]] };
  }

  const groups: PriceCandidate[][] = [];
  for (const candidate of candidates) {
    let foundGroup = false;
    for (const group of groups) {
      if (pricesMatch(candidate.price, group[0].price)) {
        group.push(candidate);
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      groups.push([candidate]);
    }
  }

  groups.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const avgConfA = a.reduce((sum, candidate) => sum + candidate.confidence, 0) / a.length;
    const avgConfB = b.reduce((sum, candidate) => sum + candidate.confidence, 0) / b.length;
    return avgConfB - avgConfA;
  });

  const largestGroup = groups[0];
  const hasConsensus = largestGroup.length >= Math.ceil(candidates.length / 2) ||
    (groups.length > 1 && largestGroup.length > groups[1].length);

  const winner = largestGroup.sort((a, b) => b.confidence - a.confidence)[0];
  return { price: winner, hasConsensus, groups };
}

/** Preserve PriceGhost's nearest-anchor selection and strict 15% boundary. */
export function selectAnchorCandidate(
  candidates: PriceCandidate[],
  anchorPrice: number
): AnchorCandidateSelection | null {
  if (candidates.length === 0) return null;

  const candidate = candidates.reduce((closest, current) => {
    const closestDiff = Math.abs(closest.price - anchorPrice);
    const currentDiff = Math.abs(current.price - anchorPrice);
    return currentDiff < closestDiff ? current : closest;
  });
  const relativeDifference = Math.abs(candidate.price - anchorPrice) / anchorPrice;

  return {
    candidate,
    relativeDifference,
    withinTolerance: candidate.price === anchorPrice || relativeDifference < 0.15,
  };
}

export function selectPreferredCandidate(
  candidates: PriceCandidate[],
  preferredMethod: ExtractionMethod
): PriceCandidate | null {
  const preferredCandidates = candidates.filter(
    candidate => candidate.method === preferredMethod
  );
  if (preferredCandidates.length === 0) return null;

  return preferredCandidates.sort((a, b) => b.confidence - a.confidence)[0];
}
