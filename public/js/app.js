const API_URL = "/api";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const state = {
  currentSection: "dashboard",
  donors: [],
  waivers: [],
  foods: [],
  inspectors: [],
  inspections: [],
  drivers: [],
  trips: [],
  ngos: [],
  claims: [],
  compostBatches: [],
  upcycledProducts: []
};

const sectionLoaders = {
  dashboard: async () => {
    await loadDashboardStats();
  },
  donors: async () => {
    await Promise.all([loadDonors(), loadWaivers()]);
  },
  inventory: async () => {
    await Promise.all([loadDonors(), loadFoodInventory()]);
  },
  inspections: async () => {
    await Promise.all([loadInspectors(), loadFoodInventory(), loadInspections()]);
  },
  logistics: async () => {
    await Promise.all([loadDrivers(), loadFoodInventory(), loadTrips()]);
  },
  ngos: async () => {
    await Promise.all([loadNGOs(), loadFoodInventory(), loadClaims()]);
  },
  compost: async () => {
    await Promise.all([loadFoodInventory(), loadCompostBatches()]);
  },
  upcycled: async () => {
    await Promise.all([loadCompostBatches(), loadUpcycledProducts()]);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindForms();
  bindActions();
  seedDefaultFieldValues();
  switchSection("dashboard");
});

function bindNavigation() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      switchSection(button.dataset.section);
    });
  });
}

function bindForms() {
  const formHandlers = {
    "donor-form": submitDonor,
    "waiver-form": submitWaiver,
    "food-form": submitFood,
    "inspector-form": submitInspector,
    "inspection-form": submitInspection,
    "driver-form": submitDriver,
    "trip-form": submitTrip,
    "ngo-form": submitNGO,
    "claim-form": submitClaim,
    "compost-form": submitCompostBatch,
    "product-form": submitProduct
  };

  Object.entries(formHandlers).forEach(([formId, handler]) => {
    const form = document.getElementById(formId);
    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await handler(form);
      } catch (error) {
        showAlert(error.message, "error");
      }
    });
  });
}

function bindActions() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    try {
      const action = button.dataset.action;
      const id = Number(button.dataset.id);

      if (action === "delete-donor") {
        if (!window.confirm("Delete this donor and any linked records?")) {
          return;
        }

        await api(`/donors/${id}`, { method: "DELETE" });
        showAlert("Donor removed successfully.", "success");
        await Promise.allSettled([
          loadDonors(),
          loadWaivers(),
          loadFoodInventory(),
          loadClaims(),
          loadTrips(),
          loadCompostBatches(),
          loadUpcycledProducts(),
          loadDashboardStats()
        ]);
        return;
      }

      if (action === "delete-food") {
        if (!window.confirm("Delete this food item? Related inspection or compost records may also be removed.")) {
          return;
        }

        await api(`/food-inventory/${id}`, { method: "DELETE" });
        showAlert("Food item removed successfully.", "success");
        await Promise.allSettled([
          loadFoodInventory(),
          loadInspections(),
          loadClaims(),
          loadTrips(),
          loadCompostBatches(),
          loadUpcycledProducts(),
          loadDashboardStats()
        ]);
        return;
      }

      if (action === "set-food-status") {
        await updateFoodStatus(id, button.dataset.status);
      }
    } catch (error) {
      showAlert(error.message, "error");
    }
  });
}

async function switchSection(sectionId) {
  state.currentSection = sectionId;

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });

  document.querySelectorAll(".content-area").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  const loader = sectionLoaders[sectionId];
  if (!loader) {
    return;
  }

  try {
    await loader();
  } catch (error) {
    showAlert(error.message, "error");
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload && typeof payload === "object" && payload.error
      ? payload.error
      : payload || "Request failed";
    throw new Error(message);
  }

  return payload;
}

function jsonRequest(method, payload) {
  return {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  };
}

