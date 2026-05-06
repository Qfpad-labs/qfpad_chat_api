import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.coerce.boolean().default(true),
  CHAT_API_PORT: z.coerce.number().int().positive().default(8788),
  CHAT_CORS_ORIGIN: z.string().min(1).default("*"),
  CHAT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  CHAT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(12),
  CHAT_GUEST_PROMPT_LIMIT: z.coerce.number().int().positive().default(5),
  CHAT_INPUT_MAX_CHARS: z.coerce.number().int().positive().default(600),
  CHAT_OUTPUT_MAX_TOKENS_FAST: z.coerce.number().int().positive().default(220),
  CHAT_OUTPUT_MAX_TOKENS_DEEP: z.coerce.number().int().positive().default(420),
  QFPAD_DOCS_BASE_URL: z.string().url(),
  QFPAD_DOCS_SEED_URLS: z.string().default(""),
  QFPAD_LOCAL_GUIDE_PATHS: z.string().default(""),
  ETH_MAINNET_RPC_URL: z.string().url(),
  QF_ETH_RPC_URL: z.string().url(),
  QF_WS_RPC_URL: z.string().url(),
  QPAD_STATUS_API_BASE_URL: z.string().url(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL_FAST: z.string().min(1).default("deepseek-v4-flash"),
  DEEPSEEK_MODEL_COMPLEX: z.string().min(1).default("deepseek-v4-pro"),
});

const env = envSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL,
  port: env.CHAT_API_PORT,
  corsOrigin: env.CHAT_CORS_ORIGIN,
  rateLimitWindowSeconds: env.CHAT_RATE_LIMIT_WINDOW_SECONDS,
  rateLimitMaxRequests: env.CHAT_RATE_LIMIT_MAX_REQUESTS,
  guestPromptLimit: env.CHAT_GUEST_PROMPT_LIMIT,
  chatInputMaxChars: env.CHAT_INPUT_MAX_CHARS,
  chatOutputMaxTokensFast: env.CHAT_OUTPUT_MAX_TOKENS_FAST,
  chatOutputMaxTokensDeep: env.CHAT_OUTPUT_MAX_TOKENS_DEEP,
  docsBaseUrl: env.QFPAD_DOCS_BASE_URL,
  docsSeedUrls: env.QFPAD_DOCS_SEED_URLS
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  localGuidePaths: env.QFPAD_LOCAL_GUIDE_PATHS
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  ethMainnetRpcUrl: env.ETH_MAINNET_RPC_URL,
  qfEthRpcUrl: env.QF_ETH_RPC_URL,
  qfWsRpcUrl: env.QF_WS_RPC_URL,
  qpadStatusApiBaseUrl: env.QPAD_STATUS_API_BASE_URL.replace(/\/$/, ""),
  deepseekApiKey: env.DEEPSEEK_API_KEY,
  deepseekBaseUrl: env.DEEPSEEK_BASE_URL.replace(/\/$/, ""),
  deepseekModelFast: env.DEEPSEEK_MODEL_FAST,
  deepseekModelComplex: env.DEEPSEEK_MODEL_COMPLEX,
} as const;
