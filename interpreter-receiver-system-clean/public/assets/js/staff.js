import {
  api,
  escapeHtml,
  eventCodeFromUrl,
  formatDate,
  normalizeReceiver,
  parseQrValue,
  qs,
  qsa,
  setBusy,
  toast
} from "./common.js";

let currentEvent = null;
let selectedRegistration = null;
let selectedReturn = null;
let dashboardData = null;
let dashboardTimer = null;
let memberScanner = null;
let receiverScanner = null;

const storedName = localStorage.getItem("receiver_staff_name") || "";
qs("#staff-name").value = storedName;

function currentEventCode() {
  return currentEvent?.code || eventCodeFromUrl();
}

async function login(event) {
  event.preventDefault();
  const name = qs("#staff-name").value.trim();
  const pin = qs("#staff-pin").value;
  const button = qs("#login-button");

  if (!name || !pin) return;

  sessionStorage.setItem("receiver_staff_pin", pin);
  localStorage.setItem("receiver_staff_name", name);
  setBusy(button, true, "Checking...");

  try {
    await api("/api/staff-auth", { method: "POST", body: "{}" });
    qs("#login-screen").classList.add("hidden");
    qs("#staff-app").classList.remove("hidden");
    qs("#top-staff-name").textContent = name;
    const sidebarName = qs("#sidebar-staff-name");
    if (sidebarName) sidebarName.textContent = name;
    qs("#login-error").classList.add("hidden");
    await loadDashboard(false);
  } catch (error) {
    sessionStorage.removeItem("receiver_staff_pin");
    const box = qs("#login-error");
    box.classList.remove("hidden");
    box.textContent = error.message;
  } finally {
    setBusy(button, false);
  }
}

function logout() {
  sessionStorage.removeItem("receiver_staff_pin");
  location.reload();
}

function staffName() {
  return localStorage.getItem("receiver_staff_name") || "";
}

