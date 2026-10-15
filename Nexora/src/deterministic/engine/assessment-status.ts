import type { RuleResult } from "../schemas/rule-result.js";
import type { AffordabilityStatus } from "../schemas/affordability-result.js";

export function determineAssessmentStatus(
    results: RuleResult[]
): AffordabilityStatus {
    const hasHardBlocks = results.some(
        (result) =>
            result.status === "FAIL" && result.category === "REGULATORY"
    );

    if (hasHardBlocks) {
        return "FAIL";
    }
    const requiresReview = results.some(
        (result) =>
            result.status === "FAIL" || result.status === "FLAG"
    );
    if (requiresReview) {
        return "REVIEW";
    }
    return "PASS";
}