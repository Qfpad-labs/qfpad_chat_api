import type { ActionDraft, ActionType } from "./types.js";

const BLANK: ActionDraft = {
  actionType: "open_route",
  targetRoute: "",
  requiredWallet: null,
  requiredChain: null,
  prefill: {},
  summary: "",
  warnings: [],
  missingFields: [],
  nextSteps: [],
};

const QPAD_PROJECT_ROUTE = "/projects/0xed11eF1cA37f12635ffF6ad6163486F884A521Ca";
const QPAD_TOKEN_ADDRESS = "0xA1F13F120Ca2F7A5d84E524406fa4eE9BbD26E93";

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};

function ensure(overrides: Partial<ActionDraft> & { actionType: ActionType }): ActionDraft {
  return { ...BLANK, ...overrides };
}

function parseTokenAddress(message: string) {
  return message.match(/\b0x[a-fA-F0-9]{40}\b/)?.[0] ?? "";
}

function parseQuotedValue(message: string) {
  return message.match(/["']([^"']{2,80})["']/)?.[1]?.trim() ?? "";
}

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
};

const WORD_MULTIPLIERS: Record<string, number> = {
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

function parseQuantityFromText(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) return "";

  const digitsOnly = cleaned.match(/^([\d,]+(?:\.\d+)?)$/);
  if (digitsOnly) return digitsOnly[1].replace(/,/g, "");

  const suffixMatch = cleaned.match(/^([\d,]+(?:\.\d+)?)\s*([kmbt])\b/i);
  if (suffixMatch) {
    const num = Number.parseFloat(suffixMatch[1].replace(/,/g, ""));
    const mult = SUFFIX_MULTIPLIERS[suffixMatch[2].toLowerCase()];
    if (Number.isFinite(num) && mult) return String(Math.round(num * mult));
  }

  const wordMatch = cleaned.match(/^([\d,]+(?:\.\d+)?)\s+(thousand|million|billion|trillion)s?\b/i);
  if (wordMatch) {
    const num = Number.parseFloat(wordMatch[1].replace(/,/g, ""));
    const mult = WORD_MULTIPLIERS[wordMatch[2].toLowerCase()];
    if (Number.isFinite(num) && mult) return String(Math.round(num * mult));
  }

  return "";
}

function parseAmount(message: string) {
  const sanitized = message.replace(/\b0x[a-fA-F0-9]{40}\b/g, " ");

  const verbMatch = sanitized.match(/\b(?:lock|vest|airdrop|send|amount|supply|sell)\s+([\d,]+(?:\.\d+)?(?:\s*[kmbt]\b|\s+(?:thousand|million|billion|trillion)s?\b)?)/i)?.[1];
  if (verbMatch) {
    const result = parseQuantityFromText(verbMatch);
    if (result) return result;
  }

  const tokenMatch = sanitized.match(/\b([\d,]+(?:\.\d+)?(?:\s*[kmbt]\b|\s+(?:thousand|million|billion|trillion)s?\b)?)\s*(?:qpad|tqpad|tokens?)\b/i)?.[1];
  if (tokenMatch) {
    const result = parseQuantityFromText(tokenMatch);
    if (result) return result;
  }

  return parseQuantityFromText(sanitized);
}

function parseWordNumber(message: string) {
  const words = message
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length > 3) return "";
  if (words.some((word) => !(word in NUMBER_WORDS))) return "";

  let total = 0;
  let current = 0;

  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value === 100 || value === 1000) {
      current = Math.max(current, 1) * value;
    } else {
      current += value;
    }
  }

  total += current;
  return total > 0 ? String(total) : "";
}

function parseDays(message: string) {
  const digitMatch =
    message.match(/(?:for\s+)?(\d{1,5})\s*days?/i)?.[1] ??
    message.match(/^\s*(\d{1,5})\s*$/)?.[1];
  if (digitMatch) return digitMatch;

  const wordWithUnit = message.match(/(?:for\s+)?([a-z\s-]{2,30})\s+days?/i)?.[1];
  if (wordWithUnit) {
    return parseWordNumber(wordWithUnit);
  }

  return parseWordNumber(message.trim());
}

