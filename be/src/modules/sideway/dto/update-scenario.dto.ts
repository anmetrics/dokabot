import { ScenarioStepDto } from './create-scenario.dto';

export class UpdateScenarioDto {
  name?: string;
  symbol?: string;
  qty?: number;
  steps?: ScenarioStepDto[];
  isLoop?: boolean;
}
