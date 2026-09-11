/** Frontend-only command contracts. No command text is part of a model request. */
export interface CommandOption {
  id: string;
  label: string;
  detail: string;
  argument: string;
  selected?: boolean;
  choose(): CommandResult | Promise<CommandResult>;
}
export type CommandResult =
  | { status: 'success'; message: string }
  | { status: 'select'; title: string; options: CommandOption[]; message?: string }
  | { status: 'help'; lines: string[] }
  | { status: 'unavailable' | 'error'; message: string };
export interface CommandModel {
  providerId: string; providerName: string; model: string; selected: boolean;
}
export interface CommandContext {
  conversationId: string;
  models: CommandModel[];
  effort: string;
  followsConfig: boolean;
  busy: boolean;
  compactUnavailable: string | null;
  selectModel(providerId: string, model: string): CommandResult;
  selectEffort(effort: string | null): CommandResult;
  compact(): Promise<CommandResult>;
}
export interface CommandContribution {
  id: string;
  name: string;
  description: string;
  parameters: string;
  summary?(context: CommandContext): string;
  available(context: CommandContext): string | null;
  options?(context: CommandContext, argument: string): CommandOption[];
  execute(context: CommandContext, argument: string): CommandResult | Promise<CommandResult>;
}
