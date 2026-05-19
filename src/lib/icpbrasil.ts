// Verificação de cadeia ICP-Brasil.
// Lê certificados raiz/intermediários do diretório `certs/icpbrasil/*.pem` (ou *.cer).
// Para ativar a validação completa, baixe os certificados oficiais em
//   https://estrutura.iti.gov.br/repositorio/
// e coloque-os nessa pasta. Tipicamente:
//   - ACraiz.crt (AC Raiz ICP-Brasil V5)
//   - ACs nível 1 (intermediárias) — opcional, o CMS costuma carregá-las

import fs from "fs";
import path from "path";
import forge from "node-forge";

const CERT_DIR = path.join(process.cwd(), "certs", "icpbrasil");

let cachedStore: forge.pki.CAStore | null = null;
let cachedCount = 0;
let cachedAt = 0;

export type ChainResult = {
  configured: boolean;
  storeSize: number;
  chainValid: boolean;
  chainLength?: number;
  reason?: string;
};

function loadStore(): { store: forge.pki.CAStore; size: number } {
  // Recarrega no máximo a cada 60s pra pegar atualizações sem reiniciar
  const now = Date.now();
  if (cachedStore && now - cachedAt < 60_000) {
    return { store: cachedStore, size: cachedCount };
  }
  const store = forge.pki.createCaStore();
  let count = 0;
  if (fs.existsSync(CERT_DIR)) {
    const files = fs.readdirSync(CERT_DIR).filter((f) => /\.(pem|crt|cer)$/i.test(f));
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(CERT_DIR, f));
        const text = raw.toString("binary");
        let cert: forge.pki.Certificate;
        if (text.includes("-----BEGIN CERTIFICATE-----")) {
          cert = forge.pki.certificateFromPem(text);
        } else {
          // DER
          const asn1 = forge.asn1.fromDer(forge.util.createBuffer(text));
          cert = forge.pki.certificateFromAsn1(asn1);
        }
        store.addCertificate(cert);
        count++;
      } catch {
        // ignora arquivo inválido
      }
    }
  }
  cachedStore = store;
  cachedCount = count;
  cachedAt = now;
  return { store, size: count };
}

export function verifyIcpBrasilChain(
  leaf: forge.pki.Certificate,
  intermediates: forge.pki.Certificate[],
): ChainResult {
  const { store, size } = loadStore();
  if (size === 0) {
    return {
      configured: false,
      storeSize: 0,
      chainValid: false,
      reason: "Truststore vazio. Adicione certificados em certs/icpbrasil/.",
    };
  }

  // Constrói cadeia a partir do leaf, seguindo issuer DN dentre os intermediários
  const chain: forge.pki.Certificate[] = [leaf];
  const remaining = [...intermediates];
  let current = leaf;
  while (true) {
    if (current.issuer.hash === current.subject.hash) break; // self-signed (root)
    const idx = remaining.findIndex((c) => c.subject.hash === current.issuer.hash);
    if (idx === -1) break;
    current = remaining.splice(idx, 1)[0];
    chain.push(current);
  }

  try {
    forge.pki.verifyCertificateChain(store, chain);
    return {
      configured: true,
      storeSize: size,
      chainValid: true,
      chainLength: chain.length,
    };
  } catch (err) {
    const e = err as { message?: string; error?: string };
    return {
      configured: true,
      storeSize: size,
      chainValid: false,
      chainLength: chain.length,
      reason: e.error ?? e.message ?? "Cadeia inválida.",
    };
  }
}

export function truststoreSize(): number {
  return loadStore().size;
}
