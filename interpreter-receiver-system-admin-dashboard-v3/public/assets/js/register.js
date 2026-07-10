import { api, eventCodeFromUrl, formatDate, qs, setBusy } from "./common.js";

const strings = {
  en: {
    title: "Receiver pre-registration",
    subtitle: "Register in advance and show your QR code at the rental desk.",
    displayLanguage: "Display language",
    memberNo: "8-digit member number",
    fullName: "Full name",
    email: "Email",
    phone: "Phone number",
    interpretationLanguage: "Interpretation language",
    selectLanguage: "Select a language",
    consent: "I agree to return the receiver after the event. I understand that loss or damage may be recorded and may result in a charge.",
    submit: "Create my QR ticket",
    processing: "Creating ticket...",
    loadError: "The event could not be loaded.",
    submitError: "Registration could not be completed."
  }
};

let currentEvent = null;
let language = "en";

function applyLanguage(code) {
  language = strings[code] ? code : "en";
  localStorage.setItem("receiver_ui_language", language);
  document.documentElement.lang = language;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (strings[language][key]) element.textContent = strings[language][key];
  });

  qs("#ui-language").value = language;
}

async function loadEvent() {
  try {
    const code = eventCodeFromUrl();
    const query = code ? `?code=${encodeURIComponent(code)}` : "";
    const payload = await api(`/api/public-event${query}`);
    currentEvent = payload.event;
    localStorage.setItem("receiver_event_code", currentEvent.code);

    qs("#event-name").textContent = currentEvent.name;
    qs("#event-location").textContent = currentEvent.location || "";
    qs("#event-date").textContent = currentEvent.event_date
      ? formatDate(`${currentEvent.event_date}T12:00:00`)
      : "";
  } catch (error) {
    const message = qs("#page-message");
    message.className = "notice danger";
    message.textContent = `${strings[language].loadError} ${error.message}`;
    qs("#registration-form").classList.add("hidden");
    qs("#event-strip").classList.add("hidden");
  }
}

qs("#ui-language").addEventListener("change", (event) => {
  applyLanguage(event.target.value);
});

qs("#member-no").addEventListener("input", (event) => {
  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
});

qs("#registration-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentEvent) return;

  const button = qs("#submit-button");
  setBusy(button, true, strings[language].processing);

  try {
    const payload = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        event_code: currentEvent.code,
        member_no: qs("#member-no").value,
        full_name: qs("#full-name").value,
        email: qs("#email").value,
        phone: qs("#phone").value,
        language: qs("#language").value,
        ui_language: language,
        consent: qs("#consent").checked
      })
    });

    window.location.href = `/ticket?t=${encodeURIComponent(payload.registration.token)}`;
  } catch (error) {
    const message = qs("#page-message");
    message.className = "notice danger";
    message.textContent = `${strings[language].submitError} ${error.message}`;
    message.scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    setBusy(button, false);
  }
});

applyLanguage(language);
loadEvent();