function showAlert(message, type) {
  const container = document.getElementById("alert-container");
  if (!container) {
    return;
  }

  container.innerHTML = `<div class="alert ${type}">${escapeHtml(message)}</div>`;

  window.clearTimeout(showAlert.timer);
  showAlert.timer = window.setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

function seedDefaultFieldValues() {
  const waiverDate = document.getElementById("waiver-signed-date");
  if (waiverDate && !waiverDate.value) {
    waiverDate.value = toDateInputValue(new Date().toISOString());
  }

  const tripStartTime = document.getElementById("trip-start-time");
  if (tripStartTime && !tripStartTime.value) {
    tripStartTime.value = toLocalDateTimeInputValue(new Date());
  }
}

function getValue(form, name) {
  const field = form.elements.namedItem(name);
  return field ? String(field.value).trim() : "";
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const raw = String(value);
  const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function toLocalDateTimeInputValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "-";
}

function formatDateTime(value) {
  const date = parseDate(value);
  return date
    ? date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
    : "-";
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "--";
  }

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: number % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function formatQuantity(value, unit) {
  return `${formatNumber(value)} ${unit || ""}`.trim();
}

function formatCurrency(value) {
  const number = Number(value);
  return Number.isFinite(number) ? currencyFormatter.format(number) : "--";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusChip(status) {
  const className = status === "Good"
    ? "status-good"
    : status === "Bad"
      ? "status-bad"
      : "status-pending";

  return `<span class="status-chip ${className}">${escapeHtml(status || "Unknown")}</span>`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function fillTableBody(id, rows, colspan, emptyMessage) {
  const body = document.getElementById(id);
  if (!body) {
    return;
  }

  body.innerHTML = rows || `<tr><td colspan="${colspan}" class="empty-note">${escapeHtml(emptyMessage)}</td></tr>`;
}

function populateSelect(selectId, items, config) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }

  const previousValue = select.value;
  const placeholder = items.length > 0 ? config.placeholder : "No options available";
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];

  items.forEach((item) => {
    const value = String(config.value(item));
    const label = config.label(item);
    options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
  });

  select.innerHTML = options.join("");
  select.disabled = items.length === 0;

  if (previousValue && items.some((item) => String(config.value(item)) === previousValue)) {
    select.value = previousValue;
  }
}

async function loadDashboardStats() {
  const stats = await api("/dashboard/stats");

  setText("stat-total-food", formatNumber(stats.totalFood));
  setText("stat-good-food", formatNumber(stats.goodFood));
  setText("stat-bad-food", formatNumber(stats.badFood));
  setText("stat-pending-food", formatNumber(stats.pendingFood));
  setText("stat-ngos-served", formatNumber(stats.ngosServed));
  setText("stat-good-quantity", formatNumber(stats.goodQuantity));
}

async function loadDonors() {
  state.donors = await api("/donors");
  renderDonorsTable();

  populateSelect("waiver-donor-select", state.donors, {
    placeholder: "Select donor",
    value: (donor) => donor.Donor_ID,
    label: (donor) => `${donor.Name} (${donor.Type})`
  });

  populateSelect("food-donor-select", state.donors, {
    placeholder: "Select donor",
    value: (donor) => donor.Donor_ID,
    label: (donor) => `${donor.Name} (${donor.Pincode})`
  });
}

async function loadWaivers() {
  state.waivers = await api("/waivers");
  renderWaiversTable();
}

async function loadFoodInventory() {
  state.foods = await api("/food-inventory");
  renderFoodTable();
  refreshFoodSelects();
}

async function loadInspectors() {
  state.inspectors = await api("/inspectors");
  renderInspectorsTable();

  populateSelect("inspection-inspector-select", state.inspectors, {
    placeholder: "Select inspector",
    value: (inspector) => inspector.Vol_ID,
    label: (inspector) => `${inspector.Name} (${inspector.Certification})`
  });
}

async function loadInspections() {
  state.inspections = await api("/inspections");
  renderInspectionsTable();
}

async function loadDrivers() {
  state.drivers = await api("/drivers");
  renderDriversTable();

  populateSelect("trip-driver-select", state.drivers, {
    placeholder: "Select driver",
    value: (driver) => driver.Vol_ID,
    label: (driver) => `${driver.Name} (${driver.Vehicle_Type})`
  });
}

async function loadTrips() {
  state.trips = await api("/trips");
  renderTripsTable();
}

async function loadNGOs() {
  state.ngos = await api("/ngos");
  renderNGOTable();

  populateSelect("claim-ngo-select", state.ngos, {
    placeholder: "Select NGO",
    value: (ngo) => ngo.NGO_ID,
    label: (ngo) => `${ngo.Name} (${ngo.Capacity})`
  });
}

async function loadClaims() {
  state.claims = await api("/claims");
  renderClaimsTable();
}

