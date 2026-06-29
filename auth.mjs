// sensic-ad-drafter/auth.mjs
// Self-contained session auth: a login screen validates a shared team password,
// then we issue a signed HttpOnly cookie. Works without Cloudflare Access (which
// remains supported when ACCESS_ENFORCED=true). HMAC via Web Crypto (Workers).

const enc = (s) => new TextEncoder().encode(s);

async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey("raw", enc(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const unb64 = (s) => decodeURIComponent(escape(atob(s)));

// token = base64(email|exp).hexsig
export async function issueSession(secret, email, ttlSec = 43200) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${email}|${exp}`;
  const sig = await hmacHex(secret, payload);
  return `${b64(payload)}.${sig}`;
}

export async function verifySession(secret, token) {
  if (!secret || !token || typeof token !== "string" || !token.includes(".")) return null;
  const [enc64, sig] = token.split(".");
  let payload;
  try { payload = unb64(enc64); } catch { return null; }
  const expSig = await hmacHex(secret, payload);
  if (!timingEq(sig, expSig)) return null;
  const [email, exp] = payload.split("|");
  if (!exp || !/^\d+$/.test(exp) || Date.now() / 1000 > Number(exp)) return null;
  return { email: email || "unknown" };
}

export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

export const SESSION_COOKIE = "sad_session";
export function setCookieHeader(value, ttlSec = 43200) {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlSec}`;
}
export function clearCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
