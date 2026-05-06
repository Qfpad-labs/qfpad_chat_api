export const ACTION_TYPES = [
  "create_token",
  "create_presale",
  "lock_token",
  "airdrop_tokens",
  "contribute_qpad_sale",
  "claim_qpad",
  "open_route",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export interface ActionDraft {
  actionType: ActionType;
  targetRoute: string;
  requiredWallet: "qf" | "evm" | null;
  requiredChain: "qf" | "ethereum" | null;
  prefill: Record<string, string>;
  summary: string;
  warnings: string[];
  missingFields: string[];
  nextSteps: string[];
}
