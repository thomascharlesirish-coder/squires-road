/* The Squire’s Road — v0.1 (local-only PWA) */

const STORAGE_KEY = "tsr_state_v0_1";

const RANKS = [
  { name:"Town Guard", silhouetteClass:"", caption:"A rough outline—yet the road begins.",
    oath:"“I will do what I said I would do—quietly, without excuse.”", requirements: () => true },
  { name:"Mercenary", silhouetteClass:"sharper", caption:"Edges sharpen. Work becomes habit.",
    oath:"“Coin is earned, not given. So is strength.”",
    requirements: (s) => s.bestStreak >= 7 && s.totalDutiesCompleted >= 20 },
  { name:"Squire", silhouetteClass:"defined", caption:"Form holds under pressure. You return again.",
    oath:"“I train while others talk.”",
    requirements: (s) => s.bestStreak >= 14 && s.totalDutiesCompleted >= 60 && s.goalsCompleted >= 1 },
  { name:"Landless Knight", silhouetteClass:"crisp", caption:"You carry your name by discipline alone.",
    oath:"“No land, no title—still I keep my word.”",
    requirements: (s) => s.bestStreak >= 30 && s.totalDutiesCompleted >= 140 && s.goalsCompleted >= 2 },
  { name:"Landed Knight", silhouetteClass:"commanding", caption:"You’ve built a keep from ordinary days.",
    oath:"“I maintain what I earned.”",
    requirements: (s) => s.bestStreak >= 60 && s.totalDutiesCompleted >= 300 && s.goalsCompleted >= 3 }
];

const DEFAULT_DUTIES = [
  { id:"pushups", name:"Steel the Body", desc:"20 push-ups", gold:10 },
  { id:"walk", name:"Endure the Road", desc:"10-minute walk (or equivalent)", gold:10 },
  { id:"core", name:"Fortify the Core", desc:"20 sit-ups or a plank", gold:10 },
  { id:"mobility", name:"Tend the Armor", desc:"Stretch / mobility (5–10 min)", gold:5 },
  { id:"word", name:"Keep Your Word", desc:"One promised task completed", gold:5 }
];

const SHOP = {
  backgrounds: [
    { id:"parchment", name:"Parchment Road", cost:0, desc:"Default" },
    { id:"forest", name:"Forest Track", cost:120, desc:"Quiet green miles" },
    { id:"torchhall", name:"Torch-lit Hall", cost:220, desc:"Warm stone and iron" }
  ],
  homes: [
    { id:"camp", name:"Traveler’s Camp", cost:0, desc:"Default" },
    { id:"watchtower", name:"Watchtower", cost:200, desc:"A place to stand watch" },
    { id:"keep", name:"Stone Keep", cost:450, desc:"Walls that hold" }
  ],
  titles: [
    { id:"none", name:"No Title", cost:0, desc:"Default" },
    { id:"steadfast", name:"the Steadfast", cost:150, desc:"Known for returning" },
    { id:"ironwilled", name:"the Iron-willed", cost:300, desc:"Known for discipline" }
  ]
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

function todayStr(d=new Date()){
  const yyyy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function daysBetween(aStr,bStr){
  const a=new Date(aStr+"T00:00:00");
  const b=new Date(bStr+"T00:00:00");
  return Math.round((b-a)/(24*60*60*1000));
}
function cryptoId(){ return Math.random().toString(16).slice(2)+"-"+Date.now().toString(16); }

function makeFreshState(){
  const t=todayStr();
  return {
    createdAt:t,
    lastOpenedAt:t,
    lastSealedAt:null,
    gold:0,
    goldEarnedTotal:0,
    currentStreak:0,
    bestStreak:0,
    rankIndex:0,
    totalDutiesCompleted:0,
    dutiesToday: DEFAULT_DUTIES.map(d=>({...d,done:false})),
    goals:[
      { id:cryptoId(), name:"Lose 5 lbs", type:"weight", target:5, progress:0, unit:"lbs", completed:false },
      { id:cryptoId(), name:"Bench 225", type:"strength", target:225, progress:0, unit:"lbs", completed:false }
    ],
    goalsCompleted:0,
    purchases:{ backgrounds:["parchment"], homes:["camp"], titles:["none"] },
    equipped:{ background:"parchment", home:"camp", title:"none" }
  };
}
function loadState(){
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw) return makeFreshState();
  try{ return JSON.parse(raw); } catch { return makeFreshState(); }
}
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function setActiveScreen(name){
  $all(".tab").forEach(t=>t.classList.toggle("active", t.dataset.screen===name));
  $all(".screen").forEach(s=>s.classList.remove("active"));
  $(`#screen-${name}`).classList.add("active");
}
function computeDutiesDone(s){ return s.dutiesToday.filter(d=>d.done).length; }

function toast(msg){
  const el=$("#statusText");
  const prev=el.textContent;
  el.textContent=msg;
  setTimeout(()=>{ el.textContent=prev; }, 2800);
}

function coinChime(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.type="triangle"; o.frequency.value=660; g.gain.value=0.03;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+0.08);
    setTimeout(()=>ctx.close(),150);
  }catch{}
}
function fanfare(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.type="sine"; g.gain.value=0.03;
    o.connect(g); g.connect(ctx.destination);
    const t0=ctx.currentTime;
    o.frequency.setValueAtTime(440,t0);
    o.frequency.setValueAtTime(660,t0+0.10);
    o.frequency.setValueAtTime(880,t0+0.20);
    o.start(); o.stop(t0+0.35);
    setTimeout(()=>ctx.close(),450);
  }catch{}
}

