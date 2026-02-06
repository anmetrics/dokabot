export class ScenarioStepDto {
  action: 'BUY' | 'SELL';
  price: number;
}

export class CreateScenarioDto {
  name: string;
  symbol: string;
  qty: number;
  steps: ScenarioStepDto[];
  isLoop: boolean;
}
