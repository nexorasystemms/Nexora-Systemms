import type { Ruleset } from "./ruleset.js";
import { defaultRuleset } from "./default-ruleset.js";

export function getCurrentRuleset(): Ruleset {
  return defaultRuleset;
}