function showCeremony(rankIndex){
  const r=RANKS[rankIndex];
  $("#ceremonyRank").textContent=r.name;
  $("#ceremonyText").textContent=r.oath;
  $("#ceremonyBackdrop").hidden=false;
  fanfare();
}
function closeCeremony(){ $("#ceremonyBackdrop").hidden=true; }

function awardGold(s,amount){ s.gold+=amount; s.goldEarnedTotal+=amount; return s; }

function toggleDuty(s,id){
  const duty=s.dutiesToday.find(d=>d.id===id);
  if(!duty) return s;
  if(!duty.done){
    duty.done=true;
    s.totalDutiesCompleted+=1;
    awardGold(s,duty.gold);
    coinChime();
  }else{
    duty.done=false;
    toast("Marked undone. (Gold not refunded.)");
  }
  return s;
}

function sealDay(s){
  const t=todayStr();
  const done=computeDutiesDone(s);
  if(done<3){ toast("Not yet. Stand your watch: complete at least 3 duties."); return s; }
  if(s.lastSealedAt===t){ toast("Already sealed. Your watch is done for today."); return s; }

  if(s.lastSealedAt){
    const diff=daysBetween(s.lastSealedAt,t);
    s.currentStreak = (diff===1) ? (s.currentStreak+1) : 1;
  }else s.currentStreak=1;

  if(s.currentStreak>s.bestStreak) s.bestStreak=s.currentStreak;
  s.lastSealedAt=t;
  toast("Day sealed. You stood your watch.");
  return s;
}

function canRankUp(s){
  const next=s.rankIndex+1;
  if(next>=RANKS.length) return false;
  return RANKS[next].requirements(s);
}
function tryRankUp(s){
  while(canRankUp(s)){
    s.rankIndex+=1;
    showCeremony(s.rankIndex);
  }
  return s;
}

function purchase(s, category, itemId){
  const item=SHOP[category].find(i=>i.id===itemId);
  if(!item) return s;

  const owned=s.purchases[category].includes(itemId);
  const equipKey=category.slice(0,-1);

  if(owned){
    s.equipped[equipKey]=itemId;
    toast(`Equipped: ${item.name}`);
    return s;
  }
  if(s.gold<item.cost){ toast("Not enough gold."); return s; }

  s.gold-=item.cost;
  s.purchases[category].push(itemId);
  s.equipped[equipKey]=itemId;
  toast(`Purchased: ${item.name}`);
  return s;
}

function addGoal(s){
  const name=prompt("Goal name (e.g., Lose 5 lbs, Bench 225):");
  if(!name) return s;
  const target=Number(prompt("Target number (e.g., 5 or 225):"));
  if(!Number.isFinite(target) || target<=0){ toast("Goal not added (invalid target)."); return s; }
  const unit=(prompt("Unit (e.g., lbs, days, reps):","lbs")||"units");
  s.goals.push({ id:cryptoId(), name, type:"custom", target, progress:0, unit, completed:false });
  toast("Goal added.");
  return s;
}
function updateGoalProgress(s, id){
  const g=s.goals.find(x=>x.id===id);
  if(!g) return s;
  if(g.completed){ toast("Goal already completed."); return s; }

  const val=Number(prompt(`Enter progress for "${g.name}" (0–${g.target} ${g.unit}):`, String(g.progress)));
  if(!Number.isFinite(val) || val<0) return s;

  g.progress=Math.min(g.target,val);
  if(g.progress>=g.target){
    g.completed=true;
    s.goalsCompleted+=1;
    awardGold(s,100);
    toast("Goal completed. 100 gold awarded.");
    fanfare();
  }
  return s;
}

