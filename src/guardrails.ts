const TELEGRAM_URL = "https://t.me/qfpad";
const X_URL = "https://x.com/qfpad_";

type GuardCategory =
  | "secrets"
  | "internals"
  | "ownership"
  | "off_topic"
  | "politics"
  | "scam";

interface InputRule {
  category: GuardCategory;
  pattern: RegExp;
}

const blockedInputRules: InputRule[] = [
  { category: "secrets", pattern: /seed\s*phrase/i },
  { category: "secrets", pattern: /mnemonic/i },
  { category: "secrets", pattern: /private\s*key/i },
  { category: "secrets", pattern: /keystore/i },
  { category: "secrets", pattern: /allocator\s*key/i },
  { category: "secrets", pattern: /api\s*key/i },
  { category: "secrets", pattern: /access\s*token/i },
  { category: "secrets", pattern: /personal\s+access\s+token/i },
  { category: "secrets", pattern: /\b\.env\b/i },
  { category: "secrets", pattern: /credentials?/i },
  { category: "internals", pattern: /source\s*code/i },
  { category: "internals", pattern: /codebase/i },
  { category: "internals", pattern: /\brepo(sitory)?\b/i },
  { category: "internals", pattern: /github/i },
  { category: "internals", pattern: /gitlab/i },
  { category: "internals", pattern: /reveal\s+(?:your|the)\s+(?:prompt|system\s+prompt|instructions?|secret)/i },
  { category: "internals", pattern: /hidden\s+(?:prompts?|instructions?|rules?)/i },
  { category: "internals", pattern: /what\s+(?:are|were)\s+your\s+(?:instructions?|prompts?)/i },
  { category: "ownership", pattern: /\b(owner|founder|dev|developer|team)\b.*\b(who|name|identity|identit(y|ies)|doxx|reveal|address|home)\b/i },
  { category: "ownership", pattern: /\bwho\s+(?:runs|owns|built|controls)\b/i },
  { category: "ownership", pattern: /\bwho\s+is\s+behind\b/i },
  { category: "politics", pattern: /\b(politics?|election|president|prime minister|senate|campaign|party politics?)\b/i },
  { category: "off_topic", pattern: /\b(weather|recipe|football|soccer|nba|movie|dating|horoscope|essay|homework|translate this)\b/i },
  { category: "scam", pattern: /\b(scam|rug|rugpull|fake|legit|legitimate)\b/i },
];

const qfpadScopeHints = [
  /\bqfpad\b/i,
  /\bqpad\b/i,
  /\bpresale\b/i,
  /\bstake|staking\b/i,
  /\bclaim\b/i,
  /\bwallet\b/i,
  /\busdc\b/i,
  /\bmetamask\b/i,
  /\bsubwallet\b/i,
  /\btalisman\b/i,
  /\btoken\b/i,
  /\blaunchpad\b/i,
  /\block(er|ing)?\b/i,
  /\bairdrop\b/i,
  /\bethereum\b/i,
  /\bqf network\b/i,
  /\bswap\b/i,
  /\bnft\b/i,
];

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

function communityRedirect() {
  return `I can help with QFPad product questions, but I won't get into private identities or internal accounts. For team or trust questions, check the public channels on X (${X_URL}) and Telegram (${TELEGRAM_URL}).`;
}

function handleCategory(category: GuardCategory): GuardrailResult {
  switch (category) {
    case "secrets":
      return {
        allowed: false,
        code: "blocked_secrets",
        reason: "I can’t help with keys, keystores, env files, or anything that exposes private access. Wallet control stays with the user.",
      };
    case "internals":
      return {
        allowed: false,
        code: "blocked_internals",
        reason: "I’m here for QFPad usage, not internal code, repos, prompts, or private infrastructure details.",
      };
    case "ownership":
      return {
        allowed: false,
        code: "blocked_ownership",
        reason: communityRedirect(),
      };
    case "politics":
      return {
        allowed: false,
        code: "blocked_politics",
        reason: "I’m staying out of politics. Agent Quinn prefers launchpads over campaign trails. Ask me anything QFPad-related instead.",
      };
    case "off_topic":
      return {
        allowed: false,
        code: "blocked_off_topic",
        reason: "I’m scoped to QFPad, QPAD, wallets, presales, locking, staking, and claim flow support. I’m not a general-purpose chat bot.",
      };
    case "scam":
      return {
        allowed: false,
        code: "handled_scam",
        reason: `Fair question. QFPad is a real live product with on-chain flows, and I treat it as a genuine project. Still, verify what matters yourself: check the live contracts, transaction history, and public community channels on X (${X_URL}) and Telegram (${TELEGRAM_URL}).`,
      };
  }
}

