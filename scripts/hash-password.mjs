// Vygeneruje hash hesla pro APP_PASSWORD_HASH.
// Výstup je base64 (paste-safe — vyhne se expanzi `$` v .env souborech).
// Použití:  npm run hash -- "tvojeSilneHeslo"
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Použití: npm run hash -- "tvojeSilneHeslo"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const b64 = Buffer.from(hash, "utf8").toString("base64");

console.log("\nVlož do .env.local (a do Vercel env):\n");
console.log(`APP_PASSWORD_HASH="${b64}"\n`);
