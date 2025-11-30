// -----------------------------
// Regime HMM + Adaptive Risk Manager
// Lightweight univariate Gaussian HMM (Baum-Welch) implementation.
// This file keeps everything synchronous & simple for clarity.
// -----------------------------

type HMMParams = {
  nStates: number;
  pi: number[]; // initial state prob
  A: number[][]; // transition matrix
  mu: number[]; // gaussian mean per state
  sigma: number[]; // gaussian std per state
};

class RegimeHMM {
  params: HMMParams;

  constructor(nStates = 2) {
    this.params = {
      nStates,
      pi: Array(nStates).fill(1 / nStates),
      A: Array.from({ length: nStates }, () =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        Array(nStates).fill(1 / nStates),
      ),
      mu: Array(nStates).fill(0),
      sigma: Array(nStates).fill(1),
    };
  }

  // Gaussian pdf (protect against zero sigma)
  private gauss(x: number, mu: number, sigma: number) {
    const s = sigma <= 0 ? 1e-6 : sigma;
    const coef = 1 / Math.sqrt(2 * Math.PI * s * s);
    const exp = Math.exp((-0.5 * ((x - mu) * (x - mu))) / (s * s));
    return coef * exp;
  }

  // Forward algorithm (scaled)
  private forward(obs: number[], params = this.params) {
    const T = obs.length;
    const N = params.nStates;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const alpha: number[][] = Array.from({ length: T }, () => Array(N).fill(0));

    for (let i = 0; i < N; i++) {
      alpha[0][i] =
        params.pi[i] * this.gauss(obs[0], params.mu[i], params.sigma[i]);
    }

    const scales: number[] = [];
    let c0 = 0;
    for (let i = 0; i < N; i++) c0 += alpha[0][i];
    c0 = c0 || 1e-12;
    scales.push(c0);
    for (let i = 0; i < N; i++) alpha[0][i] /= c0;

    for (let t = 1; t < T; t++) {
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let i = 0; i < N; i++) sum += alpha[t - 1][i] * params.A[i][j];
        alpha[t][j] = sum * this.gauss(obs[t], params.mu[j], params.sigma[j]);
      }
      let ct = 0;
      for (let j = 0; j < N; j++) ct += alpha[t][j];
      ct = ct || 1e-12;
      scales.push(ct);
      for (let j = 0; j < N; j++) alpha[t][j] /= ct;
    }

    return { alpha, scales };
  }

  private backward(obs: number[], params = this.params, scales?: number[]) {
    const T = obs.length;
    const N = params.nStates;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const beta: number[][] = Array.from({ length: T }, () => Array(N).fill(0));
    for (let i = 0; i < N; i++)
      beta[T - 1][i] = 1 / (scales ? scales[T - 1] : 1);

    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let j = 0; j < N; j++)
          sum +=
            params.A[i][j] *
            this.gauss(obs[t + 1], params.mu[j], params.sigma[j]) *
            beta[t + 1][j];
        beta[t][i] = sum / (scales ? scales[t] : 1);
      }
    }
    return beta;
  }

  fit(obs: number[], maxIter = 20) {
    if (obs.length < 5) return;
    const N = this.params.nStates;
    const T = obs.length;

    for (let iter = 0; iter < maxIter; iter++) {
      const { alpha, scales } = this.forward(obs, this.params);
      const beta = this.backward(obs, this.params, scales);

      const gamma: number[][] = Array.from({ length: T }, () =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        Array(N).fill(0),
      );
      const xi: number[][][] = Array.from({ length: T - 1 }, () =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        Array.from({ length: N }, () => Array(N).fill(0)),
      );

      for (let t = 0; t < T; t++) {
        let denom = 0;
        for (let i = 0; i < N; i++) {
          gamma[t][i] = alpha[t][i] * beta[t][i];
          denom += gamma[t][i];
        }
        denom = denom || 1e-12;
        for (let i = 0; i < N; i++) gamma[t][i] /= denom;
      }

      for (let t = 0; t < T - 1; t++) {
        let denom = 0;
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            xi[t][i][j] =
              alpha[t][i] *
              this.params.A[i][j] *
              this.gauss(obs[t + 1], this.params.mu[j], this.params.sigma[j]) *
              beta[t + 1][j];
            denom += xi[t][i][j];
          }
        }
        denom = denom || 1e-12;
        for (let i = 0; i < N; i++)
          for (let j = 0; j < N; j++) xi[t][i][j] /= denom;
      }

      // pi
      for (let i = 0; i < N; i++) this.params.pi[i] = gamma[0][i];

      // A
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          let numer = 0;
          let denom = 0;
          for (let t = 0; t < T - 1; t++) {
            numer += xi[t][i][j];
            denom += gamma[t][i];
          }
          this.params.A[i][j] = numer / (denom || 1e-12);
        }
      }

      // mu & sigma
      for (let j = 0; j < N; j++) {
        let numer = 0;
        let denom = 0;
        for (let t = 0; t < T; t++) {
          numer += gamma[t][j] * obs[t];
          denom += gamma[t][j];
        }
        const mu = numer / (denom || 1e-12);
        this.params.mu[j] = mu;

        let varsum = 0;
        for (let t = 0; t < T; t++) {
          varsum += gamma[t][j] * (obs[t] - mu) * (obs[t] - mu);
        }
        const sigma = Math.sqrt(varsum / (denom || 1e-12));
        this.params.sigma[j] = Math.max(sigma, 1e-6);
      }
    }
  }

  predictProbs(obs: number[]) {
    const { alpha } = this.forward(obs, this.params);
    const T = obs.length;
    const last = alpha[T - 1];
    const sum = last.reduce((s, v) => s + v, 0) || 1e-12;
    return last.map((v) => v / sum);
  }

  mostLikelyState(obs: number[]) {
    const probs = this.predictProbs(obs);
    let maxIdx = 0;
    for (let i = 1; i < probs.length; i++)
      if (probs[i] > probs[maxIdx]) maxIdx = i;
    return maxIdx;
  }
}

