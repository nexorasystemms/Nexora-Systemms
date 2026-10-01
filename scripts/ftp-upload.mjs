import { Client } from "basic-ftp";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import tls from "node:tls";

const { enterPassiveModeIPv4_forceControlHostIP } = createRequire(import.meta.url)(
  "basic-ftp/dist/transfer.js",
);

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadLocalEnv();

const host = process.env.NAMECHEAP_FTP_SERVER;
const user = process.env.NAMECHEAP_FTP_USERNAME;
const password = process.env.NAMECHEAP_FTP_PASSWORD;
const remoteDir = process.env.NAMECHEAP_FTP_SERVER_DIR ?? "/public_html/";
const port = Number(process.env.NAMECHEAP_FTP_PORT ?? "21");
const useFtps = process.env.NAMECHEAP_FTP_SECURE !== "0";
const dist = resolve("dist");

if (!host || !user || !password) {
  console.error(
    "Set NAMECHEAP_FTP_SERVER, NAMECHEAP_FTP_USERNAME, and NAMECHEAP_FTP_PASSWORD in .env.local (gitignored).",
  );
  process.exit(1);
}

if (!existsSync(resolve(dist, "index.html"))) {
  console.error("dist/index.html is missing. Run npm run build first.");
  process.exit(1);
}

function certHasWebHostingSan(cert) {
  const alt = cert.subjectaltname ?? "";
  return /(?:^|,\s*)DNS:\*\.web-hosting\.com(?:$|,)/i.test(alt);
}

function namecheapFtpsIdentity(hostname, cert) {
  const mismatch = tls.checkServerIdentity(hostname, cert);
  if (!mismatch) return undefined;
  if (certHasWebHostingSan(cert)) return undefined;
  return mismatch;
}

const client = new Client(60_000, { allowSeparateTransferHost: false });
client.ftp.verbose = Boolean(process.env.FTP_VERBOSE);
client.ftp.ipFamily = 4;
client.prepareTransfer = enterPassiveModeIPv4_forceControlHostIP;
client.trackProgress((info) => {
  if (info.type === "upload" && info.bytes === 0) {
    console.log(`Uploading ${info.name}`);
  }
});

try {
  console.log(`Connecting ${useFtps ? "FTPS" : "FTP"} ${host}:${port} as ${user} → ${remoteDir}`);
  await client.access({
    host,
    user,
    password,
    port,
    secure: useFtps,
    // Namecheap presents *.web-hosting.com, not ftp.yourdomain.com.
    secureOptions: useFtps
      ? {
          servername: process.env.NAMECHEAP_FTP_TLS_SERVERNAME || "premium166-2.web-hosting.com",
          checkServerIdentity: namecheapFtpsIdentity,
        }
      : undefined,
  });
  console.log("Logged in, uploading dist/ …");
  await client.ensureDir(remoteDir);
  await client.uploadFromDir(dist, remoteDir);
  console.log(`Uploaded ${dist} → ftp://${host}${remoteDir}`);
} finally {
  client.close();
}
