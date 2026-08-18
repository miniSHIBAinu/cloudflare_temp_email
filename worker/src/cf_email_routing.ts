import { Context } from "hono";

interface RuleResult {
    success: boolean;
    ruleId?: string;
    error?: string;
}

/**
 * Check if CF API credentials are configured for managing Email Routing rules.
 * Required env vars: CF_API_KEY, CF_API_EMAIL, CF_ZONE_ID, CF_WORKER_NAME
 */
export function isCfEmailRoutingConfigured(env: {
    CF_API_KEY?: string;
    CF_API_EMAIL?: string;
    CF_ZONE_ID?: string;
    CF_WORKER_NAME?: string;
}): boolean {
    return Boolean(env.CF_API_KEY && env.CF_API_EMAIL && env.CF_ZONE_ID && env.CF_WORKER_NAME);
}

function getCfApiHeaders(env: { CF_API_KEY: string; CF_API_EMAIL: string }): Record<string, string> {
    // Strip BOM if present (wrangler secret put via PowerShell pipe may prepend UTF-8 BOM)
    const apiKey = (env.CF_API_KEY || "").replace(/^\uFEFF/, "").trim();
    return {
        "X-Auth-Email": env.CF_API_EMAIL,
        "X-Auth-Key": apiKey,
        "Content-Type": "application/json",
    };
}

/**
 * Create a per-address literal Email Routing rule that routes incoming mail to our worker.
 * This is needed because CF's `*@...` literal matcher does NOT work as a wildcard,
 * and catch-all (`all`) matcher does NOT support `worker` action.
 *
 * Rule naming: `addr-{address_id}-{sanitized-address}` for easy lookup.
 */
export async function createRoutingRuleForAddress(
    c: Context<HonoCustomType>,
    address: string,
    addressId: number
): Promise<RuleResult> {
    if (!isCfEmailRoutingConfigured(c.env)) {
        return { success: false, error: "CF_EMAIL_ROUTING_NOT_CONFIGURED" };
    }
    // Rule name: sanitize address (replace @ and . with -)
    const sanitized = address.replace(/[^a-z0-9]/gi, "-");
    const ruleName = `addr-${addressId}-${sanitized}`.slice(0, 90);
    try {
        const resp = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/email/routing/rules`,
            {
                method: "POST",
                headers: getCfApiHeaders(c.env),
                body: JSON.stringify({
                    matchers: [{ type: "literal", field: "to", value: address }],
                    actions: [{ type: "worker", value: [c.env.CF_WORKER_NAME] }],
                    enabled: true,
                    name: ruleName,
                }),
            }
        );
        const data = (await resp.json()) as any;
        if (!data.success) {
            const errMsg = JSON.stringify(data.errors || data.messages || "unknown error");
            console.error(`[cf_email_routing] create rule failed for ${address}:`, errMsg);
            return { success: false, error: errMsg };
        }
        console.log(`[cf_email_routing] created rule ${data.result.id} for ${address}`);
        return { success: true, ruleId: data.result.id };
    } catch (e) {
        const errMsg = (e as Error).message;
        console.error(`[cf_email_routing] create rule exception for ${address}:`, errMsg);
        return { success: false, error: errMsg };
    }
}

/**
 * Delete the per-address Email Routing rule for the given address.
 * Looks up rule by matcher value (literal address) since names may differ.
 * Idempotent: returns success if no rule found.
 */
export async function deleteRoutingRuleForAddress(
    c: Context<HonoCustomType>,
    address: string
): Promise<RuleResult> {
    if (!isCfEmailRoutingConfigured(c.env)) {
        return { success: false, error: "CF_EMAIL_ROUTING_NOT_CONFIGURED" };
    }
    try {
        const ruleId = await findRuleIdByAddress(c, address);
        if (!ruleId) {
            console.log(`[cf_email_routing] no rule found for ${address}, skipping delete`);
            return { success: true };
        }
        const resp = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/email/routing/rules/${ruleId}`,
            {
                method: "DELETE",
                headers: getCfApiHeaders(c.env),
            }
        );
        const data = (await resp.json()) as any;
        if (!data.success) {
            const errMsg = JSON.stringify(data.errors || data.messages || "unknown error");
            console.error(`[cf_email_routing] delete rule failed for ${address}:`, errMsg);
            return { success: false, error: errMsg };
        }
        console.log(`[cf_email_routing] deleted rule ${ruleId} for ${address}`);
        return { success: true };
    } catch (e) {
        const errMsg = (e as Error).message;
        console.error(`[cf_email_routing] delete rule exception for ${address}:`, errMsg);
        return { success: false, error: errMsg };
    }
}

/**
 * List all Email Routing rules on the zone and find one whose literal matcher
 * matches the given address. Returns rule id or null.
 */
async function findRuleIdByAddress(
    c: Context<HonoCustomType>,
    address: string
): Promise<string | null> {
    try {
        const resp = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/email/routing/rules?per_page=100`,
            { headers: getCfApiHeaders(c.env) }
        );
        const data = (await resp.json()) as any;
        if (!data.success || !Array.isArray(data.result)) return null;
        const rule = data.result.find((r: any) =>
            Array.isArray(r.matchers) &&
            r.matchers.some((m: any) => m.type === "literal" && m.field === "to" && m.value === address)
        );
        return rule?.id || null;
    } catch (e) {
        console.error(`[cf_email_routing] list rules exception:`, e);
        return null;
    }
}
