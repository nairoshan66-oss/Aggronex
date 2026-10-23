import { getStore } from "@netlify/blobs";
import { createHmac, randomInt, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import sharp from "sharp";

const scrypt = promisify(scryptCb);
const users = () => getStore("agronex-users");
const resets = () => getStore("agronex-password-resets");
const COOKIE = "agronex_session";
const RESET_COOKIE = "agronex_reset";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}

async function input(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  return {};
}

function sign(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function unsign(token) {
  if (!token || !process.env.SESSION_SECRET) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", process.env.SESSION_SECRET).update(body).digest();
  let received;
  try { received = Buffer.from(signature, "base64url"); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function getCookie(request, name) {
  const entry = (request.headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

async function getUser(email) {
  return email ? users().get(`user:${email}`, { type: "json" }) : null;
}

async function saveUser(user) {
  await users().setJSON(`user:${user.email}`, user);
}

function otpDigest(otp) {
  return createHmac("sha256", process.env.SESSION_SECRET).update(`otp:${otp}`).digest("hex");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(hash).toString("hex")}`;
}

async function checkPassword(password, stored) {
  if (!stored?.includes(":")) return false;
  const [salt, expectedHex] = stored.split(":");
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sessionCookie(user) {
  const token = sign({ email: user.email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return cookie(COOKIE, token, 7 * 24 * 60 * 60);
}

async function auth(request) {
  const session = unsign(getCookie(request, COOKIE));
  return session ? getUser(session.email) : null;
}

async function handle(request, action) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });

  if (action === "register" && request.method === "POST") {
    const { name = "", email = "", password = "" } = await input(request);
    const cleanEmail = String(email).trim().toLowerCase();
    if (!String(name).trim() || !cleanEmail || String(password).length < 8) return json({ error: "Enter your name, email, and a password of at least 8 characters." }, 400);
    if (await getUser(cleanEmail)) return json({ error: "An account with this email already exists." }, 409);
    const user = { name: String(name).trim(), email: cleanEmail, passwordHash: await hashPassword(String(password)) };
    const { modified } = await users().setJSON(`user:${user.email}`, user, { onlyIfNew: true });
    if (!modified) return json({ error: "An account with this email already exists." }, 409);
    return json({ ok: true }, 201);
  }

  if (action === "login" && request.method === "POST") {
    const { email = "", password = "" } = await input(request);
    const user = await getUser(String(email).trim().toLowerCase());
    if (!user || !(await checkPassword(String(password), user.passwordHash))) return json({ error: "Invalid email or password." }, 401);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(user) });
  }

  if (action === "google-login" && request.method === "POST") {
    const { credential } = await input(request);
    if (!credential || !process.env.GOOGLE_CLIENT_ID) return json({ error: "Google sign-in is not configured." }, 503);
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) return json({ error: "Invalid Google credential." }, 401);
    const profile = await response.json();
    if (profile.aud !== process.env.GOOGLE_CLIENT_ID || profile.email_verified !== "true" || !profile.email) return json({ error: "Google credential validation failed." }, 401);
    const email = profile.email.toLowerCase();
    let user = await getUser(email);
    if (!user) {
      user = { name: profile.name || "Google User", email, passwordHash: await hashPassword(randomBytes(32).toString("hex")) };
      await saveUser(user);
    }
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(user) });
  }

  if (action === "logout") return json({ ok: true }, 200, { "set-cookie": cookie(COOKIE, "", 0) });
  if (action === "me") {
    const user = await auth(request);
    return user ? json({ name: user.name, email: user.email }) : json({ error: "Not signed in" }, 401);
  }

  if (action === "forgot-password" && request.method === "POST") {
    const { email = "" } = await input(request);
    const cleanEmail = String(email).trim().toLowerCase();
    const user = await getUser(cleanEmail);
    // Avoid disclosing whether an address has an account.
    if (!user) return json({ ok: true, message: "If the address is registered, an OTP will be sent." });
    if (!process.env.MAIL_USERNAME || !process.env.MAIL_PASSWORD) return json({ error: "Password reset email is not configured on this site." }, 503);
    const otp = String(randomInt(100000, 1000000));
    await resets().setJSON(`reset:${cleanEmail}`, { otpDigest: otpDigest(otp), expiresAt: Date.now() + 5 * 60 * 1000 });
    const transport = nodemailer.createTransport({ host: process.env.MAIL_SERVER || "smtp.gmail.com", port: Number(process.env.MAIL_PORT || 587), secure: false, auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD } });
    await transport.sendMail({ from: process.env.MAIL_USERNAME, to: cleanEmail, subject: "AgroNex password reset OTP", text: `Your AgroNex password reset OTP is ${otp}. It expires in 5 minutes.` });
    return json({ ok: true, message: "OTP sent if that email is registered." });
  }

  if (action === "verify-otp" && request.method === "POST") {
    const { email = "", otp = "" } = await input(request);
    const cleanEmail = String(email).trim().toLowerCase();
    const record = await resets().get(`reset:${cleanEmail}`, { type: "json" });
    if (!record || record.expiresAt < Date.now() || record.otpDigest !== otpDigest(String(otp).trim())) return json({ error: "Invalid or expired OTP." }, 400);
    await resets().delete(`reset:${cleanEmail}`);
    const resetToken = sign({ email: cleanEmail, purpose: "reset", exp: Date.now() + 10 * 60 * 1000 });
    return json({ ok: true }, 200, { "set-cookie": cookie(RESET_COOKIE, resetToken, 600) });
  }

  if (action === "reset-password" && request.method === "POST") {
    const reset = unsign(getCookie(request, RESET_COOKIE));
    const { password = "" } = await input(request);
    if (!reset || reset.purpose !== "reset") return json({ error: "Verify a valid OTP before resetting your password." }, 401);
    if (String(password).length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    const user = await getUser(reset.email);
    if (!user) return json({ error: "Account not found." }, 404);
    user.passwordHash = await hashPassword(String(password));
    await saveUser(user);
    return json({ ok: true }, 200, { "set-cookie": cookie(RESET_COOKIE, "", 0) });
  }

  if (action === "live-data" && request.method === "GET") {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return json({ temperature: "--", humidity: "--", wind: "--", error: "Weather service is not configured." });
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("appid", key);
    url.searchParams.set("units", "metric");
    if (urlSearch(request, "lat") && urlSearch(request, "lon")) {
      url.searchParams.set("lat", urlSearch(request, "lat")); url.searchParams.set("lon", urlSearch(request, "lon"));
    } else url.searchParams.set("q", "Ahmedabad");
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.main) return json({ temperature: "--", humidity: "--", wind: "--", error: "Weather service request failed." }, 502);
    return json({ temperature: data.main.temp, humidity: data.main.humidity, wind: data.wind?.speed ?? "--" });
  }

  if (action === "analyze-image" && request.method === "POST") {
    const form = await request.formData();
    const file = form.get("image");
    if (!file || typeof file.arrayBuffer !== "function") return json({ error: "No image uploaded." }, 400);
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return json({ error: "Upload an image smaller than 5 MB." }, 400);
    try {
      const { data, info } = await sharp(Buffer.from(await file.arrayBuffer())).resize(100, 100, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let sum = 0;
      for (const channel of data) sum += channel;
      const average = sum / (info.width * info.height * info.channels);
      if (average > 150) return json({ soil: "Sandy", crop: "Groundnut, Millet", fertilizer: "Compost" });
      if (average < 80) return json({ soil: "Clay", crop: "Rice, Wheat", fertilizer: "Organic Matter" });
      return json({ soil: "Loamy", crop: "Vegetables, Wheat", fertilizer: "NPK" });
    } catch { return json({ error: "Invalid image or image processing failed." }, 400); }
  }

  return json({ error: "Not found" }, 404);
}

function urlSearch(request, key) { return new URL(request.url).searchParams.get(key) || ""; }

export default async (request) => {
  try {
    const action = new URL(request.url).pathname.split("/").filter(Boolean).at(-1) || "";
    return await handle(request, action);
  } catch (error) {
    console.error("AgroNex function error", error);
    return json({ error: "The request could not be completed." }, 500);
  }
};

export const config = { path: "/api/*" };
