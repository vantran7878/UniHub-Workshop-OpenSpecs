import { generateKeyPair } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function generate() {
  return new Promise<{ publicKey: string; privateKey: string }>((resolve, reject) => {
    generateKeyPair(
      "rsa",
      {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
      },
      (err, publicKey, privateKey) => {
        if (err) return reject(err);
        resolve({ publicKey, privateKey });
      }
    );
  });
}

async function main() {
  const outDir = path.resolve(process.cwd(), "keys");
  await mkdir(outDir, { recursive: true });

  const { publicKey, privateKey } = await generate();

  await writeFile(path.join(outDir, "jwt_public.pem"), publicKey, "utf8");
  await writeFile(path.join(outDir, "jwt_private.pem"), privateKey, "utf8");

  console.log("Generated keys:");
  console.log(`- ${path.join(outDir, "jwt_public.pem")}`);
  console.log(`- ${path.join(outDir, "jwt_private.pem")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

