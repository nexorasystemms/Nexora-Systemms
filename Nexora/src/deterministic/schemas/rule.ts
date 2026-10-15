import type { RuleResult } from "./rule-result.js";

export type RuleFunction <TInput> = (input: TInput) => RuleResult;

