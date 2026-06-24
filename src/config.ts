import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type TikTokAppConfig = {
  appEnv: "dev" | "prod";
  appId: string;
  appSecret: string;
  advertiserAuthUrl: string;
  redirectUri: string;
};

function cleanEnvValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function loadLocalEnvFile() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envFile = join(currentDir, "../.env.local");

  if (!existsSync(envFile)) {
    return;
  }

  const raw = readFileSync(envFile, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function normalizeTikTokAuthUrl(value: string) {
  return value.replace("？", "?").replace(/\s+/g, "");
}

export function getTikTokAppConfig(): TikTokAppConfig {
  loadLocalEnvFile();
  const appEnv = (cleanEnvValue(process.env.TIKTOK_APP_ENV) || "dev") as "dev" | "prod";
  const appId = cleanEnvValue(process.env.TIKTOK_APP_ID);
  const appSecret = cleanEnvValue(process.env.TIKTOK_APP_SECRET);
  const advertiserAuthUrl = normalizeTikTokAuthUrl(cleanEnvValue(process.env.TIKTOK_ADVERTISER_AUTH_URL));
  const redirectUri = cleanEnvValue(process.env.TIKTOK_REDIRECT_URI);

  return {
    appEnv,
    appId,
    appSecret,
    advertiserAuthUrl,
    redirectUri
  };
}

export function getTikTokConfigSummary() {
  const config = getTikTokAppConfig();

  return {
    appEnv: config.appEnv,
    appIdConfigured: Boolean(config.appId),
    appSecretConfigured: Boolean(config.appSecret),
    advertiserAuthUrlConfigured: Boolean(config.advertiserAuthUrl),
    redirectUriConfigured: Boolean(config.redirectUri),
    redirectUri: config.redirectUri || null
  };
}
