/* ========= 今月いくら使えるくん script ========= */
const dateInput = document.getElementById("dateInput");
dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener("change", updateDisplayByDate);

const getMonthKey = (d) => d.slice(0, 7); // yyyy-mm
let editMode = null;                       // { key, index } or null

function setBudget() {
  const key = getMonthKey(dateInput.value);
  const budget = Number(document.getElementById("budgetInput").value || 0);
  localStorage.setItem(`budget_${key}`, budget);
  updateDisplayByDate();
  updateChart();
}

function addExpense() {
  const date   = dateInput.value;
  const desc   = document.getElementById("descInput").value.trim();
  const amount = Number(document.getElementById("amountInput").value);
  if (!date || !desc || amount <= 0) { alert("正しく入力してね！"); return; }

  const key      = getMonthKey(date);
  const expenses = JSON.parse(localStorage.getItem(`expenses_${key}`) || "[]");

  if (editMode && editMode.key === key) {
    expenses[editMode.index] = { date, desc, amount };
    editMode = null;
    document.getElementById("submitBtn").textContent = "追加";
  } else {
    expenses.push({ date, desc, amount });
  }

  localStorage.setItem(`expenses_${key}`, JSON.stringify(expenses));
  document.getElementById("descInput").value   = "";
  document.getElementById("amountInput").value = "";
  updateDisplayByDate();
  updateChart();
}

function deleteExpense(key, idx) {
  const list = JSON.parse(localStorage.getItem(`expenses_${key}`) || "[]");
  list.splice(idx, 1);
  localStorage.setItem(`expenses_${key}`, JSON.stringify(list));
  updateDisplayByDate();
  updateChart();
}

function switchTab(tabId, evt) {
  document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
  document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId).style.display = "block";
  if (evt) evt.target.classList.add("active");
  if (tabId === "graphTab") updateChart();
}

function updateDisplayByDate() {
  const key      = getMonthKey(dateInput.value);
  const budget   = Number(localStorage.getItem(`budget_${key}`) || 0);
  const expenses = JSON.parse(localStorage.getItem(`expenses_${key}`) || "[]");

  document.getElementById("budgetInput").value = budget;
  const listEl = document.getElementById("historyList");
  listEl.innerHTML = "";
  let total = 0;

  expenses.forEach((e, i) => {
    total += e.amount;
    const li = document.createElement("li");
    li.innerHTML =
      `<strong>${e.date}</strong> - ${e.desc}：${e.amount} 円
       <button onclick="deleteExpense('${key}', ${i})">🗑</button>`;
    li.onclick = () => {
      dateInput.value = e.date;
      document.getElementById("descInput").value   = e.desc;
      document.getElementById("amountInput").value = e.amount;
      editMode = { key, index: i };
      document.getElementById("submitBtn").textContent = "更新";
    };
    listEl.appendChild(li);
  });

  const remain = budget - total;
  const remainEl = document.getElementById("remainingAmount");
  remainEl.textContent = remain;
  remainEl.className   = remain >= 0 ? "remaining-positive" : "remaining-negative";
}

let barChart = null;
function updateChart() {
  const ctx = document.getElementById("monthlyChart").getContext("2d");
  const months = new Set();

  for (let i = 0; i < localStorage.length; i++) {
    const m = localStorage.key(i).match(/^(budget|expenses)_(\d{4}-\d{2})$/);
    if (m) months.add(m[2]);
  }

  const labels = [], budgets = [], totals = [];
  Array.from(months).sort().forEach(m => {
    const b = Number(localStorage.getItem(`budget_${m}`) || 0);
    const e = JSON.parse(localStorage.getItem(`expenses_${m}`) || "[]");
    const t = e.reduce((s, x) => s + x.amount, 0);
    if (b === 0 && t === 0) return;
    labels.push(m); budgets.push(b); totals.push(t);
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "予算", data: budgets, backgroundColor: "rgba(33,150,243,0.5)" },
        { label: "支出", data: totals,  backgroundColor: "rgba(244,67,54,0.5)" }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            afterBody: info => {
              const i = info[0].dataIndex;
              const diff = budgets[i] - totals[i];
              return `差額：${diff >= 0 ? "+" : ""}${diff} 円`;
            }
          }
        }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

document.addEventListener("DOMContentLoaded", updateDisplayByDate);