async function loadCompostBatches() {
  state.compostBatches = await api("/compost");
  renderCompostTable();

  populateSelect("product-batch-select", state.compostBatches, {
    placeholder: "Select compost batch",
    value: (batch) => batch.Batch_ID,
    label: (batch) => `Batch ${batch.Batch_ID} - ${batch.Food_Name}`
  });

  refreshFoodSelects();
}

async function loadUpcycledProducts() {
  state.upcycledProducts = await api("/upcycled-products");
  renderProductsTable();
}

function refreshFoodSelects() {
  populateSelect("inspection-food-select", state.foods, {
    placeholder: "Select food item",
    value: (food) => food.FID,
    label: (food) => `${food.Name} [${food.Condition_Status}]`
  });

  populateSelect("trip-food-select", state.foods, {
    placeholder: "Optional linked food item",
    value: (food) => food.FID,
    label: (food) => `${food.Name} (${formatQuantity(food.Quantity, food.Unit)})`
  });

  const claimableFoods = state.foods.filter((food) =>
    food.Condition_Status === "Good" && Number(food.Quantity) > 0
  );

  populateSelect("claim-food-select", claimableFoods, {
    placeholder: "Select good food",
    value: (food) => food.FID,
    label: (food) => `${food.Name} (${formatQuantity(food.Quantity, food.Unit)})`
  });

  const compostedFoodIds = new Set(state.compostBatches.map((batch) => String(batch.FID)));
  const compostableFoods = state.foods.filter((food) =>
    food.Condition_Status === "Bad" && !compostedFoodIds.has(String(food.FID))
  );

  populateSelect("compost-food-select", compostableFoods, {
    placeholder: "Select bad food",
    value: (food) => food.FID,
    label: (food) => `${food.Name} (${formatQuantity(food.Quantity, food.Unit)})`
  });
}

