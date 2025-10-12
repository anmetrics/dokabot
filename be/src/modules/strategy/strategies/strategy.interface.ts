export interface IStrategy {
  startAll(): Promise<void>;
  stop(): void;
}
