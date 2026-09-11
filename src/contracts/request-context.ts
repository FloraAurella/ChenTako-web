/** Synchronous capture runs once before preflight; contributions must not perform I/O. */
export interface RequestContextContribution {
  id: string;
  capture(input: { state: any; conversation: any }): { text: string; error?: string };
}