function parseExplicitLockName(message: string) {
  return (
    message.match(/(?:called|named|description(?: is)?|label(?: it)?)(?:\s+as)?\s+"?([A-Za-z0-9\s_-]{2,48})"?/i)?.[1]?.trim() ??
    ""
  );
}

function parseLooseShortText(message: string) {
  const quoted = parseQuotedValue(message);
  if (quoted) return quoted;

  const trimmed = message.trim();
  if (
    trimmed.length >= 2 &&
    trimmed.length <= 48 &&
    !/\b0x[a-fA-F0-9]{40}\b/.test(trimmed) &&
    !/^\d+$/.test(trimmed) &&
    !/\bdays?\b/i.test(trimmed) &&
    !/^(hey|hi|hello|yo|sup|thanks|thank you|okay|ok)\b/i.test(trimmed) &&
    !/^(lock|vest|create|deploy|make|launch|buy|claim|airdrop|open|show|help)\b/i.test(trimmed)
  ) {
    return trimmed;
  }

  return "";
}

function parseTokenName(message: string) {
  return (
    message.match(/(?:called|named)\s+"?([A-Za-z0-9\s]{2,32})"?/i)?.[1]?.trim() ??
    parseLooseShortText(message)
  );
}

function parseTokenSymbol(message: string) {
  return (
    message.match(/(?:symbol|ticker)(?:\s+is)?\s+"?([A-Z0-9]{2,10})"?/i)?.[1]?.trim() ??
    message.match(/^\s*([A-Z0-9]{2,10})\s*$/)?.[1]?.trim() ??
    ""
  );
}

function parseSupply(message: string) {
  const explicitMatch = message.match(/(?:supply|amount|mint|total)(?:\s+of)?\s+([\d,]+(?:\.\d+)?(?:\s*[kmbt]\b|\s+(?:thousand|million|billion|trillion)s?\b)?)/i)?.[1];
  if (explicitMatch) {
    const result = parseQuantityFromText(explicitMatch);
    if (result) return result;
  }

  return parseQuantityFromText(message);
}

function parseTokenType(message: string) {
  const lower = message.toLowerCase();

  if (/\bnon[-\s]?mintable\b|\bfixed\s+supply\b/.test(lower)) return "4";
  if (/\bburnable\b/.test(lower)) return "2";
  if (/\bmintable\b/.test(lower)) return "1";
  if (/\btax(?:able)?\b/.test(lower)) return "3";
  if (/\b(?:plain|standard|basic|simple|regular|normal|erc[-\s]?20|default)\b/.test(lower)) return "0";

  return "";
}

function parseDecimals(message: string) {
  const standalone = message.trim().match(/^(\d{1,2})$/);
  if (standalone) {
    const n = Number.parseInt(standalone[1], 10);
    if (Number.isFinite(n) && n >= 0 && n <= 77) return String(n);
  }

  const explicit =
    message.match(/(?:^|\s)(\d{1,2})\s*decimals?\b/i)?.[1] ??
    message.match(/\bdecimals?\s*(?:is\s+|of\s+|=\s*|:\s*)?(\d{1,2})\b/i)?.[1];
  if (explicit) {
    const n = Number.parseInt(explicit, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 77) return String(n);
  }

  return "";
}

function isSkipResponse(message: string) {
  return /^(?:skip|default|standard|none|no\s+preference|not\s+sure|n\/?a|whatever|any|either|don'?t\s+care|idk|use\s+(?:the\s+)?default|use\s+18)\.?\s*$/i.test(
    message.trim(),
  );
}

function parseRecipientEntries(message: string) {
  const matches = [...message.matchAll(/\b(0x[a-fA-F0-9]{40})\b\s*[, ]\s*(\d{1,20}(?:[.,]\d+)?)/g)];
  if (matches.length === 0) return "";

  return matches
    .map((match) => `${match[1]},${match[2].replace(/,/g, "")}`)
    .join("\n");
}

