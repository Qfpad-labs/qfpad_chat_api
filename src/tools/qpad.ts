import { config } from "../config.js";

export interface QpadPurchaseStatus {
  found: boolean;
  purchaseId?: string;
  status?: string;
  txHash?: string;
  ethBuyer?: string;
  usdcAmount?: string;
  qpadAmount?: string;
  qfTxHash?: string | null;
  qfAccountSs58?: string | null;
  qfMappedRecipient?: string | null;
  blockNumber?: number;
  confirmations?: number | null;
  confirmationsRequired?: number;
  error?: string | null;
  registeredAt?: string | null;
}

export interface QpadSaleFacts {
  tokenAddress: string;
  ethPresaleAddress: string;
  usdcAddress: string;
  claimVaultAddress: string;
  rate: string;
  hardCap: string;
  softCap: string;
  minContribution: string;
  maxContribution: string;
  fiestaCommunityDraw: string;
  fiestaWhaleRebate: string;
  saleStartIso: string;
  saleEndIso: string;
  isLive: boolean;
  ethereumChainId: number;
  qfCommunityXUrl: string;
  qfCommunityTelegramUrl: string;
}

const QPAD_SALE_START_SEC = 1777550400;
const QPAD_SALE_END_SEC = 1778155200;

export function getQpadSaleFacts(): QpadSaleFacts {
  const now = Math.floor(Date.now() / 1000);

  return {
    tokenAddress: "0xA1F13F120Ca2F7A5d84E524406fa4eE9BbD26E93",
    ethPresaleAddress: "0xed11eF1cA37f12635ffF6ad6163486F884A521Ca",
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    claimVaultAddress: "0x0b90a02382c9492616d0eb2c74d28b87e02c60b4",
    rate: "1 USDC = 225 QPAD",
    hardCap: "$40,000 USDC",
    softCap: "$30,000 USDC",
    minContribution: "$50 USDC",
    maxContribution: "$1,600 USDC",
    fiestaCommunityDraw: "$1,000 USDC draw for buys of $250+ with transaction-hash proof",
    fiestaWhaleRebate: "20 whale slots, 6.25% USDC cashback, plus 5% bonus QPAD allocation",
    saleStartIso: new Date(QPAD_SALE_START_SEC * 1000).toISOString(),
    saleEndIso: new Date(QPAD_SALE_END_SEC * 1000).toISOString(),
    isLive: now >= QPAD_SALE_START_SEC && now <= QPAD_SALE_END_SEC,
    ethereumChainId: 1,
    qfCommunityXUrl: "https://x.com/qfpad_",
    qfCommunityTelegramUrl: "https://t.me/qfpad",
  };
}

export function extractTxHashFromText(message: string) {
  const match = message.match(/\b0x[a-fA-F0-9]{64}\b/);
  return match?.[0] ?? null;
}

export async function fetchQpadPurchaseStatusByTx(
  txHash: string,
): Promise<QpadPurchaseStatus | null> {
  try {
    const facts = getQpadSaleFacts();
    const params = new URLSearchParams({
      tx: txHash,
      chainId: String(facts.ethereumChainId),
      presale: facts.ethPresaleAddress,
    });

    const url = `${config.qpadStatusApiBaseUrl}/api/qpad/purchase-status?${params.toString()}`;
    const response = await fetch(url, {
      headers: { "user-agent": "qfpad-chat-api/0.1 tools" },
    });

    if (!response.ok) return null;

    const json = (await response.json()) as QpadPurchaseStatus;
    return json;
  } catch {
    return null;
  }
}

export function buildQpadContextBlock(): string {
  const facts = getQpadSaleFacts();

  return [
    "Live QPAD sale facts (do not fabricate different values):",
    `QPAD token address: ${facts.tokenAddress}`,
    `Ethereum presale contract: ${facts.ethPresaleAddress}`,
    `Ethereum chain ID: ${facts.ethereumChainId}`,
    `USDC token: ${facts.usdcAddress}`,
    `Claim vault (QF Network): ${facts.claimVaultAddress}`,
    `Rate: ${facts.rate}`,
    `Soft cap: ${facts.softCap}`,
    `Hard cap: ${facts.hardCap}`,
    `Contribution range: ${facts.minContribution} to ${facts.maxContribution}`,
    `QPAD Fiesta community draw: ${facts.fiestaCommunityDraw}`,
    `QPAD Fiesta whale rebate: ${facts.fiestaWhaleRebate}`,
    `Sale window: ${facts.saleStartIso} to ${facts.saleEndIso}`,
    `Sale is currently ${facts.isLive ? "LIVE" : "NOT live"}.`,
    "Contributions happen in USDC on Ethereum mainnet.",
    "Users can buy with an Ethereum wallet and provide a QF SS58 claim address manually.",
    "QPAD is claimed later on QF Network from the configured QF wallet.",
    `Official community X: ${facts.qfCommunityXUrl}`,
    `Official community Telegram: ${facts.qfCommunityTelegramUrl}`,
  ].join("\n");
}
