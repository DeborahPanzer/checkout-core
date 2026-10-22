export class AnomalyDetector {
  public static isAmountAnomalous(amountMinor: number, historicalAmountsMinor: number[], thresholdZScore = 3.0): boolean {
    if (historicalAmountsMinor.length < 5) {
      return false; // Not enough data points to establish a statistical baseline
    }

    const mean = historicalAmountsMinor.reduce((sum, val) => sum + val, 0) / historicalAmountsMinor.length;

    const variance =
      historicalAmountsMinor.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      historicalAmountsMinor.length;

    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return amountMinor !== mean;
    }

    const zScore = Math.abs((amountMinor - mean) / stdDev);
    return zScore >= thresholdZScore;
  }
}
