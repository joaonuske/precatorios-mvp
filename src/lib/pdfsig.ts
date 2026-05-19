// Extração e verificação de assinaturas PAdES/CMS em PDFs (ICP-Brasil).
// MVP: detecta, extrai signatário, verifica integridade criptográfica.
// Validação completa da cadeia (ICP-Brasil AC Raiz + revogação) fica pra fase 2.

import crypto from "crypto";
import forge from "node-forge";
import { verifyIcpBrasilChain, truststoreSize } from "@/lib/icpbrasil";

export type SignerInfo = {
  signerName?: string;
  cpfCnpj?: string;
  email?: string;
  issuer?: string;
  signedAt?: string;
  notBefore?: string;
  notAfter?: string;
  isIcpBrasil?: boolean;
  integrityOk: boolean;
  reason?: string;
  chain?: {
    configured: boolean;
    storeSize: number;
    chainValid: boolean;
    chainLength?: number;
    reason?: string;
  };
  revocation?: "not_checked";
};

export type PdfAnalysis = {
  sha256: string;
  signaturesFound: number;
  signatures: SignerInfo[];
  truststoreConfigured: boolean;
};

export function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const ICP_BRASIL_ISSUER_TOKENS = [
  "AC Raiz",
  "ICP-Brasil",
  "ICPBrasil",
  "Autoridade Certificadora Raiz Brasileira",
];

function looksLikeIcpBrasil(issuerCN: string, issuerO?: string): boolean {
  const haystack = `${issuerCN} ${issuerO ?? ""}`;
  return ICP_BRASIL_ISSUER_TOKENS.some((t) =>
    haystack.toLowerCase().includes(t.toLowerCase()),
  );
}

// Tenta extrair CPF/CNPJ do "OtherName" (ICP-Brasil usa OID 2.16.76.1.3.1
// para pessoa física e 2.16.76.1.3.4 para empresa, codificando CPF/CNPJ).
function extractCpfFromSubjectAltName(cert: forge.pki.Certificate): string | undefined {
  // node-forge não expõe SAN facilmente; varremos as extensions.
  type Ext = { name?: string; id?: string; value?: string | { id?: string; value?: string }[] };
  const exts = (cert.extensions ?? []) as Ext[];
  for (const ext of exts) {
    if (ext.name === "subjectAltName" || ext.id === "2.5.29.17") {
      const val = ext.value;
      if (typeof val === "string") {
        const m = val.match(/(\d{11,14})/);
        if (m) return m[1];
      } else if (Array.isArray(val)) {
        for (const item of val) {
          const v = item?.value;
          if (typeof v === "string") {
            const m = v.match(/(\d{11,14})/);
            if (m) return m[1];
          }
        }
      }
    }
  }
  return undefined;
}

// Localiza pares (ByteRange, Contents) no PDF.
type RawSig = { byteRange: [number, number, number, number]; cmsHex: string };
function findRawSignatures(pdf: Buffer): RawSig[] {
  const text = pdf.toString("latin1");
  const sigs: RawSig[] = [];
  const brRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = brRegex.exec(text)) !== null) {
    const br: [number, number, number, number] = [
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
    ];
    // Acha o /Contents <...> mais próximo após o ByteRange
    const after = text.slice(m.index);
    const cMatch = /\/Contents\s*<([0-9A-Fa-f\s]+)>/.exec(after);
    if (!cMatch) continue;
    sigs.push({ byteRange: br, cmsHex: cMatch[1].replace(/\s+/g, "") });
  }
  return sigs;
}

