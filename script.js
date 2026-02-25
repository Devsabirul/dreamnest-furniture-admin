/**
 * DoorCraft Studio — Admin Dashboard
 * Firebase v9 Modular SDK
 *
 * IMPORTANT: Replace the firebaseConfig below with YOUR project's credentials.
 * Enable Authentication (Email/Password) and Firestore in Firebase Console.
 * Add a custom claim OR a Firestore "admins" collection with the user's UID.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
//  FIREBASE CONFIG — REPLACE WITH YOUR OWN
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAJckKQhu0_82Ps6PkqgQDv2S5yFrKCTe0",
  authDomain: "dreamnest-furniture.firebaseapp.com",
  databaseURL: "https://dreamnest-furniture-default-rtdb.firebaseio.com",
  projectId: "dreamnest-furniture",
  storageBucket: "dreamnest-furniture.firebasestorage.app",
  messagingSenderId: "225776215646",
  appId: "1:225776215646:web:521bdf47c7b961f65936cf",
  measurementId: "G-KX98EXGWKV",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
//  HELPERS
// ============================================================

/** Format rupee currency */
const rupee = (n) => "৳" + Number(n || 0).toLocaleString("en-IN");

/** Format Firestore timestamp or JS date to readable string */
const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Get status badge HTML */
const statusBadge = (status) => {
  const map = {
    Pending: "badge-pending",
    "In Production": "badge-production",
    Completed: "badge-completed",
    Delivered: "badge-delivered",
  };
  return `<span class="badge ${map[status] || "badge-pending"}">${status || "Pending"}</span>`;
};

/** Empty state HTML */
const emptyRow = (cols, msg = "No records found") =>
  `<tr><td colspan="${cols}" style="padding:40px;text-align:center;color:#94a3b8">${msg}</td></tr>`;

// ============================================================
//  TOAST
// ============================================================
let toastTimer;
window.showToast = function (msg, type = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.className = "toast";
  }, 3500);
};

// ============================================================
//  MODAL HELPERS
// ============================================================
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
};
window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
};
window.closeModalOutside = function (e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
};

// ============================================================
//  SIDEBAR
// ============================================================
window.openSidebar = function () {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarOverlay").classList.add("visible");
};
window.closeSidebar = function () {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("visible");
};

// ============================================================
//  NAVIGATION
// ============================================================
window.navigate = function (e, page) {
  e.preventDefault();
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelector(`[data-page="${page}"]`).classList.add("active");
  document.getElementById("pageTitle").textContent = {
    overview: "Overview",
    customers: "Customers",
    workers: "Workers",
    transactions: "Transactions",
    reports: "Reports",
  }[page];
  closeSidebar();
  if (page === "reports") loadReports();
};

// ============================================================
//  PASSWORD TOGGLE
// ============================================================
window.togglePassword = function () {
  const inp = document.getElementById("loginPassword");
  inp.type = inp.type === "password" ? "text" : "password";
};

// ============================================================
//  CALC DUE (inline auto-calc)
// ============================================================
window.calcDue = function (form) {
  const total = parseFloat(form.elements.total_amount?.value) || 0;
  const advance = parseFloat(form.elements.advance_amount?.value) || 0;
  if (form.elements.due_amount)
    form.elements.due_amount.value = Math.max(0, total - advance);
};

// ============================================================
//  PAGE LOADER
// ============================================================
const showLoader = () =>
  document.getElementById("pageLoader")?.classList.remove("hidden");
const hideLoader = () =>
  document.getElementById("pageLoader")?.classList.add("hidden");

// ============================================================
//  DATE
// ============================================================
function setDate() {
  const el = document.getElementById("topbarDate");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ============================================================
//  AUTH — LOGIN PAGE
// ============================================================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    const text = document.getElementById("loginBtnText");
    const spinner = document.getElementById("loginSpinner");
    text.classList.add("hidden");
    spinner.classList.remove("hidden");
    btn.disabled = true;

    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPassword").value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will redirect
    } catch (err) {
      showToast("Invalid credentials. Please try again.", "error");
      text.classList.remove("hidden");
      spinner.classList.add("hidden");
      btn.disabled = false;
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
  });
}