function countRecipientEntries(entries: string) {
  return entries
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function inferKnownTokenAddress(message: string) {
  return /\bqpad\b/i.test(message) ? QPAD_TOKEN_ADDRESS : "";
}

function stripLeadingInterjections(lower: string) {
  return lower.replace(/^(?:hey|hi|hello|yo|sup|so|then|okay|ok|alright|please)[,!?\s]+/i, "").trim();
}

function looksActionable(message: string) {
  const raw = message.trim().toLowerCase();
  const lower = stripLeadingInterjections(raw);

  if (/^(how|what|where|when|why|is|are|do|does|did)\b/.test(lower)) {
    return false;
  }

  if (/^(can you|could you|would you|will you|help me|create|deploy|make|launch|lock|vest|airdrop|buy|contribute|claim|open|take me|show me|navigate|set\s*up|setup|stake)/i.test(lower)) {
    return true;
  }

  if (/\b(?:i\s+(?:want\s+to|need\s+to|would\s+like\s+to|wanna|gotta|am\s+trying\s+to|am\s+going\s+to|do\s+wanna)|i'?d\s+like\s+to|i'?ll\s+(?:like\s+to\s+)?|let'?s|let\s+me|gonna)\s+(?:create|deploy|make|launch|lock|vest|airdrop|buy|contribute|claim|open|set\s*up|setup|stake)\b/i.test(lower)) {
    return true;
  }

  return false;
}

function isGreeting(message: string) {
  return /^(hey|hi|hello|yo|sup)\b/i.test(message.trim());
}

function isCancel(message: string) {
  return /^(cancel|stop|never mind|nevermind|leave it|drop it)\b/i.test(message.trim());
}

export function buildCreateToken(input: {
  name?: string;
  symbol?: string;
  decimals?: string;
  initialSupply?: string;
  initialRecipient?: string;
  tokenType?: string;
}): ActionDraft {
  const missing: string[] = [];
  if (!input.name) missing.push("name");
  if (!input.symbol) missing.push("symbol");
  if (!input.initialSupply) missing.push("initialSupply");
  if (!input.tokenType) missing.push("tokenType");
  if (!input.decimals) missing.push("decimals");

  return ensure({
    actionType: "create_token",
    targetRoute: "/dashboard/create/token",
    requiredWallet: "qf",
    requiredChain: "qf",
    prefill: {
      name: input.name || "",
      symbol: input.symbol || "",
      decimals: input.decimals || "18",
      initialSupply: input.initialSupply || "",
      initialRecipient: input.initialRecipient || "",
      tokenType: input.tokenType || "0",
    },
    summary: `Create "${input.name || "…"}" (${input.symbol || "…"}) on QF Network.`,
    warnings: [],
    missingFields: missing,
    nextSteps: [
      "Connect your QF wallet",
      "Review the token details",
      "Sign the deployment transaction",
    ],
  });
}

export function buildCreatePresale(input: {
  saleToken?: string;
}): ActionDraft {
  return ensure({
    actionType: "create_presale",
    targetRoute: "/dashboard/create/presale",
    requiredWallet: "qf",
    requiredChain: "qf",
    prefill: {
      saleToken: input.saleToken || "",
    },
    summary: input.saleToken
      ? `Open the presale page for ${input.saleToken.slice(0, 8)}…`
      : "Open the presale setup page.",
    warnings: [
      "Presales stay manual for now because sale setup is more delicate.",
    ],
    missingFields: [],
    nextSteps: [
      "Connect your QF wallet",
      "Fill the sale schedule, caps, and token details on the page",
      "Review carefully, then sign in the app",
    ],
  });
}

export function buildLockToken(input: {
  tokenAddress?: string;
  amount?: string;
  durationDays?: string;
  name?: string;
  description?: string;
}): ActionDraft {
  const missing: string[] = [];
  if (!input.tokenAddress) missing.push("tokenAddress");
  if (!input.amount) missing.push("amount");
  if (!input.durationDays) missing.push("durationDays");
  if (!input.name) missing.push("lock name");

  return ensure({
    actionType: "lock_token",
    targetRoute: "/dashboard/tools/token-locker",
    requiredWallet: "qf",
    requiredChain: "qf",
    prefill: {
      token: input.tokenAddress || "",
      amount: input.amount || "",
      duration: input.durationDays || "",
      name: input.name || "",
      description: input.description || input.name || "",
    },
    summary: `Lock ${input.amount || "…"} tokens for ${input.durationDays || "…"} days${input.name ? ` (${input.name})` : ""}.`,
    warnings: [],
    missingFields: missing,
    nextSteps: [
      "Connect your QF wallet",
      "Approve token transfer in the locker form",
      "Confirm the lock transaction",
    ],
  });
}

export function buildAirdrop(input: {
  tokenAddress?: string;
  recipientsData?: string;
}): ActionDraft {
  const missing: string[] = [];
  if (!input.tokenAddress) missing.push("tokenAddress");
  const recipientCount = countRecipientEntries(input.recipientsData || "");

  return ensure({
    actionType: "airdrop_tokens",
    targetRoute: "/dashboard/tools/airdrop",
    requiredWallet: "qf",
    requiredChain: "qf",
    prefill: {
      token: input.tokenAddress || "",
      recipientsData: input.recipientsData || "",
    },
    summary: `Airdrop tokens${input.tokenAddress ? ` from ${input.tokenAddress.slice(0, 8)}…` : ""}${recipientCount > 0 ? ` to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}` : ""}.`,
    warnings: ["Double-check every recipient before signing. Airdrops are not reversible."],
    missingFields: missing,
    nextSteps: [
      "Connect your QF wallet",
      "Add or review the recipient list",
      "Approve and sign the multisend transaction",
    ],
  });
}

export function buildContributeQpad(): ActionDraft {
  return ensure({
    actionType: "contribute_qpad_sale",
    targetRoute: QPAD_PROJECT_ROUTE,
    requiredWallet: "evm",
    requiredChain: "ethereum",
    prefill: {},
    summary: "Contribute USDC to the QPAD presale on Ethereum mainnet.",
    warnings: [
      "QPAD is delivered on QF Network after the sale ends.",
      "You’ll need a QF wallet address to receive QPAD.",
    ],
    missingFields: [],
    nextSteps: [
      "Connect MetaMask or another Ethereum wallet",
      "Have USDC ready on Ethereum mainnet",
      "Paste your QF claim address on the sale page",
    ],
  });
}

export function buildClaimQpad(): ActionDraft {
  return ensure({
    actionType: "claim_qpad",
    targetRoute: QPAD_PROJECT_ROUTE,
    requiredWallet: "qf",
    requiredChain: "qf",
    prefill: {},
    summary: "Claim your QPAD on QF Network after claims open.",
    warnings: [
      "Claims only work after the sale ends and claims are enabled.",
      "Use the same QF wallet address you submitted during the buy flow.",
    ],
    missingFields: [],
    nextSteps: [
      "Connect your QF wallet",
      "Open the QPAD sale page",
      "Use the claim action when it is live",
    ],
  });
}

export function buildOpenRoute(route: string): ActionDraft {
  return ensure({
    actionType: "open_route",
    targetRoute: route,
    requiredWallet: null,
    requiredChain: null,
    prefill: {},
    summary: `Navigate to ${route}.`,
    warnings: [],
    missingFields: [],
    nextSteps: [`Open ${route} in the app.`],
  });
}

function mergeCreateToken(existing: ActionDraft, message: string) {
  const firstMissing = existing.missingFields[0];
  const tokenTypeStillMissing = existing.missingFields.includes("tokenType");
  const decimalsStillMissing = existing.missingFields.includes("decimals");

  let nextTokenType: string | undefined = tokenTypeStillMissing ? "" : existing.prefill.tokenType;
  if (tokenTypeStillMissing) {
    const parsed = parseTokenType(message);
    if (parsed) {
      nextTokenType = parsed;
    } else if (firstMissing === "tokenType" && isSkipResponse(message)) {
      nextTokenType = "0";
    }
  }

  let nextDecimals: string | undefined = decimalsStillMissing ? "" : existing.prefill.decimals;
  if (decimalsStillMissing) {
    const parsed = parseDecimals(message);
    if (parsed) {
      nextDecimals = parsed;
    } else if (firstMissing === "decimals" && isSkipResponse(message)) {
      nextDecimals = "18";
    }
  }

  return buildCreateToken({
    name: existing.prefill.name || parseTokenName(message),
    symbol: existing.prefill.symbol || parseTokenSymbol(message),
    initialSupply: existing.prefill.initialSupply || parseSupply(message),
    decimals: nextDecimals || undefined,
    initialRecipient: existing.prefill.initialRecipient || "",
    tokenType: nextTokenType || undefined,
  });
}

function mergeLockToken(existing: ActionDraft, message: string) {
  const firstMissing = existing.missingFields[0];
  const shouldParseDuration =
    firstMissing === "durationDays" || /\bdays?\b/i.test(message);
  const parsedDuration =
    existing.prefill.duration || (shouldParseDuration ? parseDays(message) : "");
  const parsedName =
    firstMissing === "lock name"
      ? existing.prefill.name || parseExplicitLockName(message) || parseLooseShortText(message)
      : existing.prefill.name || parseExplicitLockName(message);

  return buildLockToken({
    tokenAddress: existing.prefill.token || parseTokenAddress(message) || inferKnownTokenAddress(message),
    amount: existing.prefill.amount || parseAmount(message),
    durationDays: parsedDuration,
    name: parsedName,
    description: existing.prefill.description || parsedName,
  });
}

function mergeAirdrop(existing: ActionDraft, message: string) {
  return buildAirdrop({
    tokenAddress: existing.prefill.token || parseTokenAddress(message) || inferKnownTokenAddress(message),
    recipientsData: existing.prefill.recipientsData || parseRecipientEntries(message),
  });
}

export function canContinueActionDraft(existing: ActionDraft, message: string) {
  if (isCancel(message) || isGreeting(message)) {
    return false;
  }

  const firstMissing = existing.missingFields[0];
  if (!firstMissing) return false;

  if (existing.actionType === "lock_token") {
    if (firstMissing === "tokenAddress") return Boolean(parseTokenAddress(message) || inferKnownTokenAddress(message));
    if (firstMissing === "amount") return Boolean(parseAmount(message));
    if (firstMissing === "durationDays") return Boolean(parseDays(message));
    if (firstMissing === "lock name") return Boolean(parseExplicitLockName(message) || parseLooseShortText(message));
  }

  if (existing.actionType === "create_token") {
    if (firstMissing === "name") return Boolean(parseTokenName(message));
    if (firstMissing === "symbol") return Boolean(parseTokenSymbol(message));
    if (firstMissing === "initialSupply") return Boolean(parseSupply(message));
    if (firstMissing === "tokenType") return Boolean(parseTokenType(message)) || isSkipResponse(message);
    if (firstMissing === "decimals") return Boolean(parseDecimals(message)) || isSkipResponse(message);
  }

  if (existing.actionType === "airdrop_tokens") {
    if (firstMissing === "tokenAddress") return Boolean(parseTokenAddress(message) || inferKnownTokenAddress(message));
  }

  return false;
}

export function continueActionDraft(existing: ActionDraft, message: string): ActionDraft | null {
  if (!canContinueActionDraft(existing, message)) return null;

  if (existing.actionType === "lock_token") {
    return mergeLockToken(existing, message);
  }

  if (existing.actionType === "create_token") {
    return mergeCreateToken(existing, message);
  }

  if (existing.actionType === "airdrop_tokens") {
    return mergeAirdrop(existing, message);
  }

  return existing;
}

export function getActionFollowUp(draft: ActionDraft) {
  if (draft.actionType === "lock_token") {
    if (draft.missingFields.includes("tokenAddress")) {
      return "Send me the token address first. If it’s QPAD, you can just say QPAD.";
    }
    if (draft.missingFields.includes("amount")) {
      return "How many tokens should I lock?";
    }
    if (draft.missingFields.includes("durationDays")) {
      return "How many days should the lock run?";
    }
    if (draft.missingFields.includes("lock name")) {
      return "Give the lock a short name or description, then I’ll tee it up in the app.";
    }
  }

  if (draft.actionType === "create_token") {
    if (draft.missingFields.includes("name")) {
      return "What should the token name be?";
    }
    if (draft.missingFields.includes("symbol")) {
      return "What symbol should I use?";
    }
    if (draft.missingFields.includes("initialSupply")) {
      return "What total supply should I use? You can say a number or something like \"1 million\".";
    }
    if (draft.missingFields.includes("tokenType")) {
      return [
        "What token type? Pick one:",
        "- plain — standard, fixed supply, no extra functions",
        "- mintable — you can mint more later as the owner",
        "- burnable — holders can burn their own tokens",
        "- non-mintable — fixed cap, no future minting",
        "",
        "Say \"plain\" if you're unsure. (Taxable tokens stay manual for now.)",
      ].join("\n");
    }
    if (draft.missingFields.includes("decimals")) {
      return "How many decimals? Decimals control divisibility — 18 is the ERC-20 standard. Say a number, or \"default\" for 18.";
    }
  }

  if (draft.actionType === "airdrop_tokens") {
    if (draft.missingFields.includes("tokenAddress")) {
      return "Send me the token address you want to airdrop. If it’s QPAD, you can just say QPAD.";
    }
  }

  return "I need one or two details before I can set that up in the app.";
}

export function getActionReadyReply(draft: ActionDraft) {
  if (draft.actionType === "lock_token") {
    return "Lock details are ready. Sign it here or open manual preview.";
  }

  if (draft.actionType === "create_token") {
    if (draft.prefill.tokenType === "3") {
      return "Taxable token setup is queued in manual preview. Tax settings stay manual for now.";
    }
    return "Token setup is ready. Sign it here or open manual preview.";
  }

  if (draft.actionType === "airdrop_tokens") {
    return "Airdrop setup is ready. Add recipients here or open manual preview.";
  }

  if (draft.actionType === "create_presale") {
    return "Presales stay manual for now. I’ll open the presale page and let you finish the setup there.";
  }

  if (draft.actionType === "contribute_qpad_sale") {
    return "Got it. I’ll take you to the QPAD sale flow.";
  }

  if (draft.actionType === "claim_qpad") {
    return "Got it. I’ll take you to the QPAD claim flow.";
  }

  return "Done. I set that up in the app for you.";
}

export function classifyAndBuildAction(message: string): ActionDraft | null {
  const lower = message.toLowerCase();

  if (!looksActionable(message)) {
    return null;
  }

  if (/(?:create|deploy|make|launch)\s+(?:a\s+)?(?:new\s+)?token/i.test(lower)) {
    return buildCreateToken({
      name: parseTokenName(message),
      symbol: parseTokenSymbol(message),
      initialSupply: parseSupply(message),
      tokenType: parseTokenType(message) || undefined,
      decimals: parseDecimals(message) || undefined,
    });
  }

  if (/(?:create|start|launch|setup)\s+(?:a\s+)?(?:new\s+)?presale/i.test(lower)) {
    return buildCreatePresale({
      saleToken: parseTokenAddress(message),
    });
  }

  if (
    /\b(lock|vest)\b/i.test(lower) &&
    (/\b(token|tokens|qpad)\b/i.test(lower) || /\b0x[a-fA-F0-9]{40}\b/.test(message))
  ) {
    return buildLockToken({
      tokenAddress: parseTokenAddress(message) || inferKnownTokenAddress(message),
      amount: parseAmount(message),
      durationDays: parseDays(message),
      name: parseExplicitLockName(message),
    });
  }

  if (/(?:airdrop|bulk\s+send|send\s+tokens?\s+to\s+multiple)/i.test(lower)) {
    return buildAirdrop({
      tokenAddress: parseTokenAddress(message) || inferKnownTokenAddress(message),
      recipientsData: parseRecipientEntries(message),
    });
  }

  if (/(?:buy|contribute|participate)\s+(?:in\s+)?(?:the\s+)?(?:qpad|presale)/i.test(lower)) {
    return buildContributeQpad();
  }

  if (/(?:claim|withdraw|get)\s+(?:my\s+)?(?:qpad|allocation)/i.test(lower)) {
    return buildClaimQpad();
  }

  if (/(?:go\s+to|open|show|navigate|take\s+me\s+to)\s+\/(dashboard|admin|projects|nfts)/i.test(lower)) {
    const routeMatch = message.match(/\/(dashboard\S*|admin\S*|projects\S*|nfts\S*)/i);
    if (routeMatch) return buildOpenRoute(routeMatch[0]);
  }

  return null;
}
