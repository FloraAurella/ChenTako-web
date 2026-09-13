/** Synchronous capture runs once before preflight; contributions must not perform I/O. */
export interface RequestContextContribution {
  id: string;
  capture(input: { state: any; conversation: any }): { text: string; error?: string; groups?: { id: string; label: string; text: string }[] };
  createOperation?(input: { store: any; conversation: any }): RequestOperation | null;
}
/** Runtime callbacks stay outside the serializable provider/configuration snapshot. */
export interface RequestOperation {
  historyText?: string;
  outputSurface?: 'workspace';
  prepare(input: { request: any; message: any; signal: AbortSignal; complete(suffix: string): Promise<string> }): Promise<void>;
  validate(): void;
  start(): void;
  update(text: string): void;
  finish(result: { text: string; complete: boolean }): void;
  dispose(): void;
}