// ============================================================
//  AUTH — DASHBOARD PROTECTION
// ============================================================
if (document.getElementById("page-overview")) {
  showLoader();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    // Set user info
    const email = user.email || "Admin";
    const name = email.split("@")[0];
    if (document.getElementById("userName"))
      document.getElementById("userName").textContent = name;
    if (document.getElementById("userAvatar"))
      document.getElementById("userAvatar").textContent = name[0].toUpperCase();
    setDate();
    initDashboard();
    hideLoader();
  });
}

// ============================================================
//  LOGOUT
// ============================================================
window.handleLogout = async function () {
  await signOut(auth);
  window.location.href = "index.html";
};

// ============================================================
//  DATA STORES (in-memory caches for filtering)
// ============================================================
let allCustomers = [];
let allWorkers = [];
let allTransactions = [];
let allCustomerPayments = [];
let allWorkerPayments = [];

// ============================================================
//  INIT DASHBOARD — Set up all real-time listeners
// ============================================================
function initDashboard() {
  listenCustomers();
  listenWorkers();
  listenCustomerPayments();
  listenWorkerPayments();
  listenTransactions();
  populateReportYears();
}

// ============================================================
//  CUSTOMERS — Real-time listener
// ============================================================
function listenCustomers() {
  const q = query(collection(db, "customers"), orderBy("created_at", "desc"));
  onSnapshot(
    q,
    (snap) => {
      allCustomers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCustomersTable(allCustomers);
      updateOverviewStats();
      renderDueCustomers();
    },
    (err) => showToast("Error loading customers: " + err.message, "error"),
  );
}

// ============================================================
//  CUSTOMER PAYMENTS — Real-time listener
// ============================================================
function listenCustomerPayments() {
  const q = query(collection(db, "customerPayments"), orderBy("date", "desc"));
  onSnapshot(
    q,
    (snap) => {
      allCustomerPayments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateOverviewStats();
      renderRecentCustomerPayments();
    },
    (err) => console.error(err),
  );
}

// ============================================================
//  WORKERS — Real-time listener
// ============================================================
function listenWorkers() {
  const q = query(collection(db, "workers"), orderBy("created_at", "desc"));
  onSnapshot(
    q,
    (snap) => {
      allWorkers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderWorkersTable(allWorkers);
    },
    (err) => showToast("Error loading workers: " + err.message, "error"),
  );
}

// ============================================================
//  WORKER PAYMENTS — Real-time listener
// ============================================================
function listenWorkerPayments() {
  const q = query(
    collection(db, "workerPayments"),
    orderBy("payment_date", "desc"),
  );
  onSnapshot(
    q,
    (snap) => {
      allWorkerPayments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateOverviewStats();
      renderRecentWorkerPayments();
    },
    (err) => console.error(err),
  );
}

// ============================================================
//  TRANSACTIONS — Real-time listener
// ============================================================
function listenTransactions() {
  const q = query(
    collection(db, "transactions"),
    orderBy("created_at", "desc"),
  );
  onSnapshot(
    q,
    (snap) => {
      allTransactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTransactionsTable(allTransactions);
    },
    (err) => console.error(err),
  );
}

// ============================================================
//  OVERVIEW STATS
// ============================================================
function updateOverviewStats() {
  const totalOrders = allCustomers.length;
  const totalIncome = allCustomerPayments.reduce(
    (s, p) => s + (p.amount || 0),
    0,
  );
  const totalExpenses = allWorkerPayments.reduce(
    (s, p) => s + (p.amount || 0),
    0,
  );
  const netProfit = totalIncome - totalExpenses;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("totalOrders", totalOrders);
  set("totalIncome", rupee(totalIncome));
  set("totalExpenses", rupee(totalExpenses));
  const profitEl = document.getElementById("netProfit");
  if (profitEl) {
    profitEl.textContent = rupee(netProfit);
    profitEl.style.color = netProfit >= 0 ? "var(--green)" : "var(--red)";
  }
}