function verifySignature(pdf: Buffer, raw: RawSig): SignerInfo {
  const [a, b, c, d] = raw.byteRange;
  try {
    // Bytes assinados
    const signedBytes = Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)]);

    // Parse CMS/PKCS#7
    const cmsDer = forge.util.hexToBytes(raw.cmsHex.replace(/00+$/, ""));
    const asn1 = forge.asn1.fromDer(cmsDer, false);
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData & {
      signers?: Array<{
        digestAlgorithm?: string;
        authenticatedAttributes?: Array<{ type: string; value: unknown }>;
        certificate?: forge.pki.Certificate;
        signature?: string;
      }>;
      certificates?: forge.pki.Certificate[];
    };

    if (!p7.signers || p7.signers.length === 0) {
      return { integrityOk: false, reason: "Sem signers no CMS." };
    }
    const signer = p7.signers[0];

    // Acha o certificado do signer no array de certs do CMS
    const cert = signer.certificate ?? p7.certificates?.[0];
    if (!cert) {
      return { integrityOk: false, reason: "Certificado do signatário ausente." };
    }

    // Algoritmo de hash do signer (OID → nome)
    const digestOidToName: Record<string, string> = {
      "2.16.840.1.101.3.4.2.1": "sha256",
      "2.16.840.1.101.3.4.2.2": "sha384",
      "2.16.840.1.101.3.4.2.3": "sha512",
      "1.3.14.3.2.26": "sha1",
    };
    const hashName = digestOidToName[signer.digestAlgorithm ?? ""] ?? "sha256";

    // Hash dos bytes assinados (precisa bater com messageDigest dos authenticatedAttributes)
    const computedDigest = crypto.createHash(hashName).update(signedBytes).digest();

    let integrityOk = false;
    let signedAt: string | undefined;
    const attrs = signer.authenticatedAttributes ?? [];
    for (const attr of attrs) {
      // type 1.2.840.113549.1.9.4 = messageDigest
      // type 1.2.840.113549.1.9.5 = signingTime
      if (attr.type === forge.pki.oids.messageDigest) {
        const v = attr.value as unknown as string;
        const expected = forge.util.bytesToHex(v);
        if (expected.toLowerCase() === computedDigest.toString("hex").toLowerCase()) {
          integrityOk = true;
        }
      }
      if (attr.type === forge.pki.oids.signingTime) {
        const v = attr.value as unknown as string | Date;
        signedAt = v instanceof Date ? v.toISOString() : String(v);
      }
    }

    const subject = cert.subject.attributes;
    const issuer = cert.issuer.attributes;
    const getAttr = (attrs: forge.pki.CertificateField[], shortName: string) =>
      attrs.find((a) => a.shortName === shortName)?.value as string | undefined;
    const signerName = getAttr(subject, "CN");
    const issuerCN = getAttr(issuer, "CN") ?? "";
    const issuerO = getAttr(issuer, "O");
    const email = getAttr(subject, "E") ?? (cert as unknown as { extensions?: Array<{ name?: string; altNames?: Array<{ value?: string }> }> }).extensions?.find((e) => e.name === "subjectAltName")?.altNames?.find((a) => a.value?.includes("@"))?.value;
    const cpfCnpj = extractCpfFromSubjectAltName(cert);

    const intermediates = (p7.certificates ?? []).filter((c) => c !== cert);
    const chain = verifyIcpBrasilChain(cert, intermediates);

    return {
      signerName,
      cpfCnpj,
      email,
      issuer: [issuerCN, issuerO].filter(Boolean).join(" · "),
      signedAt,
      notBefore: cert.validity.notBefore.toISOString(),
      notAfter: cert.validity.notAfter.toISOString(),
      isIcpBrasil: looksLikeIcpBrasil(issuerCN, issuerO),
      integrityOk,
      reason: integrityOk
        ? undefined
        : "Hash dos bytes assinados não bate com messageDigest do CMS.",
      chain,
      revocation: "not_checked",
    };
  } catch (err) {
    return {
      integrityOk: false,
      reason: "Falha ao parsear CMS: " + (err as Error).message,
    };
  }
}

export function analyzePdf(buffer: Buffer): PdfAnalysis {
  const hash = sha256(buffer);
  const raws = findRawSignatures(buffer);
  const sigs = raws.map((r) => verifySignature(buffer, r));
  return {
    sha256: hash,
    signaturesFound: raws.length,
    signatures: sigs,
    truststoreConfigured: truststoreSize() > 0,
  };
}
