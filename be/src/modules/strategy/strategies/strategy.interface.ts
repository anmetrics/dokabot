export interface IStrategy {
  start(): Promise<void>;
  stop(): void;
}