// ============================================================
//  RECENT PAYMENTS
// ============================================================
async function renderRecentCustomerPayments() {
  const tbody = document.getElementById("recentCustomerPayments");
  if (!tbody) return;
  const recent = allCustomerPayments.slice(0, 8);
  if (!recent.length) {
    tbody.innerHTML = emptyRow(4, "No payments yet");
    return;
  }
  // Resolve customer names
  const nameMap = {};
  allCustomers.forEach((c) => (nameMap[c.id] = c.name));
  tbody.innerHTML = recent
    .map(
      (p) => `
    <tr>
      <td>${nameMap[p.customer_id] || p.customer_id || "—"}</td>
      <td>${rupee(p.amount)}</td>
      <td><span class="badge badge-income">${p.payment_type}</span></td>
      <td>${fmtDate(p.date)}</td>
    </tr>`,
    )
    .join("");
}

async function renderRecentWorkerPayments() {
  const tbody = document.getElementById("recentWorkerPayments");
  if (!tbody) return;
  const recent = allWorkerPayments.slice(0, 8);
  if (!recent.length) {
    tbody.innerHTML = emptyRow(4, "No payments yet");
    return;
  }
  const nameMap = {};
  allWorkers.forEach((w) => (nameMap[w.id] = w.name));
  tbody.innerHTML = recent
    .map(
      (p) => `
    <tr>
      <td>${nameMap[p.worker_id] || "—"}</td>
      <td>${rupee(p.amount)}</td>
      <td>${p.payment_reason}</td>
      <td>${fmtDate(p.payment_date)}</td>
    </tr>`,
    )
    .join("");
}

// ============================================================
//  DUE CUSTOMERS
// ============================================================
function renderDueCustomers() {
  const tbody = document.getElementById("dueCustomers");
  if (!tbody) return;
  const due = allCustomers.filter((c) => (c.due_amount || 0) > 0);
  if (!due.length) {
    tbody.innerHTML = emptyRow(6, "No due customers 🎉");
    return;
  }
  tbody.innerHTML = due
    .map(
      (c) => `
    <tr class="due-row">
      <td><strong>${c.name}</strong></td>
      <td>${c.phone || "—"}</td>
      <td>${rupee(c.total_amount)}</td>
      <td>${rupee(c.advance_amount)}</td>
      <td><span class="badge badge-due">${rupee(c.due_amount)}</span></td>
      <td>${statusBadge(c.status)}</td>
    </tr>`,
    )
    .join("");
}