function switchTab(tab) {
  qsa(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  qsa(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
  qs(`#tab-${tab}`).classList.remove("hidden");

  if (tab === "dashboard") {
    loadDashboard();
    startDashboardTimer();
  } else {
    stopDashboardTimer();
  }

  if (tab === "setup" && currentEvent) fillSetupForm(currentEvent);
}

function setEvent(event) {
  currentEvent = event;
  localStorage.setItem("receiver_event_code", event.code);
  qs("#top-event-name").textContent = event.name;
  qs("#top-event-meta").textContent = [
    event.code,
    event.event_date ? formatDate(`${event.event_date}T12:00:00`) : "",
    event.location || ""
  ].filter(Boolean).join(" · ");
}

async function lookupMember(value = qs("#member-query").value) {
  const query = String(value || "").trim();
  if (!query) {
    toast("Enter a QR token or member number.", "error");
    return;
  }

  const button = qs("#lookup-member");
  setBusy(button, true, "Looking up...");

  try {
    const parsed = parseQrValue(query);
    const body = {
      event_code: currentEventCode(),
      query: parsed.value
    };

    const payload = await api("/api/staff-lookup", {
      method: "POST",
      body: JSON.stringify(body)
    });

    if (!currentEvent) setEvent(payload.event);
    selectedRegistration = payload.registration;
    renderMember(payload);
    qs("#member-query").value = "";
    qs("#rental-receiver-no").focus();
  } catch (error) {
    clearMember();
    toast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

function renderMember(payload) {
  qs("#member-empty").classList.add("hidden");
  qs("#member-panel").classList.remove("hidden");
  qs("#member-name").textContent = payload.registration.full_name;
  qs("#member-meta").textContent = `${payload.registration.member_no} · ${payload.registration.language}`;

  const status = qs("#member-status");
  if (payload.active_rental) {
    status.innerHTML = `
      <div class="notice warning">
        Already rented. Receiver number:
        <strong>${escapeHtml(payload.active_rental.receivers.receiver_no)}</strong>
      </div>`;
    qs("#rent-button").disabled = true;
    qs("#rental-receiver-no").value = payload.active_rental.receivers.receiver_no;
  } else {
    const history = payload.rental_history?.[0];
    status.innerHTML = history
      ? `<div class="notice">Previous rental: ${escapeHtml(history.receivers.receiver_no)} / ${escapeHtml(history.status)}</div>`
      : `<div class="notice success">Available for rental.</div>`;
    qs("#rent-button").disabled = false;
    qs("#rental-receiver-no").value = "";
  }
}

function clearMember() {
  selectedRegistration = null;
  qs("#member-panel").classList.add("hidden");
  qs("#member-empty").classList.remove("hidden");
}

async function rentReceiver() {
  if (!selectedRegistration) return;

  const receiverNo = normalizeReceiver(
    qs("#rental-receiver-no").value,
    currentEvent?.receiver_digits || 3
  );

  if (!receiverNo) {
    toast("Enter a receiver number.", "error");
    return;
  }

  const button = qs("#rent-button");
  setBusy(button, true, "Processing...");

  try {
    const payload = await api("/api/rent", {
      method: "POST",
      body: JSON.stringify({
        event_code: currentEventCode(),
        registration_id: selectedRegistration.id,
        receiver_no: receiverNo,
        staff_name: staffName()
      })
    });

    toast(`${payload.rental.full_name} · ${payload.rental.receiver_no} rental completed`, "success");
    clearMember();
    qs("#member-query").focus();
    await loadDashboard(false);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

async function searchName() {
  const q = qs("#name-search").value.trim();
  if (q.length < 2) {
    toast("Enter at least 2 characters of the name.", "error");
    return;
  }

  const button = qs("#search-name");
  setBusy(button, true, "Searching...");

  try {
    const payload = await api(
      `/api/staff-search?event=${encodeURIComponent(currentEventCode())}&q=${encodeURIComponent(q)}`
    );

    const box = qs("#name-results");
    box.classList.remove("hidden");

    if (!payload.results.length) {
      box.innerHTML = `<div class="notice">No results found.</div>`;
      return;
    }

    box.innerHTML = `
      <table>
        <thead><tr><th>Member number</th><th>Name</th><th>Language</th><th></th></tr></thead>
        <tbody>
          ${payload.results.map((item) => `
            <tr>
              <td>${escapeHtml(item.member_no)}</td>
              <td>${escapeHtml(item.full_name)}</td>
              <td>${escapeHtml(item.language)}</td>
              <td><button class="button ghost select-search-result" data-token="${escapeHtml(item.public_token)}" type="button">Select</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;

    qsa(".select-search-result", box).forEach((item) => {
      item.addEventListener("click", async () => {
        await lookupMember(item.dataset.token);
        box.classList.add("hidden");
      });
    });
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

async function lookupReceiver(value = qs("#return-receiver-no").value) {
  const receiverNo = normalizeReceiver(value, currentEvent?.receiver_digits || 3);
  if (!receiverNo) {
    toast("Enter a receiver number.", "error");
    return;
  }

  const button = qs("#lookup-receiver");
  setBusy(button, true, "Looking up...");

  try {
    const payload = await api("/api/staff-lookup", {
      method: "POST",
      body: JSON.stringify({
        event_code: currentEventCode(),
        receiver_no: receiverNo
      })
    });

    if (!currentEvent) setEvent(payload.event);
    selectedReturn = payload;
    renderReturn(payload);
  } catch (error) {
    clearReturn();
    toast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

function renderReturn(payload) {
  qs("#return-empty").classList.add("hidden");
  qs("#return-panel").classList.remove("hidden");
  qs("#return-receiver-title").textContent = `Receiver ${payload.receiver.receiver_no}`;

  if (payload.rental) {
    const member = payload.rental.registrations;
    qs("#return-member-meta").textContent =
      `${member.full_name} · ${member.member_no} · ${member.language}`;
    qs("#return-status-badge").className = "badge rented";
    qs("#return-status-badge").textContent = "Rented";
    qs("#return-button").disabled = false;
  } else {
    qs("#return-member-meta").textContent = "There is no active rental record.";
    qs("#return-status-badge").className = `badge ${payload.receiver.status}`;
    qs("#return-status-badge").textContent = payload.receiver.status;
    qs("#return-button").disabled = true;
  }

  qs("#return-receiver-no").value = payload.receiver.receiver_no;
}

function clearReturn() {
  selectedReturn = null;
  qs("#return-panel").classList.add("hidden");
  qs("#return-empty").classList.remove("hidden");
  qs("#return-receiver-no").value = "";
  qs("#return-notes").value = "";
  qs("#return-condition").value = "returned";
}

async function completeReturn() {
  if (!selectedReturn?.rental) return;

  const button = qs("#return-button");
  setBusy(button, true, "Processing...");

  try {
    const payload = await api("/api/return", {
      method: "POST",
      body: JSON.stringify({
        event_code: currentEventCode(),
        receiver_no: selectedReturn.receiver.receiver_no,
        return_status: qs("#return-condition").value,
        notes: qs("#return-notes").value,
        staff_name: staffName()
      })
    });

    toast(
      `${payload.return.receiver_no} · ${payload.return.full_name}  return completed`,
      "success"
    );
    clearReturn();
    qs("#return-receiver-no").focus();
    await loadDashboard(false);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

async function loadDashboard(showError = true) {
  try {
    const eventQuery = currentEventCode()
      ? `?event=${encodeURIComponent(currentEventCode())}`
      : "";

    const payload = await api(`/api/dashboard${eventQuery}`);
    dashboardData = payload;
    setEvent(payload.event);
    renderDashboard(payload);
    return payload;
  } catch (error) {
    if (showError) toast(error.message, "error");
    if (error.status === 404) {
      switchTab("setup");
    }
    return null;
  }
}

function renderDashboard(data) {
  qs("#dashboard-updated").textContent = formatDate(data.refreshed_at, { time: true });

  const labels = [
    ["Total receivers", data.summary.total_receivers],
    ["Pre-registered", data.summary.registered],
    ["Rented", data.summary.rented],
    ["Available", data.summary.available],
    ["Returned", data.summary.returned],
    ["Not collected", data.summary.uncollected],
    ["Lost or damaged", data.summary.issues]
  ];

  qs("#metrics").innerHTML = labels.map(([label, value]) => `
    <div class="metric"><span>${label}</span><strong>${value}</strong></div>
  `).join("");

  qs("#language-body").innerHTML = data.languages.length
    ? data.languages.map((row) => `
      <tr>
        <td>${escapeHtml(row.language)}</td>
        <td>${row.registered}</td>
        <td>${row.picked_up}</td>
        <td>${row.active}</td>
        <td>${Math.max(0, row.registered - row.picked_up)}</td>
      </tr>`).join("")
    : emptyRow(5);

  qs("#active-count").textContent = data.active_rentals.length;
  qs("#active-body").innerHTML = data.active_rentals.length
    ? data.active_rentals.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.receivers.receiver_no)}</strong></td>
        <td>${escapeHtml(row.registrations.full_name)}<br><span class="small muted">${escapeHtml(row.registrations.member_no)}</span></td>
        <td>${escapeHtml(row.registrations.language)}</td>
        <td>${formatDate(row.rented_at, { time: true })}</td>
      </tr>`).join("")
    : emptyRow(4);

  qs("#uncollected-body").innerHTML = data.uncollected.length
    ? data.uncollected.map((row) => `
      <tr>
        <td>${escapeHtml(row.member_no)}</td>
        <td>${escapeHtml(row.full_name)}</td>
        <td>${escapeHtml(row.language)}</td>
      </tr>`).join("")
    : emptyRow(3);

  qs("#recent-body").innerHTML = data.recent.length
    ? data.recent.map((row) => {
      const time = row.returned_at || row.rented_at;
      const label = row.status === "rented" ? "Rental" :
        row.status === "returned" ? "Return" : row.status;
      return `
        <tr>
          <td><span class="badge ${escapeHtml(row.status)}">${escapeHtml(label)}</span></td>
          <td>${escapeHtml(row.receivers.receiver_no)}</td>
          <td>${escapeHtml(row.registrations.full_name)}</td>
          <td>${formatDate(time, { time: true })}</td>
        </tr>`;
    }).join("")
    : emptyRow(4);

  renderReceiverGrid();
}

function emptyRow(columns) {
  return `<tr><td colspan="${columns}" class="muted">No records to display.</td></tr>`;
}

function renderReceiverGrid() {
  if (!dashboardData) return;
  const filter = qs("#receiver-filter").value;

  const rows = dashboardData.receivers.filter((receiver) => {
    if (filter === "all") return true;
    if (filter === "issue") return ["maintenance", "damaged", "lost"].includes(receiver.status);
    return receiver.status === filter;
  });

  qs("#receiver-grid").innerHTML = rows.map((receiver) => `
    <button class="receiver-chip ${escapeHtml(receiver.status)}" data-receiver-id="${escapeHtml(receiver.id)}" type="button">
      <strong>${escapeHtml(receiver.receiver_no)}</strong>
      <small>${receiver.active_rental ? escapeHtml(receiver.active_rental.full_name) : escapeHtml(receiver.status)}</small>
    </button>
  `).join("");

  qsa(".receiver-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const receiver = dashboardData.receivers.find((item) => item.id === chip.dataset.receiverId);
      showReceiverModal(receiver);
    });
  });
}

function showReceiverModal(receiver) {
  if (!receiver) return;
  qs("#modal-title").textContent = `Receiver ${receiver.receiver_no}`;

  qs("#modal-content").innerHTML = receiver.active_rental
    ? `
      <div class="member-panel">
        <span class="badge rented">Rented</span>
        <div class="member-name">${escapeHtml(receiver.active_rental.full_name)}</div>
        <div class="muted">${escapeHtml(receiver.active_rental.member_no)} · ${escapeHtml(receiver.active_rental.language)}</div>
        <div>Rental time: ${formatDate(receiver.active_rental.rented_at, { time: true })}</div>
      </div>`
    : `
      <div class="member-panel">
        <span class="badge ${escapeHtml(receiver.status)}">${escapeHtml(receiver.status)}</span>
        <div class="muted">There is no current renter.</div>
      </div>`;

  qs("#receiver-modal").classList.remove("hidden");
}

function startDashboardTimer() {
  stopDashboardTimer();
  dashboardTimer = window.setInterval(() => loadDashboard(false), 5000);
}

function stopDashboardTimer() {
  if (dashboardTimer) {
    window.clearInterval(dashboardTimer);
    dashboardTimer = null;
  }
}

async function setupEvent(event) {
  event.preventDefault();
  const button = qs("#setup-button");
  setBusy(button, true, "Saving...");

  try {
    const payload = await api("/api/setup-event", {
      method: "POST",
      body: JSON.stringify({
        code: qs("#setup-code").value,
        name: qs("#setup-name").value,
        event_date: qs("#setup-date").value || null,
        location: qs("#setup-location").value,
        receiver_start: Number(qs("#setup-start").value),
        receiver_end: Number(qs("#setup-end").value),
        receiver_digits: Number(qs("#setup-digits").value),
        registration_open: qs("#setup-open").checked
      })
    });

    setEvent(payload.event);
    const registrationUrl = `${location.origin}/register?event=${encodeURIComponent(payload.event.code)}`;
    const result = qs("#setup-result");
    result.classList.remove("hidden");
    result.innerHTML = `
      Saved successfully<br>
      Member registration URL: <a href="${registrationUrl}" target="_blank" rel="noopener">${escapeHtml(registrationUrl)}</a>
    `;
    toast("Event settings have been saved.", "success");
    await loadDashboard(false);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

function fillSetupForm(event) {
  qs("#setup-code").value = event.code || "";
  qs("#setup-name").value = event.name || "";
  qs("#setup-date").value = event.event_date || "";
  qs("#setup-location").value = event.location || "";
  qs("#setup-digits").value = String(event.receiver_digits || 3);
  qs("#setup-open").checked = event.registration_open !== false;
}

function exportUncollected() {
  if (!dashboardData) return;
  const rows = [
    ["member_no", "full_name", "language"],
    ...dashboardData.uncollected.map((item) => [
      item.member_no,
      item.full_name,
      item.language
    ])
  ];

  const csv = rows.map((row) =>
    row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
  ).join("\r\n");

  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentEventCode() || "event"}-uncollected.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function startScanner(kind) {
  const isMember = kind === "member";
  const elementId = isMember ? "member-scanner" : "receiver-scanner";
  const existing = isMember ? memberScanner : receiverScanner;

  if (existing) {
    try { await existing.clear(); } catch {}
    if (isMember) memberScanner = null;
    else receiverScanner = null;
    qs(`#${elementId}`).innerHTML = "";
    return;
  }

  const scanner = new Html5QrcodeScanner(
    elementId,
    {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [
        Html5QrcodeScanType.SCAN_TYPE_CAMERA,
        Html5QrcodeScanType.SCAN_TYPE_FILE
      ]
    },
    false
  );

  if (isMember) memberScanner = scanner;
  else receiverScanner = scanner;

  scanner.render(async (decodedText) => {
    const parsed = parseQrValue(decodedText);

    try { await scanner.clear(); } catch {}
    qs(`#${elementId}`).innerHTML = "";
    if (isMember) memberScanner = null;
    else receiverScanner = null;

    if (isMember) {
      qs("#member-query").value = parsed.value;
      await lookupMember(parsed.value);
    } else {
      const value = parsed.type === "receiver" ? parsed.value : decodedText;
      qs("#return-receiver-no").value = value;
      await lookupReceiver(value);
    }
  }, () => {});
}

qs("#login-form").addEventListener("submit", login);
qs("#logout-button").addEventListener("click", logout);

qsa(".tab-button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

qs("#lookup-member").addEventListener("click", () => lookupMember());
qs("#member-query").addEventListener("keydown", (event) => {
  if (event.key === "Enter") lookupMember();
});
qs("#scan-member").addEventListener("click", () => startScanner("member"));
qs("#rent-button").addEventListener("click", rentReceiver);
qs("#search-name").addEventListener("click", searchName);
qs("#name-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchName();
});

qs("#lookup-receiver").addEventListener("click", () => lookupReceiver());
qs("#return-receiver-no").addEventListener("keydown", (event) => {
  if (event.key === "Enter") lookupReceiver();
});
qs("#scan-receiver").addEventListener("click", () => startScanner("receiver"));
qs("#return-button").addEventListener("click", completeReturn);

qs("#refresh-dashboard").addEventListener("click", () => loadDashboard());
qs("#receiver-filter").addEventListener("change", renderReceiverGrid);
qs("#export-uncollected").addEventListener("click", exportUncollected);
qs("#setup-form").addEventListener("submit", setupEvent);
qs("#close-modal").addEventListener("click", () => qs("#receiver-modal").classList.add("hidden"));
qs("#receiver-modal").addEventListener("click", (event) => {
  if (event.target === qs("#receiver-modal")) qs("#receiver-modal").classList.add("hidden");
});

if (sessionStorage.getItem("receiver_staff_pin") && storedName) {
  api("/api/staff-auth", { method: "POST", body: "{}" })
    .then(async () => {
      qs("#login-screen").classList.add("hidden");
      qs("#staff-app").classList.remove("hidden");
      qs("#top-staff-name").textContent = storedName;
      await loadDashboard(false);
    })
    .catch(() => sessionStorage.removeItem("receiver_staff_pin"));
}


const mobileMenu = qs("#mobile-menu");
if (mobileMenu) {
  mobileMenu.addEventListener("click", () => qs("#staff-app").classList.toggle("menu-open"));
}

const topSync = qs("#top-sync");
if (topSync) {
  topSync.addEventListener("click", () => loadDashboard());
}

qsa(".admin-sidebar .tab-button").forEach((button) => {
  button.addEventListener("click", () => qs("#staff-app").classList.remove("menu-open"));
});