// Adaptive Risk Manager that updates parameters based on volatility/regime
export class RegimeRiskManager {
  private hmm: RegimeHMM;
  private policyBase: {
    sizeMultiplier: number;
    allowBuy: boolean;
    allowSell: boolean;
    maxDcaTimes: number;
    minProfitMultiplier: number;
  }[]; // base template (not static mapping)

  private obsWindow: number[] = []; // raw observations (ret * atr)
  private rollingWindow = 200;

  // normalization params used for last fit
  private lastMean = 0;
  private lastStd = 1;

  // thresholds (tunable)
  private volatilityBuckets = [0.5, 1, 2];

  constructor(states = 2) {
    this.hmm = new RegimeHMM(states);
    // base templates (calm -> more aggressive; volatile -> conservative)
    // We'll map these dynamically based on measured volatility/regime
    this.policyBase = [
      {
        sizeMultiplier: 1.0,
        allowBuy: true,
        allowSell: true,
        maxDcaTimes: 20,
        minProfitMultiplier: 1.0,
      }, // calm template
      {
        sizeMultiplier: 0.5,
        allowBuy: true,
        allowSell: true,
        maxDcaTimes: 4,
        minProfitMultiplier: 1.5,
      }, // default volatile template
    ];
  }

  // append raw observation and retrain HMM periodically
  pushObservation(x: number) {
    this.obsWindow.push(x);
    if (this.obsWindow.length > this.rollingWindow) this.obsWindow.shift();

    if (this.obsWindow.length >= 20) {
      // compute normalization parameters from obsWindow and save them
      const mean =
        this.obsWindow.reduce((s, v) => s + v, 0) / this.obsWindow.length;
      const variance =
        this.obsWindow.reduce((s, v) => s + (v - mean) * (v - mean), 0) /
        this.obsWindow.length;
      const std = Math.sqrt(variance) || 1e-6;

      this.lastMean = mean;
      this.lastStd = std;

      // normalize and fit
      const normalized = this.obsWindow.map((v) => (v - mean) / std);
      this.hmm.fit(normalized, 10);
    }
  }

  // safe getter
  getObsWindowTail(n: number) {
    if (n <= 0) return [];
    return this.obsWindow.slice(Math.max(0, this.obsWindow.length - n));
  }

  // compute volatility metric from recent raw obs (returns positive number)
  private computeVolatilityMetric(recent: number[]) {
    if (!recent || recent.length === 0) return 0;
    const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
    const variance =
      recent.reduce((s, v) => s + (v - mean) * (v - mean), 0) / recent.length;
    const std = Math.sqrt(variance) || 0;
    // scale by lastStd if available to make metric more stable across symbols
    const scaled = std / (this.lastStd || 1);
    return scaled;
  }

  // map volatility to a bucket index {0:low,1:med,2:high,3:extreme}
  private volatilityBucket(volMetric: number) {
    const b = this.volatilityBuckets;
    if (volMetric < b[0]) return 0;
    if (volMetric < b[1]) return 1;
    if (volMetric < b[2]) return 2;
    return 3;
  }