function escapeHtml(str){
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function renderShopColumn(selector, category, s){
  const wrap=document.querySelector(selector);
  wrap.innerHTML="";
  SHOP[category].forEach(item=>{
    const owned=s.purchases[category].includes(item.id);
    const equippedKey=category.slice(0,-1);
    const equipped=s.equipped[equippedKey]===item.id;

    const el=document.createElement("div");
    el.className="item"+(!owned?" locked":"");
    el.innerHTML=`
      <div>
        <div class="item-name">${escapeHtml(item.name)} ${equipped ? "• Equipped" : ""}</div>
        <div class="item-sub">${escapeHtml(item.desc)}</div>
      </div>
      <div class="mini">
        <div class="badge">${owned ? "Owned" : `${item.cost}`}</div>
        <button class="btn ${owned ? "ghost" : "primary"}">${owned ? "Equip" : "Buy"}</button>
      </div>
    `;
    el.querySelector("button").addEventListener("click",(e)=>{
      e.stopPropagation();
      state=purchase(state,category,item.id);
      saveState(state);
      render(state);
    });
    wrap.appendChild(el);
  });
}

function render(s){
  const rank=RANKS[s.rankIndex];
  $("#rankLabel").textContent=rank.name;
  $("#goldValue").textContent=s.gold;

  const done=computeDutiesDone(s);
  $("#dutiesTodayValue").textContent=`${done}/5`;
  $("#streakValue").textContent=s.currentStreak;
  $("#bestStreakValue").textContent=s.bestStreak;

  const t=todayStr();
  const sealed=(s.lastSealedAt===t);
  $("#statusTitle").textContent = sealed ? "You stood your watch today." : "Your duties await.";
  $("#statusText").textContent = sealed
    ? "Quiet progress counts. Return tomorrow and keep your word."
    : "Take the road in honest effort. No one watches—save your own oath.";

  const sil=$("#silhouette");
  sil.className="silhouette "+(rank.silhouetteClass||"");
  $("#silhouetteCaption").textContent=rank.caption;
  $("#oathText").textContent=rank.oath;

  const list=$("#dutiesList");
  list.innerHTML="";
  s.dutiesToday.forEach(d=>{
    const row=document.createElement("div");
    row.className="duty"+(d.done?" done":"");
    row.innerHTML=`
      <div class="duty-left">
        <div class="duty-name">${escapeHtml(d.name)}</div>
        <div class="duty-desc">${escapeHtml(d.desc)}</div>
      </div>
      <div class="duty-right">
        <div class="badge">+${d.gold}</div>
        <div class="check">${d.done ? "✓" : ""}</div>
      </div>
    `;
    row.addEventListener("click",()=>{
      state=toggleDuty(state,d.id);
      state=tryRankUp(state);
      saveState(state);
      render(state);
    });
    list.appendChild(row);
  });

  const goals=$("#goalsList");
  goals.innerHTML="";
  if(s.goals.length===0){
    goals.innerHTML=`<div class="tiny muted">No goals yet. Add one.</div>`;
  }else{
    s.goals.forEach(g=>{
      const pct=Math.round((g.progress/g.target)*100);
      const el=document.createElement("div");
      el.className="goal";
      el.innerHTML=`
        <div class="goal-top">
          <div>
            <div class="goal-title">${escapeHtml(g.name)} ${g.completed ? "✓" : ""}</div>
            <div class="goal-meta">Progress: ${g.progress}/${g.target} ${escapeHtml(g.unit)}</div>
          </div>
          <div class="badge">${g.completed ? "+100 (earned)" : "Rank Gate"}</div>
        </div>
        <div class="progress"><div style="width:${Math.min(100,pct)}%"></div></div>
        <div class="goal-actions">
          <button class="btn ghost" data-act="update">Update</button>
        </div>
      `;
      el.querySelector('[data-act="update"]').addEventListener("click",(e)=>{
        e.stopPropagation();
        state=updateGoalProgress(state,g.id);
        state=tryRankUp(state);
        saveState(state);
        render(state);
      });
      goals.appendChild(el);
    });
  }

  renderShopColumn("#shopBackgrounds","backgrounds",s);
  renderShopColumn("#shopHomes","homes",s);
  renderShopColumn("#shopTitles","titles",s);

  $("#recordRank").textContent=rank.name;
  $("#recordDays").textContent=daysBetween(s.createdAt,todayStr())+1;
  $("#recordDuties").textContent=s.totalDutiesCompleted;
  $("#recordGoldEarned").textContent=s.goldEarnedTotal;
}

/* Service worker registration */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(()=>{});
}

/* Wire up UI */
let state=loadState();
saveState(state);

$all(".tab").forEach(btn=>btn.addEventListener("click",()=>setActiveScreen(btn.dataset.screen)));
$("#btnBegin").addEventListener("click",()=>setActiveScreen("duties"));

$("#btnSealDay").addEventListener("click",()=>{
  state=sealDay(state);
  state=tryRankUp(state);
  saveState(state);
  render(state);
});

$("#btnAddGoal").addEventListener("click",()=>{
  state=addGoal(state);
  saveState(state);
  render(state);
});

$("#btnCeremonyClose").addEventListener("click",()=>{
  closeCeremony();
  render(state);
});

$("#btnReset").addEventListener("click",()=>{
  if(!confirm("Reset all local data for The Squire’s Road?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state=makeFreshState();
  saveState(state);
  render(state);
});

render(state);
