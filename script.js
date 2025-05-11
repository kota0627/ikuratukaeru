// ===== Firebase オブジェクト =====
const db   = window.db;
const auth = window.auth;

/* Firestore helper */
const {
  collection, addDoc, getDoc, setDoc,
  getDocs, doc, query, where
} = window;

/* Auth helper */
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} = window;

// ===== DOM =====
const budgetInput     = document.getElementById("budgetInput");
const dateInput       = document.getElementById("dateInput");
const descInput       = document.getElementById("descInput");
const amountInput     = document.getElementById("amountInput");
const remainingAmount = document.getElementById("remainingAmount");
const historyList     = document.getElementById("historyList");

let currentUser = null;   // ログイン中ユーザーオブジェクト
let barChart    = null;   // Chart.js インスタンス

// -----------------------------------------------------------------------------
// 1. ログイン or 新規登録
// -----------------------------------------------------------------------------
async function loginOrSignup() {
  const email    = prompt("メールアドレスを入力");
  const password = prompt("パスワードを入力（6文字以上）");
  if (!email || !password) return;

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    currentUser = result.user;
    alert("ログイン成功");
    updateDisplayByDate();
  } catch (err) {
    // 登録が無い場合は自動登録
    if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      currentUser = result.user;
      alert("新規登録成功");
      updateDisplayByDate();
    } else {
      alert("ログイン失敗: " + err.message);
    }
  }
}

/* ログイン状態監視 → 未ログインなら必ずプロンプト */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    updateDisplayByDate();
  } else {
    loginOrSignup();
  }
});

// -----------------------------------------------------------------------------
// 2. 便利関数
// -----------------------------------------------------------------------------
const getMonthKeyFromDate = (d) => d.slice(0, 7);

// -----------------------------------------------------------------------------
// 3. 予算保存
// -----------------------------------------------------------------------------
async function setBudget() {
  if (!currentUser) return;
  const date      = dateInput.value || new Date().toISOString().slice(0, 10);
  const monthKey  = getMonthKeyFromDate(date);
  const budgetVal = Number(budgetInput.value);

  await setDoc(doc(db, "users", currentUser.uid, "budgets", monthKey), {
    budget: budgetVal
  });
  updateDisplayByDate();
}

// -----------------------------------------------------------------------------
// 4. 支出追加
// -----------------------------------------------------------------------------
async function addExpense() {
  if (!currentUser) return;

  const date   = dateInput.value;
  const desc   = descInput.value.trim();
  const amount = Number(amountInput.value);

  if (!date || !desc || !amount || amount <= 0) {
    alert("すべての項目を正しく入力してください。");
    return;
  }
  const monthKey = getMonthKeyFromDate(date);

  await addDoc(collection(db, "users", currentUser.uid, "expenses"), {
    date, desc, amount, month: monthKey, createdAt: new Date()
  });

  descInput.value   = "";
  amountInput.value = "";
  updateDisplayByDate();
  updateChart();
}

// -----------------------------------------------------------------------------
// 5. 画面更新
// -----------------------------------------------------------------------------
async function updateDisplayByDate() {
  if (!currentUser) return;
  const date     = dateInput.value || new Date().toISOString().slice(0, 10);
  const monthKey = getMonthKeyFromDate(date);

  // 予算取得
  const budgetSnap = await getDoc(doc(db, "users", currentUser.uid, "budgets", monthKey));
  const budget     = budgetSnap.exists() ? budgetSnap.data().budget : 0;
  budgetInput.value = budget;

  // 支出取得
  const q    = query(collection(db, "users", currentUser.uid, "expenses"), where("month", "==", monthKey));
  const snap = await getDocs(q);

  historyList.innerHTML = "";
  let total = 0;
  snap.forEach((d) => {
    const e = d.data();
    total += e.amount;
    const li = document.createElement("li");
    li.textContent = `${e.date} - ${e.desc}：${e.amount} 円`;
    historyList.appendChild(li);
  });

  remainingAmount.textContent = budget - total;
}

// -----------------------------------------------------------------------------
// 6. チャート更新
// -----------------------------------------------------------------------------
async function updateChart() {
  if (!currentUser) return;

  // 全月のデータを取得
  const expSnap  = await getDocs(collection(db, "users", currentUser.uid, "expenses"));
  const budgSnap = await getDocs(collection(db, "users", currentUser.uid, "budgets"));

  const monthsSet = new Set();
  expSnap.forEach((d)  => monthsSet.add(d.data().month));
  budgSnap.forEach((d) => monthsSet.add(d.id));

  const months = Array.from(monthsSet).sort();

  const budgets = months.map(m => {
    const b = budgSnap.docs.find(d => d.id === m);
    return b ? b.data().budget : 0;
  });

  const totals  = months.map(m => {
    return expSnap.docs
      .filter(d => d.data().month === m)
      .reduce((acc, cur) => acc + cur.data().amount, 0);
  });

  const ctx = document.getElementById("monthlyChart").getContext("2d");
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        { label: "予算",  data: budgets, backgroundColor: "rgba(33,150,243,0.5)" },
        { label: "支出",  data: totals,  backgroundColor: "rgba(244,67,54,0.5)" }
      ]
    },
    options: { responsive: true }
  });
}

// -----------------------------------------------------------------------------
// 7. タブ切替
// -----------------------------------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
  document.querySelectorAll(".tab-button").forEach(el => el.classList.remove("active"));
  document.getElementById(tabId).style.display = "block";
  event.target.classList.add("active");
  if (tabId === "graphTab") updateChart();
}

// -----------------------------------------------------------------------------
// 8. 初期化
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  dateInput.value = new Date().toISOString().slice(0, 10);
  // ログイン状態は onAuthStateChanged で処理
});
