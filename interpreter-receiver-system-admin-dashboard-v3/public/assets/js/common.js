export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function eventCodeFromUrl() {
  const url = new URL(window.location.href);
  return (url.searchParams.get("event") || localStorage.getItem("receiver_event_code") || "").toUpperCase();
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const pin = sessionStorage.getItem("receiver_staff_pin");
  if (pin) headers.set("x-staff-pin", pin);

  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store"
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { ok: false, error: `HTTP ${response.status}` };
  }

  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }

  return payload;
}

export function setBusy(button, busy, busyText = "Processing...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

export function toast(message, type = "") {
  let stack = qs(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const item = document.createElement("div");
  item.className = `toast ${type}`.trim();
  item.textContent = message;
  stack.appendChild(item);

  window.setTimeout(() => item.remove(), 3600);
}

export function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(options.locale || undefined, {
    year: options.year || "numeric",
    month: options.month || "2-digit",
    day: options.day || "2-digit",
    ...(options.time ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

export function parseQrValue(decodedText) {
  const raw = String(decodedText || "").trim();

  if (/^RECEIVER:/i.test(raw)) {
    return { type: "receiver", value: raw.split(":").slice(1).join(":").trim() };
  }

  const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  if (uuid) return { type: "ticket", value: uuid[0].toLowerCase() };

  if (/^\d{1,6}$/.test(raw)) return { type: "receiver", value: raw };
  return { type: "unknown", value: raw };
}

export function normalizeReceiver(value, digits = 3) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return raw;
  return raw.padStart(digits, "0");
}
