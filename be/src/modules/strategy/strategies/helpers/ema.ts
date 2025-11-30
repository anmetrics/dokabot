interface Ema3Momentum {
  signal:
    | 'strong_bull'
    | 'bull'
    | 'weak_bull'
    | 'neutral'
    | 'weak_bear'
    | 'bear'
    | 'strong_bear'
    | 'fake_pump'
    | 'fake_dump';
  strength: number;
  acceleration: number;
  consistency: number;
  isConfirmed: boolean;
}

export function getEma3Momentum(ema: number[]): Ema3Momentum {
  const len = ema.length;
  if (len < 4) {
    return {
      signal: 'neutral',
      strength: 0,
      acceleration: 0,
      consistency: 0,
      isConfirmed: false,
    };
  }

  const e0 = ema[len - 1];
  const e1 = ema[len - 2];
  const e2 = ema[len - 3];
  const e3 = ema[len - 4];

  const slope2 = (e0 - e1) / e1;
  const slope1 = (e1 - e2) / e2;
  const slope0 = (e2 - e3) / e3;

  const acceleration = slope2 - slope1;
  const avgSlope = (slope0 + slope1 + slope2) / 3;

  const signs = [Math.sign(slope0), Math.sign(slope1), Math.sign(slope2)];
  const allPositive = signs.every((s) => s > 0);
  const allNegative = signs.every((s) => s < 0);
  const increasingBull = allPositive && slope0 < slope1 && slope1 < slope2;
  const increasingBear = allNegative && slope0 > slope1 && slope1 > slope2;

  const consistency =
    (allPositive || allNegative ? 0.5 : 0) +
    (increasingBull || increasingBear ? 0.5 : 0);

  const strength = Math.tanh(avgSlope * 4000) * 100;

  if (increasingBull && slope2 > 0.0018 && avgSlope > 0.0015) {
    return {
      signal: 'strong_bull',
      strength: Math.min(100, 90 + consistency * 20),
      acceleration,
      consistency,
      isConfirmed: true,
    };
  }

  if (allPositive && slope2 > 0.001 && avgSlope > 0.0008) {
    return {
      signal: 'bull',
      strength: 65 + consistency * 25,
      acceleration,
      consistency,
      isConfirmed: true,
    };
  }

  if (slope1 > 0.002 && slope2 < slope1 * 0.6 && slope2 < 0.0005) {
    return {
      signal: 'fake_pump',
      strength: -30,
      acceleration: acceleration,
      consistency,
      isConfirmed: false,
    };
  }

  if (increasingBear && slope2 < -0.002 && avgSlope < -0.0016) {
    return {
      signal: 'strong_bear',
      strength: Math.max(-100, -90 - consistency * 20),
      acceleration,
      consistency,
      isConfirmed: true,
    };
  }

  if (allNegative && slope2 < -0.0012 && avgSlope < -0.001) {
    return {
      signal: 'bear',
      strength: -65 - consistency * 25,
      acceleration,
      consistency,
      isConfirmed: true,
    };
  }

  if (slope1 < -0.002 && slope2 > slope1 * 1.4) {
    return {
      signal: 'fake_dump',
      strength: 30,
      acceleration,
      consistency,
      isConfirmed: false,
    };
  }

  const weakSignal =
    slope2 > 0.0005 ? 'weak_bull' : slope2 < -0.0005 ? 'weak_bear' : 'neutral';
  return {
    signal: weakSignal,
    strength: strength * 0.7,
    acceleration,
    consistency,
    isConfirmed: false,
  };
}