function renderDonorsTable() {
  const rows = state.donors.map((donor) => `
    <tr>
      <td>${donor.Donor_ID}</td>
      <td>${escapeHtml(donor.Name)}</td>
      <td>${escapeHtml(donor.Type)}</td>
      <td>${escapeHtml(donor.Pincode)}</td>
      <td>
        <div class="actions">
          <button type="button" class="ghost tiny" data-action="delete-donor" data-id="${donor.Donor_ID}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  fillTableBody("donors-table-body", rows, 5, "No donors available yet.");
}

function renderWaiversTable() {
  const rows = state.waivers.map((waiver) => `
    <tr>
      <td>${waiver.Waiver_ID}</td>
      <td>${formatDate(waiver.Signed_Date)}</td>
      <td>${escapeHtml(waiver.Donor_Name)}</td>
    </tr>
  `).join("");

  fillTableBody("waivers-table-body", rows, 3, "No waivers recorded yet.");
}

function renderFoodTable() {
  const rows = state.foods.map((food) => {
    const statusButtons = ["Good", "Pending", "Bad"].map((status) => `
      <button
        type="button"
        class="${food.Condition_Status === status ? "secondary tiny" : "ghost tiny"}"
        data-action="set-food-status"
        data-id="${food.FID}"
        data-status="${status}"
      >
        ${status}
      </button>
    `).join("");

    return `
      <tr>
        <td>${food.FID}</td>
        <td>${escapeHtml(food.Name)}</td>
        <td>${escapeHtml(food.Donor_Name || "Unknown")}</td>
        <td>${escapeHtml(food.Category)}</td>
        <td>${formatQuantity(food.Quantity, food.Unit)}</td>
        <td>${formatDate(food.Expiry_Date)}</td>
        <td>${statusChip(food.Condition_Status)}</td>
        <td>
          <div class="actions">
            ${statusButtons}
            <button type="button" class="danger tiny" data-action="delete-food" data-id="${food.FID}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  fillTableBody("food-table-body", rows, 8, "No food inventory available yet.");
}

function renderInspectorsTable() {
  const rows = state.inspectors.map((inspector) => `
    <tr>
      <td>${inspector.Vol_ID}</td>
      <td>${escapeHtml(inspector.Name)}</td>
      <td>${escapeHtml(inspector.License_No)}</td>
      <td>${escapeHtml(inspector.Certification)}</td>
    </tr>
  `).join("");

  fillTableBody("inspectors-table-body", rows, 4, "No inspectors registered yet.");
}

function renderInspectionsTable() {
  const rows = state.inspections.map((report) => `
    <tr>
      <td>${formatDate(report.Report_Date)}</td>
      <td>${escapeHtml(report.Inspector_Name)}</td>
      <td>${escapeHtml(report.Food_Name)}</td>
      <td>${formatNumber(report.Quality_Score)}</td>
      <td>${statusChip(report.Condition_Status)}</td>
      <td>${escapeHtml(report.Notes || "-")}</td>
    </tr>
  `).join("");

  fillTableBody("inspections-table-body", rows, 6, "No inspection reports recorded yet.");
}

function renderDriversTable() {
  const rows = state.drivers.map((driver) => `
    <tr>
      <td>${driver.Vol_ID}</td>
      <td>${escapeHtml(driver.Name)}</td>
      <td>${escapeHtml(driver.License_No)}</td>
      <td>${escapeHtml(driver.Vehicle_Type)}</td>
    </tr>
  `).join("");

  fillTableBody("drivers-table-body", rows, 4, "No drivers registered yet.");
}

function renderTripsTable() {
  const rows = state.trips.map((trip) => `
    <tr>
      <td>${trip.Trip_ID}</td>
      <td>${formatDateTime(trip.Start_Time)}</td>
      <td>${escapeHtml(trip.Vehicle_No)}</td>
      <td>${escapeHtml(trip.Driver_Name)} (${escapeHtml(trip.Vehicle_Type)})</td>
      <td>${escapeHtml(trip.Food_Name || "Not linked")}</td>
      <td>${formatNumber(trip.Distance)} km</td>
    </tr>
  `).join("");

  fillTableBody("trips-table-body", rows, 6, "No trips created yet.");
}

function renderNGOTable() {
  const rows = state.ngos.map((ngo) => `
    <tr>
      <td>${ngo.NGO_ID}</td>
      <td>${escapeHtml(ngo.Name)}</td>
      <td>${formatNumber(ngo.Capacity)}</td>
      <td>${escapeHtml(ngo.Type)}</td>
    </tr>
  `).join("");

  fillTableBody("ngos-table-body", rows, 4, "No NGOs registered yet.");
}

function renderClaimsTable() {
  const rows = state.claims.map((claim) => `
    <tr>
      <td>${formatDate(claim.Claim_Date)}</td>
      <td>${escapeHtml(claim.NGO_Name)}</td>
      <td>${escapeHtml(claim.Food_Name)}</td>
      <td>${formatQuantity(claim.Quantity, claim.Unit)}</td>
      <td>${statusChip(claim.Condition_Status)}</td>
    </tr>
  `).join("");

  fillTableBody("claims-table-body", rows, 5, "No claims submitted yet.");
}

function renderCompostTable() {
  const rows = state.compostBatches.map((batch) => `
    <tr>
      <td>${batch.Batch_ID}</td>
      <td>${escapeHtml(batch.Food_Name)}</td>
      <td>${escapeHtml(batch.Process_Type)}</td>
      <td>${formatDate(batch.Start_Date)}</td>
      <td>${formatQuantity(batch.Quantity, batch.Unit)}</td>
    </tr>
  `).join("");

  fillTableBody("compost-table-body", rows, 5, "No compost batches available yet.");
}

function renderProductsTable() {
  const rows = state.upcycledProducts.map((product) => `
    <tr>
      <td>${product.Product_ID}</td>
      <td>${escapeHtml(product.Name)}</td>
      <td>${escapeHtml(product.Food_Source)}</td>
      <td>${escapeHtml(product.Process_Type)}</td>
      <td>${formatCurrency(product.Price)}</td>
      <td>${formatNumber(product.Stock)}</td>
    </tr>
  `).join("");

  fillTableBody("products-table-body", rows, 6, "No upcycled products available yet.");
}

async function submitDonor(form) {
  await api("/donors", jsonRequest("POST", {
    name: getValue(form, "name"),
    type: getValue(form, "type"),
    pincode: getValue(form, "pincode")
  }));

  form.reset();
  showAlert("Donor added successfully.", "success");
  await loadDonors();
}

async function submitWaiver(form) {
  await api("/waivers", jsonRequest("POST", {
    donorId: Number(getValue(form, "donorId")),
    signedDate: getValue(form, "signedDate") || undefined
  }));

  form.reset();
  seedDefaultFieldValues();
  showAlert("Waiver saved successfully.", "success");
  await loadWaivers();
}

async function submitFood(form) {
  await api("/food-inventory", jsonRequest("POST", {
    name: getValue(form, "name"),
    quantity: Number(getValue(form, "quantity")),
    unit: getValue(form, "unit"),
    expiryDate: getValue(form, "expiryDate"),
    category: getValue(form, "category"),
    donorId: Number(getValue(form, "donorId"))
  }));

  form.reset();
  showAlert("Food item added successfully.", "success");
  await Promise.all([loadFoodInventory(), loadDashboardStats()]);
}

async function submitInspector(form) {
  await api("/volunteers/inspector", jsonRequest("POST", {
    name: getValue(form, "name"),
    licenseNo: getValue(form, "licenseNo"),
    certification: getValue(form, "certification")
  }));

  form.reset();
  showAlert("Inspector added successfully.", "success");
  await loadInspectors();
}

async function submitInspection(form) {
  await api("/inspections", jsonRequest("POST", {
    inspectorId: Number(getValue(form, "inspectorId")),
    foodId: Number(getValue(form, "foodId")),
    qualityScore: Number(getValue(form, "qualityScore")),
    notes: getValue(form, "notes")
  }));

  form.reset();
  showAlert("Inspection submitted successfully.", "success");
  await Promise.allSettled([
    loadInspections(),
    loadFoodInventory(),
    loadCompostBatches(),
    loadDashboardStats()
  ]);
}

async function submitDriver(form) {
  await api("/volunteers/driver", jsonRequest("POST", {
    name: getValue(form, "name"),
    licenseNo: getValue(form, "licenseNo"),
    vehicleType: getValue(form, "vehicleType")
  }));

  form.reset();
  showAlert("Driver added successfully.", "success");
  await loadDrivers();
}

async function submitTrip(form) {
  const foodId = getValue(form, "foodId");

  await api("/trips", jsonRequest("POST", {
    vehicleNo: getValue(form, "vehicleNo"),
    startTime: getValue(form, "startTime"),
    distance: Number(getValue(form, "distance") || 0),
    driverId: Number(getValue(form, "driverId")),
    foodId: foodId ? Number(foodId) : null
  }));

  form.reset();
  seedDefaultFieldValues();
  showAlert("Trip created successfully.", "success");
  await loadTrips();
}

async function submitNGO(form) {
  await api("/ngos", jsonRequest("POST", {
    name: getValue(form, "name"),
    capacity: Number(getValue(form, "capacity")),
    type: getValue(form, "type") || "General"
  }));

  form.reset();
  showAlert("NGO added successfully.", "success");
  await loadNGOs();
}

async function submitClaim(form) {
  await api("/claims", jsonRequest("POST", {
    ngoId: Number(getValue(form, "ngoId")),
    foodId: Number(getValue(form, "foodId"))
  }));

  form.reset();
  showAlert("Food claimed successfully.", "success");
  await Promise.allSettled([
    loadClaims(),
    loadFoodInventory(),
    loadDashboardStats()
  ]);
}

async function submitCompostBatch(form) {
  await api("/compost", jsonRequest("POST", {
    foodId: Number(getValue(form, "foodId")),
    processType: getValue(form, "processType")
  }));

  form.reset();
  showAlert("Compost batch created successfully.", "success");
  await Promise.all([loadCompostBatches(), loadFoodInventory()]);
}

async function submitProduct(form) {
  await api("/upcycled-products", jsonRequest("POST", {
    name: getValue(form, "name"),
    price: Number(getValue(form, "price") || 0),
    stock: Number(getValue(form, "stock") || 0),
    batchId: Number(getValue(form, "batchId"))
  }));

  form.reset();
  showAlert("Upcycled product added successfully.", "success");
  await loadUpcycledProducts();
}

async function updateFoodStatus(foodId, nextStatus) {
  const food = state.foods.find((item) => Number(item.FID) === Number(foodId));

  if (!food) {
    throw new Error("Food item is not available in memory. Refresh the inventory section and try again.");
  }

  if (food.Condition_Status === nextStatus) {
    showAlert(`Food is already marked ${nextStatus}.`, "info");
    return;
  }

  await api(`/food-inventory/${foodId}`, jsonRequest("PUT", {
    name: food.Name,
    quantity: Number(food.Quantity),
    unit: food.Unit,
    expiryDate: toDateInputValue(food.Expiry_Date),
    category: food.Category,
    conditionStatus: nextStatus
  }));

  showAlert(`Food status updated to ${nextStatus}.`, "success");
  await Promise.allSettled([
    loadFoodInventory(),
    loadCompostBatches(),
    loadDashboardStats()
  ]);
}