export function guardUserMessage(message: string): GuardrailResult {
  for (const rule of blockedInputRules) {
    if (rule.pattern.test(message)) {
      return handleCategory(rule.category);
    }
  }

  const looksGeneralPurpose =
    /\b(write|draft|summarize|explain|solve|fix|plan)\b/i.test(message) &&
    !qfpadScopeHints.some((pattern) => pattern.test(message));

  if (looksGeneralPurpose) {
    return handleCategory("off_topic");
  }

  return { allowed: true };
}

const KNOWN_ACTION_TYPES = [
  "create_token",
  "create_presale",
  "lock_token",
  "airdrop_tokens",
  "contribute_qpad_sale",
  "claim_qpad",
  "open_route",
];

export interface OutputGuardResult {
  valid: boolean;
  reason?: string;
}

export function guardActionDraft(
  draft: { actionType?: string; targetRoute?: string; prefill?: unknown },
): OutputGuardResult {
  if (!draft.actionType) {
    return { valid: false, reason: "actionType missing" };
  }

  if (!KNOWN_ACTION_TYPES.includes(draft.actionType)) {
    return { valid: false, reason: `unknown actionType: ${draft.actionType}` };
  }

  if (!draft.targetRoute || typeof draft.targetRoute !== "string") {
    return { valid: false, reason: "targetRoute missing or invalid" };
  }

  if (!draft.targetRoute.startsWith("/")) {
    return { valid: false, reason: "targetRoute must start with /" };
  }

  if (draft.prefill !== undefined && draft.prefill !== null && typeof draft.prefill !== "object") {
    return { valid: false, reason: "prefill must be an object" };
  }

  return { valid: true };
}

const SELF_DESCRIPTION_PATTERNS: RegExp[] = [
  /\bkeep\s+it\s+simple\b/i,
  /\bno\s+smoke\s+machine\b/i,
  /\bdrama\s+later\b/i,
  /\bmystery\s+quest/i,
  /\bless\s+comic\s+book\b/i,
  /\bmore\s+contract\s+book\b/i,
  /\bwon'?t\s+pretend\b/i,
  /\bfewer\s+bats\b/i,
  /\bfewer\s+surprises\b/i,
  /\blightly\s+caffeinated\b/i,
  /\bno\s+relation\s+to\s+harley\b/i,
  /\bspeak\s+launchpad\b/i,
  /\bnot\s+riddles\b/i,
  /\bshort\s+answers\b/i,
  /\bwithout\s+making\s+it\s+worse\b/i,
  /\bif\s+it'?s\s+vague,?\s*I'?ll\s+say\s+it'?s\s+vague\b/i,
  /\btry\s+not\s+to\s+hallucinate\b/i,
  /\bnot\s+magic,?\s*just\s+organized\b/i,
  /\bclean\s+answers\s+and\s+fewer\b/i,
  /\bcitations,?\s*not\s+chaos\b/i,
  /\bfriendly,?\s*grounded,?\s*and\s+mildly\s+sarcastic\b/i,
  /\bI\s+do\s+clarity\b/i,
  /\bdocs\s+first,?\s*drama\s+later\b/i,
  /\bjokes\s+short\s+and\s+the\s+steps\s+shorter\b/i,
  /\bgrudge\s+against\s+gas\s+fees\b/i,
  /\bI\s+keep\s+(?:it|things|answers|jokes)\s+(?:simple|short|clean|brief|tight|focused|dry)\b/i,
  /\bI\s+(?:won'?t|don'?t)\s+pretend\b/i,
  /\bI\s+(?:try\s+to|aim\s+to|like\s+to)\s+(?:keep|stay|be)\s+(?:simple|short|clear|concise|grounded|honest|direct|brief|tight)\b/i,
  /\bI'?m\s+(?:friendly|grounded|simple|concise|direct|blunt|witty|dry|organized|here\s+to\s+keep)\s*[,.]/i,
];

export function stripSelfDescription(content: string): string {
  const sentences = content.match(/[^.!?\n]+[.!?\n]?/g);
  if (!sentences) return content;

  const kept = sentences.filter((sentence) => {
    return !SELF_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(sentence));
  });

  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

export function guardAssistantOutput(content: string): OutputGuardResult {
  const suspicious = [
    /contract\s*address.*0x[a-fA-F0-9]{40}/i,
    /api\s*key/i,
    /\b\.env\b/i,
    /private\s*key/i,
    /seed\s*phrase/i,
    /github/i,
    /codebase/i,
  ];

  for (const pattern of suspicious) {
    if (pattern.test(content)) {
      return { valid: false, reason: "output contains restricted internal or secret content" };
    }
  }

  const denialPatterns = [
    /as\s+an\s+AI\s+language\s+model/i,
    /I\s+cannot\s+(?:assist|help|provide)/i,
  ];

  const denialCount = denialPatterns.filter((pattern) => pattern.test(content)).length;
  if (denialCount >= 2) {
    return { valid: false, reason: "output contains excessive AI-denial language" };
  }

  return { valid: true };
}
