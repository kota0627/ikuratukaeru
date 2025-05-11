// Firebase Auth & Firestore の参照
const db = window.db;
const auth = window.auth;

// DOM取得
const budgetInput = document.getElementById("budgetInput");
const dateInput = document.getElementById("dateInput");
const descInput = document.getElementById("descInput");
const amountInput = document.getElementById("amountInput");
const remainingAmount = document.getElementById("remainingAmount");
const historyList = document.getElementById("historyList");

let currentUser = null;

async function loginOrSignup() {
  const email = prompt("メールアドレスを入力");
  const password = prompt("パスワードを入力");
  if (!email || !password) return;

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    currentUser = result.user;
    alert("ログイン成功");
    updateDisplayByDate();
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      currentUser = result.user;
      alert("新規登録成功");
      updateDisplayByDate();
    } else {
      alert("ログイン失敗: " + err.message);
    }
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    updateDisplayByDate();
  } else {
    loginOrSignup();
  }
});

function getMonthKeyFromDate(dateStr) {
  return dateStr.slice(0, 7);
}

async function setBudget() {
  const date = dateInput.value || new Date().toISOString().slice(0, 10);
  const monthKey = getMonthKeyFromDate(date);
  const budget = Number(budgetInput.value);
  if (!currentUser) return;

  await setDoc(doc(db, "users", currentUser.uid, "budgets", monthKey), {
    budget: budget
  });
  updateDisplayByDate();
}

async function addExpense() {
  const date = dateInput.value;
  const desc = descInput.value.trim();
  const amount = Number(amountInput.value);
  if (!date || !desc || !amount || amount <= 0) {
    alert("すべての項目を正しく入力してください");
    return;
  }
  const monthKey = getMonthKeyFromDate(date);
  if (!currentUser) return;

  await addDoc(collection(db, "users", currentUser.uid, "expenses"), {
    date, desc, amount, month: monthKey, createdAt: new Date()
  });

  descInput.value = "";
  amountInput.value = "";
  updateDisplayByDate();
}

async function updateDisplayByDate() {
  const date = dateInput.value || new Date().toISOString().slice(0, 10);
  const monthKey = getMonthKeyFromDate(date);
  if (!currentUser) return;

  const budgetSnap = await getDoc(doc(db, "users", currentUser.uid, "budgets", monthKey));
  const budget = budgetSnap.exists() ? budgetSnap.data().budget : 0;
  budgetInput.value = budget;

  const q = query(collection(db, "users", currentUser.uid, "expenses"), where("month", "==", monthKey));
  const snap = await getDocs(q);

  let total = 0;
  historyList.innerHTML = "";
  snap.forEach(doc => {
    const e = doc.data();
    total += e.amount;
    const li = document.createElement("li");
    li.textContent = `${e.date} - ${e.desc}：${e.amount}円`;
    historyList.appendChild(li);
  });

  remainingAmount.textContent = budget - total;
}