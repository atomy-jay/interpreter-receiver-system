import { api, formatDate, qs, setBusy } from "./common.js";

const token = new URL(window.location.href).searchParams.get("t");
let ticket = null;

async function loadTicket() {
  const refreshButton = qs("#refresh-ticket");
  if (refreshButton) setBusy(refreshButton, true, "Refreshing...");

  try {
    const payload = await api(`/api/ticket?token=${encodeURIComponent(token || "")}`);
    ticket = payload.ticket;
    renderTicket();
  } catch (error) {
    qs("#ticket-card").classList.add("hidden");
    const box = qs("#ticket-error");
    box.classList.remove("hidden");
    box.textContent = error.message;
  } finally {
    if (refreshButton) setBusy(refreshButton, false);
  }
}

function renderTicket() {
  qs("#ticket-error").classList.add("hidden");
  qs("#ticket-card").classList.remove("hidden");
  qs("#event-name").textContent = ticket.event.name;

  const meta = [
    ticket.event.event_date ? formatDate(`${ticket.event.event_date}T12:00:00`) : "",
    ticket.event.location || ""
  ].filter(Boolean).join(" · ");

  qs("#event-meta").textContent = meta;
  qs("#full-name").textContent = ticket.full_name;
  qs("#member-no").textContent = ticket.member_no;
  qs("#language").textContent = ticket.language;

  const status = qs("#ticket-status");
  const receiverNo = qs("#receiver-no");

  if (!ticket.rental) {
    status.className = "badge available";
    status.textContent = "Pre-registered";
    receiverNo.textContent = "Not assigned yet";
  } else if (ticket.rental.status === "rented") {
    status.className = "badge rented";
    status.textContent = "Receiver collected";
    receiverNo.textContent = ticket.rental.receiver_no;
  } else if (ticket.rental.status === "returned") {
    status.className = "badge returned";
    status.textContent = "Returned";
    receiverNo.textContent = ticket.rental.receiver_no;
  } else {
    status.className = `badge ${ticket.rental.status}`;
    status.textContent = ticket.rental.status;
    receiverNo.textContent = ticket.rental.receiver_no;
  }

  const qrContainer = qs("#qr-code");
  qrContainer.innerHTML = "";

  const qrValue = `${window.location.origin}/ticket?t=${ticket.token}`;
  new QRCode(qrContainer, {
    text: qrValue,
    width: 280,
    height: 280,
    correctLevel: QRCode.CorrectLevel.H
  });
}

qs("#refresh-ticket").addEventListener("click", loadTicket);

qs("#save-qr").addEventListener("click", () => {
  const canvas = qs("#qr-code canvas");
  const image = qs("#qr-code img");
  const href = canvas?.toDataURL("image/png") || image?.src;

  if (!href) return;

  const link = document.createElement("a");
  link.href = href;
  link.download = `receiver-ticket-${ticket?.member_no || "qr"}.png`;
  link.click();
});

loadTicket();
