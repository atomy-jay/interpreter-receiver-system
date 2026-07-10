import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

let cachedClient;

export function getSupabase() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  return cachedClient;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error) {
  console.error(error);

  if (error instanceof HttpError) {
    return json({ ok: false, error: error.message, details: error.details }, error.status);
  }

  const message = error?.message || "Unexpected server error";
  const known = [
    "already has an active receiver",
    "Receiver is not available",
    "Receiver number not found",
    "not currently rented",
    "Registration not found",
    "Invalid return status"
  ].some((text) => message.includes(text));

  return json(
    { ok: false, error: known ? message : "Unexpected server error" },
    known ? 409 : 500
  );
}

export function requireMethod(request, allowed) {
  const methods = Array.isArray(allowed) ? allowed : [allowed];
  if (!methods.includes(request.method)) {
    throw new HttpError(405, "Method not allowed");
  }
}

export function requireStaff(request) {
  const expected = process.env.STAFF_PIN || "";
  const provided = request.headers.get("x-staff-pin") || "";

  if (!expected || !safeEqual(expected, provided)) {
    throw new HttpError(401, "Invalid staff PIN");
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function cleanText(value, max = 200) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

export function normalizeMemberNo(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 12);
}

export function parseToken(value) {
  const raw = cleanText(value, 1000);
  if (!raw) return "";

  const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return uuid ? uuid[0].toLowerCase() : raw;
}

export async function findEvent(supabase, eventCode, options = {}) {
  const allowClosed = options.allowClosed === true;
  let query = supabase
    .from("events")
    .select("*")
    .eq("active", true);

  if (eventCode) {
    query = query.eq("code", cleanText(eventCode, 50).toUpperCase());
  } else {
    query = query.order("event_date", { ascending: false, nullsFirst: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Active event not found");
  if (!allowClosed && !data.registration_open) {
    throw new HttpError(403, "Registration is closed");
  }

  return data;
}

export function baseUrl(request) {
  const configured = process.env.URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
