import type { RetreatRun, RetreatType } from '@/types';

const todayStr = () => new Date().toISOString().split('T')[0];

export function isRunBookable(run: RetreatRun): boolean {
  if (run.published === false) return false;
  return run.endDate >= todayStr();
}

export function publishedPrograms(
  programs: RetreatType[],
  runs: RetreatRun[],
): RetreatType[] {
  return programs.filter(p => {
    if (!p.published || !p.slug?.trim()) return false;
    return runs.some(r => r.retreatTypeId === p.id && isRunBookable(r));
  });
}

export function upcomingRunsForProgram(programId: string, runs: RetreatRun[]): RetreatRun[] {
  return runs
    .filter(r => r.retreatTypeId === programId && isRunBookable(r))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function fromPrice(run: RetreatRun): number | null {
  const prices = Object.values(run.accommodationPrices ?? {}).filter(p => p > 0);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export function programFromPrice(programId: string, runs: RetreatRun[]): number | null {
  const programRuns = upcomingRunsForProgram(programId, runs);
  const prices = programRuns
    .map(fromPrice)
    .filter((p): p is number => p !== null);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}