// ============================================================
//  CUSTOMERS TABLE
// ============================================================
function renderCustomersTable(customers) {
  const tbody = document.getElementById("customersTable");
  if (!tbody) return;
  if (!customers.length) {
    tbody.innerHTML = emptyRow(7, "No customers yet");
    return;
  }
  tbody.innerHTML = customers
    .map(
      (c) => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone || "—"}</td>
      <td>${rupee(c.total_amount)}</td>
      <td>${rupee(c.advance_amount)}</td>
      <td>${(c.due_amount || 0) > 0 ? `<span class="badge badge-due">${rupee(c.due_amount)}</span>` : rupee(0)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>
        <div class="actions-group">
          <button class="btn-icon" title="View" onclick="viewCustomer('${c.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn-icon" title="Add Payment" onclick="openCustomerPayment('${c.id}','${c.name}')" style="color:var(--green)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="btn-icon" title="Edit" onclick="editCustomer('${c.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon red" title="Delete" onclick="confirmDelete('customer','${c.id}','${c.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </td>
    </tr>`,
    )
    .join("");
}

// ============================================================
//  FILTER CUSTOMERS
// ============================================================
window.filterCustomers = function () {
  const search = (
    document.getElementById("customerSearch")?.value || ""
  ).toLowerCase();
  const status = document.getElementById("customerStatusFilter")?.value || "";
  let filtered = allCustomers.filter((c) => {
    const matchSearch =
      !search ||
      c.name?.toLowerCase().includes(search) ||
      c.phone?.includes(search);
    const matchStatus = !status || c.status === status;
    return matchSearch && matchStatus;
  });
  renderCustomersTable(filtered);
};

// ============================================================
//  ADD CUSTOMER
// ============================================================
window.submitAddCustomer = async function (e) {
  e.preventDefault();
  const f = e.target;
  try {
    const total = parseFloat(f.total_amount.value) || 0;
    const advance = parseFloat(f.advance_amount.value) || 0;
    const data = {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      address: f.address.value.trim(),
      design_details: f.design_details.value.trim(),
      total_amount: total,
      advance_amount: advance,
      due_amount: Math.max(0, total - advance),
      status: f.status.value,
      created_at: serverTimestamp(),
    };
    await addDoc(collection(db, "customers"), data);
    // If advance > 0, auto-add payment
    if (advance > 0) {
      const cSnap = await getDocs(
        query(collection(db, "customers"), where("phone", "==", data.phone)),
      );
      // We'll add payment from openCustomerPayment flow manually
    }
    showToast("Customer added successfully!");
    closeModal("addCustomerModal");
    f.reset();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ============================================================
//  EDIT CUSTOMER
// ============================================================
window.editCustomer = function (id) {
  const c = allCustomers.find((x) => x.id === id);
  if (!c) return;
  const f = document.getElementById("editCustomerForm");
  f.elements.id.value = id;
  f.elements.name.value = c.name || "";
  f.elements.phone.value = c.phone || "";
  f.elements.address.value = c.address || "";
  f.elements.design_details.value = c.design_details || "";
  f.elements.total_amount.value = c.total_amount || 0;
  f.elements.advance_amount.value = c.advance_amount || 0;
  f.elements.due_amount.value = c.due_amount || 0;
  f.elements.status.value = c.status || "Pending";
  openModal("editCustomerModal");
};

window.submitEditCustomer = async function (e) {
  e.preventDefault();
  const f = e.target;
  const id = f.elements.id.value;
  try {
    const total = parseFloat(f.total_amount.value) || 0;
    const advance = parseFloat(f.advance_amount.value) || 0;
    await updateDoc(doc(db, "customers", id), {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      address: f.address.value.trim(),
      design_details: f.design_details.value.trim(),
      total_amount: total,
      advance_amount: advance,
      due_amount: Math.max(0, total - advance),
      status: f.status.value,
    });
    showToast("Customer updated!");
    closeModal("editCustomerModal");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ============================================================
//  VIEW CUSTOMER
// ============================================================
window.viewCustomer = function (id) {
  const c = allCustomers.find((x) => x.id === id);
  if (!c) return;
  document.getElementById("viewCustomerContent").innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><label>Name</label><p>${c.name}</p></div>
      <div class="detail-item"><label>Phone</label><p>${c.phone || "—"}</p></div>
      <div class="detail-item"><label>Address</label><p>${c.address || "—"}</p></div>
      <div class="detail-item"><label>Status</label><p>${statusBadge(c.status)}</p></div>
      <div class="detail-item"><label>Total Amount</label><p>${rupee(c.total_amount)}</p></div>
      <div class="detail-item"><label>Advance Paid</label><p>${rupee(c.advance_amount)}</p></div>
      <div class="detail-item"><label>Due Amount</label><p style="color:${(c.due_amount || 0) > 0 ? "var(--red)" : "var(--green)"}">${rupee(c.due_amount)}</p></div>
      <div class="detail-item"><label>Created At</label><p>${fmtDate(c.created_at)}</p></div>
    </div>
    ${c.design_details ? `<div style="margin-top:16px"><div class="detail-item"><label>Design Details</label><p style="white-space:pre-wrap">${c.design_details}</p></div></div>` : ""}
  `;
  openModal("viewCustomerModal");
};

// ============================================================
//  CUSTOMER PAYMENT
// ============================================================
window.openCustomerPayment = function (id, name) {
  const f = document.getElementById("addCustomerPaymentForm");
  f.elements.customer_id.value = id;
  f.elements.customer_name.value = name;
  f.elements.date.value = new Date().toISOString().split("T")[0];
  openModal("addCustomerPaymentModal");
};

window.submitCustomerPayment = async function (e) {
  e.preventDefault();
  const f = e.target;
  const cid = f.elements.customer_id.value;
  const amount = parseFloat(f.elements.amount.value) || 0;
  const paymentType = f.elements.payment_type.value;
  const dateVal = f.elements.date.value;
  try {
    const ts = Timestamp.fromDate(new Date(dateVal));
    // Add to customerPayments
    await addDoc(collection(db, "customerPayments"), {
      customer_id: cid,
      amount,
      payment_type: paymentType,
      date: ts,
    });
    // Add to transactions
    await addDoc(collection(db, "transactions"), {
      type: "income",
      reference_id: cid,
      amount,
      created_at: ts,
    });
    // Update customer advance & due
    const c = allCustomers.find((x) => x.id === cid);
    if (c) {
      const newAdvance = (c.advance_amount || 0) + amount;
      const newDue = Math.max(0, (c.total_amount || 0) - newAdvance);
      await updateDoc(doc(db, "customers", cid), {
        advance_amount: newAdvance,
        due_amount: newDue,
      });
    }
    showToast("Payment recorded!");
    closeModal("addCustomerPaymentModal");
    f.reset();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ============================================================
//  WORKERS TABLE
// ============================================================
function renderWorkersTable(workers) {
  const tbody = document.getElementById("workersTable");
  if (!tbody) return;
  if (!workers.length) {
    tbody.innerHTML = emptyRow(5, "No workers added yet");
    return;
  }
  tbody.innerHTML = workers
    .map(
      (w) => `
    <tr>
      <td><strong>${w.name}</strong></td>
      <td>${w.phone || "—"}</td>
      <td>${w.role || "—"}</td>
      <td>${w.salary_type || "—"}</td>
      <td>
        <div class="actions-group">
          <button class="btn-icon green" title="Add Payment" onclick="openWorkerPayment('${w.id}','${w.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </button>
          <button class="btn-icon" title="Payment History" onclick="viewWorkerHistory('${w.id}','${w.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </button>
          <button class="btn-icon" title="Edit" onclick="editWorker('${w.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon red" title="Delete" onclick="confirmDelete('worker','${w.id}','${w.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>`,
    )
    .join("");
}

window.filterWorkers = function () {
  const s = (
    document.getElementById("workerSearch")?.value || ""
  ).toLowerCase();
  renderWorkersTable(
    allWorkers.filter(
      (w) =>
        !s ||
        w.name?.toLowerCase().includes(s) ||
        w.role?.toLowerCase().includes(s),
    ),
  );
};

// ============================================================
//  ADD WORKER
// ============================================================
window.submitAddWorker = async function (e) {
  e.preventDefault();
  const f = e.target;
  try {
    await addDoc(collection(db, "workers"), {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      address: f.address.value.trim(),
      role: f.role.value.trim(),
      salary_type: f.salary_type.value,
      created_at: serverTimestamp(),
    });
    showToast("Worker added!");
    closeModal("addWorkerModal");
    f.reset();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ============================================================
//  EDIT WORKER
// ============================================================
window.editWorker = function (id) {
  const w = allWorkers.find((x) => x.id === id);
  if (!w) return;
  const f = document.getElementById("editWorkerForm");
  f.elements.id.value = id;
  f.elements.name.value = w.name || "";
  f.elements.phone.value = w.phone || "";
  f.elements.address.value = w.address || "";
  f.elements.role.value = w.role || "";
  f.elements.salary_type.value = w.salary_type || "Monthly";
  openModal("editWorkerModal");
};

window.submitEditWorker = async function (e) {
  e.preventDefault();
  const f = e.target;
  try {
    await updateDoc(doc(db, "workers", f.elements.id.value), {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      address: f.address.value.trim(),
      role: f.role.value.trim(),
      salary_type: f.salary_type.value,
    });
    showToast("Worker updated!");
    closeModal("editWorkerModal");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ============================================================
//  WORKER PAYMENT
// ============================================================
window.openWorkerPayment = function (id, name) {
  const f = document.getElementById("addWorkerPaymentForm");
  f.elements.worker_id.value = id;
  f.elements.worker_name.value = name;
  f.elements.payment_date.value = new Date().toISOString().split("T")[0];
  openModal("addWorkerPaymentModal");
};

window.submitWorkerPayment = async function (e) {
  e.preventDefault();
  const f = e.target;
  const wid = f.elements.worker_id.value;
  const amount = parseFloat(f.elements.amount.value) || 0;
  const reason = f.elements.payment_reason.value;
  const dateVal = f.elements.payment_date.value;
  try {
    const ts = Timestamp.fromDate(new Date(dateVal));
    await addDoc(collection(db, "workerPayments"), {
      worker_id: wid,
      amount,
      payment_reason: reason,
      payment_date: ts,
    });
    await addDoc(collection(db, "transactions"), {
      type: "expense",
      reference_id: wid,
      amount,
      created_at: ts,
    });
    showToast("Worker payment recorded!");
    closeModal("addWorkerPaymentModal");
    f.reset();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ============================================================
//  WORKER PAYMENT HISTORY
// ============================================================
window.viewWorkerHistory = async function (id, name) {
  document.getElementById("workerHistoryTitle").textContent =
    `${name} — Payment History`;
  const tbody = document.getElementById("workerHistoryTable");
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:#94a3b8">Loading…</td></tr>`;
  openModal("workerHistoryModal");
  const payments = allWorkerPayments.filter((p) => p.worker_id === id);
  if (!payments.length) {
    tbody.innerHTML = emptyRow(3, "No payments found");
    return;
  }
  tbody.innerHTML = payments
    .map(
      (p) => `
    <tr>
      <td>${rupee(p.amount)}</td>
      <td>${p.payment_reason}</td>
      <td>${fmtDate(p.payment_date)}</td>
    </tr>`,
    )
    .join("");
};

// ============================================================
//  CONFIRM DELETE
// ============================================================
let pendingDelete = null;
window.confirmDelete = function (type, id, name) {
  pendingDelete = { type, id };
  document.getElementById("confirmText").textContent =
    `Delete "${name}"? This cannot be undone.`;
  openModal("confirmModal");
};
document
  .getElementById("confirmDeleteBtn")
  ?.addEventListener("click", async () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    try {
      await deleteDoc(
        doc(db, type === "customer" ? "customers" : "workers", id),
      );
      showToast(`${type === "customer" ? "Customer" : "Worker"} deleted.`);
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
    closeModal("confirmModal");
    pendingDelete = null;
  });

// ============================================================
//  TRANSACTIONS TABLE
// ============================================================
function renderTransactionsTable(txs) {
  const tbody = document.getElementById("transactionsTable");
  if (!tbody) return;
  if (!txs.length) {
    tbody.innerHTML = emptyRow(4, "No transactions yet");
    return;
  }
  tbody.innerHTML = txs
    .map(
      (t) => `
    <tr>
      <td><span class="badge ${t.type === "income" ? "badge-income" : "badge-expense"}">${t.type}</span></td>
      <td style="font-size:12px;color:var(--text-3)">${t.reference_id || "—"}</td>
      <td>${rupee(t.amount)}</td>
      <td>${fmtDate(t.created_at)}</td>
    </tr>`,
    )
    .join("");
  // Update totals
  const income = txs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + (t.amount || 0), 0);
  const expense = txs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + (t.amount || 0), 0);
  const incEl = document.getElementById("txIncomeTotal");
  const expEl = document.getElementById("txExpenseTotal");
  if (incEl) incEl.textContent = rupee(income);
  if (expEl) expEl.textContent = rupee(expense);
}

window.filterTransactions = function () {
  const type = document.getElementById("txTypeFilter")?.value || "";
  const date = document.getElementById("txDateFilter")?.value || "";
  let filtered = allTransactions.filter((t) => {
    const matchType = !type || t.type === type;
    const matchDate =
      !date ||
      (t.created_at &&
        fmtDate(t.created_at).includes(
          new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        ));
    return matchType && matchDate;
  });
  renderTransactionsTable(filtered);
};

window.clearTxFilters = function () {
  document.getElementById("txTypeFilter").value = "";
  document.getElementById("txDateFilter").value = "";
  renderTransactionsTable(allTransactions);
};

// ============================================================
//  REPORTS
// ============================================================
function populateReportYears() {
  const sel = document.getElementById("reportYear");
  if (!sel) return;
  const cur = new Date().getFullYear();
  sel.innerHTML = "";
  for (let y = cur; y >= cur - 4; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  }
}

window.loadReports = function () {
  const year = parseInt(
    document.getElementById("reportYear")?.value || new Date().getFullYear(),
  );
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const incomeByMonth = new Array(12).fill(0);
  const expenseByMonth = new Array(12).fill(0);

  allCustomerPayments.forEach((p) => {
    const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    if (d.getFullYear() === year) incomeByMonth[d.getMonth()] += p.amount || 0;
  });
  allWorkerPayments.forEach((p) => {
    const d = p.payment_date?.toDate
      ? p.payment_date.toDate()
      : new Date(p.payment_date);
    if (d.getFullYear() === year) expenseByMonth[d.getMonth()] += p.amount || 0;
  });

  const profitByMonth = incomeByMonth.map((inc, i) => inc - expenseByMonth[i]);
  const totalInc = incomeByMonth.reduce((s, v) => s + v, 0);
  const totalExp = expenseByMonth.reduce((s, v) => s + v, 0);
  const totalProfit = totalInc - totalExp;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("annualIncome", rupee(totalInc));
  set("annualExpenses", rupee(totalExp));
  const ap = document.getElementById("annualProfit");
  if (ap) {
    ap.textContent = rupee(totalProfit);
    ap.style.color = totalProfit >= 0 ? "var(--green)" : "var(--red)";
  }

  // Monthly table
  const tbody = document.getElementById("reportTable");
  if (tbody) {
    tbody.innerHTML = months
      .map((m, i) => {
        const profit = profitByMonth[i];
        return `<tr>
        <td>${m} ${year}</td>
        <td>${rupee(incomeByMonth[i])}</td>
        <td>${rupee(expenseByMonth[i])}</td>
        <td class="${profit >= 0 ? "profit-positive" : "profit-negative"}">${rupee(profit)}</td>
      </tr>`;
      })
      .join("");
  }

  // Chart
  drawChart(months, incomeByMonth, expenseByMonth, profitByMonth);
};

function drawChart(labels, income, expenses, profit) {
  const canvas = document.getElementById("reportChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.parentElement.clientWidth - 40;
  const H = 260;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const padding = { top: 20, right: 20, bottom: 40, left: 70 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const allVals = [...income, ...expenses, ...profit.map((v) => Math.abs(v))];
  const maxVal = Math.max(...allVals, 1);

  const scaleY = (v) => padding.top + chartH - (v / maxVal) * chartH;
  const stepX = chartW / (labels.length - 1);

  // Grid lines
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    const val = maxVal - (maxVal / 4) * i;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px DM Sans";
    ctx.textAlign = "right";
    ctx.fillText("৳" + Math.round(val / 1000) + "k", padding.left - 8, y + 4);
  }

  // X labels
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px DM Sans";
  ctx.textAlign = "center";
  labels.forEach((l, i) => {
    ctx.fillText(l, padding.left + i * stepX, H - 10);
  });

  // Draw line
  const drawLine = (data, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    data.forEach((v, i) => {
      const x = padding.left + i * stepX;
      const y = scaleY(Math.max(0, v));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots
    ctx.fillStyle = color;
    data.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(
        padding.left + i * stepX,
        scaleY(Math.max(0, v)),
        3.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  };

  drawLine(income, "#16a34a");
  drawLine(expenses, "#dc2626");
  drawLine(profit, "#2563eb");
}