  // build/adapt policy based on volatility bucket and HMM state
  private buildPolicyForState(stateIdx: number, volMetric: number) {
    // basic idea:
    // - low vol: larger size, more DCA, lower minProfit multiplier
    // - medium: moderate
    // - high: small size, limit DCA, raise TP
    // - extreme: optionally disable buys
    const bucket = this.volatilityBucket(volMetric);
    // Determine whether this state is "volatile" by comparing state's sigma to others
    const sigmas = this.hmm.params.sigma;
    let volatileState = 0;
    for (let i = 1; i < sigmas.length; i++)
      if (sigmas[i] > sigmas[volatileState]) volatileState = i;
    const isStateVolatile = stateIdx === volatileState;

    // base scaling factors (can fine-tune)
    const bucketConfigs = [
      {
        sizeMul: 1.4,
        maxDca: 25,
        minProfitMul: 0.9,
        allowBuy: true,
        allowSell: true,
      },
      {
        sizeMul: 1.0,
        maxDca: 15,
        minProfitMul: 1.1,
        allowBuy: true,
        allowSell: true,
      },
      {
        sizeMul: 0.65,
        maxDca: 8,
        minProfitMul: 1.35,
        allowBuy: true,
        allowSell: true,
      },
      {
        sizeMul: 0.35,
        maxDca: 4,
        minProfitMul: 1.7,
        allowBuy: true,
        allowSell: true,
      },
    ];

    let cfg = bucketConfigs[bucket] || bucketConfigs[1];

    // if the HMM state is the "volatile" state, be more conservative
    if (isStateVolatile) {
      cfg = {
        sizeMul: Math.max(0.15, cfg.sizeMul * 0.8),
        maxDca: Math.max(1, Math.floor(cfg.maxDca * 0.5)),
        minProfitMul: cfg.minProfitMul * 1.2,
        allowBuy: cfg.allowBuy && bucket < 3,
        allowSell: cfg.allowSell,
      };
    } else {
      // calm state — may boost a bit
      cfg = {
        sizeMul: Math.min(2.0, cfg.sizeMul * 1.15),
        maxDca: Math.max(1, Math.floor(cfg.maxDca * 1.1)),
        minProfitMul: Math.max(0.8, cfg.minProfitMul * 0.95),
        allowBuy: cfg.allowBuy,
        allowSell: cfg.allowSell,
      };
    }
    // --- SELL logic: allow sell ONLY on early reversal ---

    let enableSell = false;

    const recent = this.getObsWindowTail(30);

    if (recent.length > 5) {
      const momentum = recent[recent.length - 1] - recent[0];

      const roc = momentum / Math.abs(recent[0] || 1) || 0;

      // detect early reversal:
      const last = recent[recent.length - 1];
      const prev = recent[recent.length - 2];

      const decreasingNow = last < prev;
      const wasStrongUp = roc > 0.015;

      if (wasStrongUp && decreasingNow) {
        enableSell = true;
      }

      if (roc < -0.02) {
        enableSell = true;
      }
    }

    // override final sell permission
    cfg.allowSell = cfg.allowSell && enableSell;

    return {
      sizeMultiplier: cfg.sizeMul,
      allowBuy: cfg.allowBuy,
      allowSell: cfg.allowSell,
      maxDcaTimes: cfg.maxDca,
      minProfitMultiplier: cfg.minProfitMul,
    };
  }

  // get regime info (state + probs) using the same normalization used for training
  getRegimeInfo(recentObs: number[]) {
    if (!recentObs.length) return { state: 0, probs: [1] };
    const normalized = recentObs.map(
      (v) => (v - this.lastMean) / (this.lastStd || 1e-6),
    );
    const probs = this.hmm.predictProbs(normalized);
    const state = probs.indexOf(Math.max(...probs));
    return { state, probs };
  }

  // public: obtain adaptive policy given recent observations
  getPolicy(recentObs: number[]) {
    const tail =
      recentObs && recentObs.length ? recentObs : this.getObsWindowTail(50);
    if (!tail.length) {
      // fallback conservative default
      return {
        sizeMultiplier: 0.5,
        allowBuy: true,
        allowSell: true,
        maxDcaTimes: 4,
        minProfitMultiplier: 1.5,
      };
    }

    // compute vol metric on raw obs
    const volMetric = this.computeVolatilityMetric(tail);
    const { state } = this.getRegimeInfo(tail);
    const adaptivePolicy = this.buildPolicyForState(state, volMetric);

    // attach meta for debugging
    // (consumer can inspect this.hmm.params or add Logger to print)
    return adaptivePolicy;
  }

  // for debugging: expose HMM params
  getHMMParams() {
    return this.hmm.params;
  }
}
