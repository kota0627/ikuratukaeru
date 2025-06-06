// ===== Firebase オブジェクト =====
const {
  db, auth,
  collection, addDoc, getDoc, setDoc,
  getDocs, doc, query, where, deleteDoc, updateDoc,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} = window;

/* ===== DOM ===== */
const budgetInput = document.getElementById("budgetInput");
const dateInput   = document.getElementById("dateInput");
const descInput   = document.getElementById("descInput");
const amountInput = document.getElementById("amountInput");
const remainingEl = document.getElementById("remainingAmount");
const historyList = document.getElementById("historyList");
const addBtn      = document.getElementById("addBtn");
const saveBtn     = document.getElementById("saveBtn");

let currentUser = null;
let barChart    = null;
let editingId   = null;

/* ===== Util ===== */
const getMonthKey = d => d.slice(0,7);
const markErr = (el,f) => el.style.border = f ? "2px solid red" : "";

/* ===== 認証 ===== */
async function loginOrSignup(){
  const email = prompt("メールアドレスを入力");
  const pass  = prompt("パスワードを入力（6文字以上）");
  if(!email || !pass) return;

  try{
    const r = await signInWithEmailAndPassword(auth,email,pass);
    currentUser = r.user; alert("ログイン成功"); updateDisplay();
  }catch(err){
    if(err.code === "auth/invalid-credential" || err.code === "auth/user-not-found"){
      const r = await createUserWithEmailAndPassword(auth,email,pass);
      currentUser = r.user; alert("新規登録成功"); updateDisplay();
    }else alert("ログイン失敗: "+err.message);
  }
}
onAuthStateChanged(auth,u => { currentUser=u; u?updateDisplay():loginOrSignup(); });

/* ===== 予算設定 ===== */
async function setBudget(){
  if(!currentUser) return;
  const key = getMonthKey(dateInput.value || new Date().toISOString().slice(0,10));
  await setDoc(doc(db,"users",currentUser.uid,"budgets",key),
               { budget:Number(budgetInput.value||0) });
  updateDisplay();
}

/* ===== 支出追加 ===== */
async function addExpense(){
  if(!currentUser) return;
  const date = dateInput.value, desc = descInput.value.trim(), amt = Number(amountInput.value);

  markErr(dateInput,!date); markErr(descInput,!desc); markErr(amountInput,!amt||amt<=0);
  if(!date||!desc||!amt||amt<=0){ alert("正しく入力してください"); return; }

  await addDoc(collection(db,"users",currentUser.uid,"expenses"),{
    date, desc, amount:amt, month:getMonthKey(date), createdAt:new Date()
  });
  descInput.value=""; amountInput.value="";
  markErr(descInput,false); markErr(amountInput,false);
  updateDisplay(); updateChart();
}

/* ===== 支出編集開始 ===== */
async function startEditExpense(id){
  if(!currentUser) return;
  const snap = await getDoc(doc(db,"users",currentUser.uid,"expenses",id));
  if(!snap.exists()) return;
  const e = snap.data();
  dateInput.value = e.date;
  descInput.value = e.desc;
  amountInput.value = e.amount;
  editingId = id;
  addBtn.style.display = "none";
  saveBtn.style.display = "inline-block";
}

/* ===== 支出保存 ===== */
async function saveExpenseEdit(){
  if(!currentUser || !editingId) return;
  const date = dateInput.value, desc = descInput.value.trim(), amt = Number(amountInput.value);
  markErr(dateInput,!date); markErr(descInput,!desc); markErr(amountInput,!amt||amt<=0);
  if(!date||!desc||!amt||amt<=0){ alert("正しく入力してください"); return; }
  await updateDoc(doc(db,"users",currentUser.uid,"expenses",editingId),{
    date, desc, amount:amt, month:getMonthKey(date)
  });
  editingId = null;
  descInput.value=""; amountInput.value="";
  addBtn.style.display = "inline-block";
  saveBtn.style.display = "none";
  markErr(descInput,false); markErr(amountInput,false);
  updateDisplay(); updateChart();
}

/* ===== 支出削除 ===== */
async function deleteExpense(id){
  if(!currentUser) return;
  await deleteDoc(doc(db,"users",currentUser.uid,"expenses",id));
  updateDisplay(); updateChart();
}

/* ===== 画面更新 ===== */
async function updateDisplay(){
  if(!currentUser) return;
  const date = dateInput.value || new Date().toISOString().slice(0,10);
  const key  = getMonthKey(date);

  const bSnap = await getDoc(doc(db,"users",currentUser.uid,"budgets",key));
  const budget = bSnap.exists()? bSnap.data().budget : 0;
  budgetInput.value = budget;

  const q  = query(collection(db,"users",currentUser.uid,"expenses"), where("month","==",key));
  const qs = await getDocs(q);

  historyList.innerHTML = "";
  let total = 0;

  qs.forEach(d=>{
    const e = d.data();
    total += e.amount;

    /* --- 日付を yy/MM/dd 表記に変換 --- */
    const shortDate = e.date.slice(2).replace(/-/g,"/");  // 2025-05-11 -> 25/05/11

    const li = document.createElement("li");
    li.className = "relative bg-white shadow-md rounded-lg p-4 mb-4";
    li.innerHTML =
      `<div>
         <div class="text-sm text-gray-500">${shortDate}</div>
         <div class="font-medium mt-1">${e.desc}</div>
         <div class="mt-1">${e.amount} 円</div>
       </div>
       <div class="absolute bottom-3 right-3 flex space-x-3">
         <button class="edit-btn" onclick="startEditExpense('${d.id}')">✏</button>
         <button class="del-btn" onclick="deleteExpense('${d.id}')">🗑</button>
       </div>`;
    historyList.appendChild(li);
  });

  const remain = budget - total;
  remainingEl.textContent = remain;
  remainingEl.classList.toggle("green",remain >= 0);
  remainingEl.classList.toggle("red",  remain < 0);
}

/* ===== グラフ更新 ===== */
async function updateChart(){
  if(!currentUser) return;
  const exp = await getDocs(collection(db,"users",currentUser.uid,"expenses"));
  const bud = await getDocs(collection(db,"users",currentUser.uid,"budgets"));

  const months = new Set();
  exp.forEach(d=>months.add(d.data().month));
  bud.forEach(d=>months.add(d.id));
  const mArr = [...months].sort();

  const budgets = mArr.map(m=>{
    const b = bud.docs.find(d=>d.id===m); return b?b.data().budget:0; });
  const totals = mArr.map(m=>{
    return exp.docs.filter(d=>d.data().month===m)
                   .reduce((s,x)=>s + x.data().amount,0); });

  const ctx = document.getElementById("monthlyChart").getContext("2d");
  if(barChart) barChart.destroy();
  barChart = new Chart(ctx,{type:"bar",
    data:{labels:mArr,datasets:[
      {label:"予算", data:budgets, backgroundColor:"rgba(33,150,243,0.5)"},
      {label:"支出", data:totals,  backgroundColor:"rgba(244,67,54,0.5)"}
    ]}, options:{responsive:true}});
}

/* ===== タブ切替 ===== */
function switchTab(id){
  document.querySelectorAll(".tab-content").forEach(t=>t.style.display="none");
  document.querySelectorAll(".tab-button").forEach(b=>b.classList.remove("active"));
  document.getElementById(id).style.display="block";
  event.target.classList.add("active");
  if(id==="graphTab") updateChart();
}

/* ===== 初期 ===== */
document.addEventListener("DOMContentLoaded",()=>{
  dateInput.value = new Date().toISOString().slice(0,10);
});

function updateDisplayByDate(){
  updateDisplay();
}
