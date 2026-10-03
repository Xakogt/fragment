const $=id=>document.getElementById(id);
let S=localStorage.getItem("fragmentSession")||"", ME=null;
function hw(){let x=localStorage.getItem("fragmentDevice");if(!x){x=crypto.randomUUID();localStorage.setItem("fragmentDevice",x)}return x}
function msg(t,ok=false){$("authmsg").innerHTML=`<p class="${ok?"ok":"err"}">${t}</p>`}
async function api(url,opt={}){opt.headers={...(opt.headers||{}),"content-type":"application/json","x-session":S};let r=await fetch(url,opt);let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");const m=b.dataset.mode;$("loginbox").classList.toggle("hidden",m!=="login");$("signupbox").classList.toggle("hidden",m!=="signup");$("adminbox").classList.toggle("hidden",m!=="admin");});
$("lh").value=$("sh").value=hw();
$("adminlogin").onclick=async()=>{try{let d=await fetch("/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:$("au").value.trim(),password:$("ap").value})});let j=await d.json();if(!d.ok)throw Error(j.error||"Invalid admin credentials");S=j.session;localStorage.setItem("fragmentSession",S);localStorage.setItem("fragmentRole","admin");$("gate").classList.add("hidden");$("app").classList.remove("hidden");$("who").textContent=j.username;$("adminnav").classList.remove("hidden");$("securitynav").classList.remove("hidden");go("admin")}catch(e){msg(e.message)}};
$("login").onclick=async()=>{try{let d=await api("/api/login",{method:"POST",body:JSON.stringify({username:$("lu").value,password:$("lp").value,hwid:hw()})});S=d.session;localStorage.setItem("fragmentSession",S);openApp()}catch(e){msg(e.message)}};
$("signup").onclick=async()=>{try{let d=await api("/api/signup",{method:"POST",body:JSON.stringify({username:$("su").value,password:$("sp").value,key:$("sk").value.trim().toUpperCase(),hwid:hw()})});msg("Account created. Sign in now.",true)}catch(e){msg(e.message)}};
$("logout").onclick=()=>{S="";localStorage.removeItem("fragmentSession");location.reload()};
document.querySelectorAll("nav button[data-p]").forEach(b=>b.onclick=()=>go(b.dataset.p));
async function openApp(){try{let a=await api("/api/admin/me");ME={username:a.username,products:[]};$("gate").classList.add("hidden");$("app").classList.remove("hidden");$("who").textContent=a.username;$("adminnav").classList.remove("hidden");$("securitynav").classList.remove("hidden");go("admin");return}catch{}try{ME=await api("/api/profile");$("gate").classList.add("hidden");$("app").classList.remove("hidden");$("who").textContent=ME.username;
ensureConfigNav();
try{await api("/api/admin/me");$("adminnav").classList.remove("hidden");$("securitynav").classList.remove("hidden")}catch{$("adminnav").classList.add("hidden");$("securitynav").classList.add("hidden")}go("dashboard")}catch{S="";localStorage.removeItem("fragmentSession");localStorage.removeItem("fragmentRole")}}
function ensureConfigNav(){
 if(!ME || !ME.products.includes("table") || $("confignav")) return;
 let b=document.createElement("button"); b.id="confignav"; b.dataset.p="config"; b.textContent="Config";
 document.querySelector("nav").insertBefore(b,$("logout")); b.onclick=()=>go("config");
}
function go(p){if(p==="dashboard")dashboard();if(p==="profile")profile();if(p==="config")configPage();if(p==="admin")admin();if(p==="security")security()}
async function dashboard(){
let html=`<div class="panel"><h1>fragment.lol</h1><p class="muted">Your unlocked products.</p><div class="grid">`;
for(const t of ["software","gui","table"]){
 const name=t==="software"?"Fragment Software":t==="gui"?"Fragment GUI":"Fragment Table";
 const unlocked=ME.products.includes(t);
 html+=`<div class="panel"><h2>${name}</h2><span class="pill">${unlocked?"UNLOCKED":"LOCKED"}</span>
 <p>${unlocked?"License active on this device.":"Redeem a key in Profile / Redeem."}</p>
 ${unlocked?(t==="software"?`<span class="muted">License key active. No web loadstring is configured for this product.</span>`:`<button onclick="downloadLoader('${t}')">Download Loadstring</button>`):""}</div>`;
}
html+=`</div></div>`;
$("view").innerHTML=html;
}
async function downloadLoader(type){
 try{
  // The download contains ONLY the generated one-line loader.
  // The actual product source is never returned by this endpoint.
  const d=await api("/api/product/"+type);
  const loadstring=String(d.loadstring||"").trim()+"\n";
  if(!loadstring.trim()) throw Error("Loadstring is empty");
  const blob=new Blob([loadstring],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`fragment_${type}_loadstring.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){alert(e.message)}
}


async function configPage(){
 if(!ME.products.includes("table")) return dashboard();
 let d=await api("/api/product/table");
 $("view").innerHTML=`<div class="panel"><h1>Config</h1><p class="muted">Edit your table configuration. Save applies it to the hosted config.</p><textarea id="livecfg">${d.configuration||""}</textarea><button id="applycfg">Save & Apply</button><p id="cfgmsg"></p></div>`;
 $("applycfg").onclick=async()=>{
  await api("/api/config/save",{method:"POST",body:JSON.stringify({configuration:$("livecfg").value})});
  $("cfgmsg").innerHTML='<span class="ok">Applied.</span>';
 };
}

function escapeHtml(v){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}

function profile(){$("view").innerHTML=`<div class="grid"><div class="panel"><h2>Profile</h2><p>Username: <b>${ME.username}</b></p><p>Products: ${ME.products.map(x=>`<span class="pill">${x}</span>`).join("")}</p></div><div class="panel"><h2>Redeem another product</h2><p class="muted">Use a second license key to unlock the other product on this account.</p><input id="rk" placeholder="FRAGMENT-XXXX-XXX or FRAGMENTGUI-XXXX-XXX"><button id="redeem">Redeem key</button><p id="rm"></p></div></div>`;$("redeem").onclick=async()=>{try{let d=await api("/api/redeem",{method:"POST",body:JSON.stringify({key:$("rk").value.trim().toUpperCase(),hwid:hw()})});ME=await api("/api/profile");ensureConfigNav();$("rm").innerHTML='<span class="ok">Product unlocked.</span>';profile()}catch(e){$("rm").innerHTML='<span class="err">'+e.message+'</span>'}}}
async function security(){try{await api("/api/admin/me")}catch{return go("dashboard")}let rows=await api("/api/admin/security");const esc=v=>String(v??"—").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\'":"&#39;"}[m]));$("view").innerHTML=`<div class="panel"><div class="split"><div><h2>Security</h2><p class="muted">License, Discord, IP, and device activity for Fragment users.</p></div><button onclick="security()">Refresh</button></div><div class="list">${rows.length?rows.map(r=>`<div class="row security-row"><div><b>${esc(r.username||"Unassigned")}</b><div class="small muted">Discord: ${esc(r.discordId||"—")} · Product: ${esc(r.product||"—")}</div><div class="small">Key: <span class="key">${esc(r.key||"—")}</span></div><div class="small">IP: ${esc(r.ip||"—")} · HWID: ${esc(r.hwid||"—")}</div><div class="small muted">Last seen: ${esc(r.lastSeen||"Never")} · Status: ${esc(r.status||"unknown")}</div></div></div>`).join(""):'<span class="muted">No security records yet.</span>'}</div></div>`}
async function admin(){try{await api("/api/admin/me")}catch{return go("dashboard")}$("securitynav").classList.remove("hidden");$("view").innerHTML=`<div class="grid"><div class="panel"><h2>Import / Generate Keys</h2><select id="kt"><option value="software">Software — FRAGMENTSW-XXXX-XXX</option><option value="gui">GUI — FRAGMENTGUI-XXXX-XXX</option><option value="table">Table — FRAGMENT-XXXX-XXX</option></select><input id="kc" type="number" min="1" value="1" placeholder="Count"><button id="gen">Generate</button><textarea id="ki" placeholder="Paste imported keys, one per line"></textarea><button id="imp">Import keys</button><p id="km"></p></div><div class="panel"><h2>Source Code</h2><select id="prod"><option value="gui">GUI source</option><option value="table">Table source + configuration</option></select><textarea id="src"></textarea><div id="tablecfg" class="hidden"><input id="cfgname" placeholder="Table name"><textarea id="cfgload" placeholder="Loadstring"></textarea></div><button id="save">Save product</button></div></div><div class="panel"><h2>Keys</h2><div id="keys" class="list"></div></div>`;loadProduct();loadKeys();$("prod").onchange=loadProduct;$("gen").onclick=gen;$("imp").onclick=imp;$("save").onclick=save}
async function loadKeys(){try{let a=await api("/api/admin/keys");$("keys").innerHTML=a.map(k=>`<div class="row"><span><b class="key">${k.key}</b> <span class="pill">${k.type}</span> <span class="muted">${k.status}</span></span><button class="danger" onclick="rev('${k.key}')">Revoke</button></div>`).join("")||'<span class="muted">No keys yet.</span>'}catch{}}
async function gen(){try{let d=await api("/api/admin/keys",{method:"POST",body:JSON.stringify({type:$("kt").value,count:Number($("kc").value)})});$("ki").value=d.keys.join("\n");$("km").innerHTML='<span class="ok">Generated '+d.keys.length+' keys.</span>';loadKeys()}catch(e){$("km").textContent=e.message}}
async function imp(){try{let d=await api("/api/admin/keys/import",{method:"POST",body:JSON.stringify({type:$("kt").value,keys:$("ki").value})});$("km").innerHTML=`<span class="ok">Imported ${d.added.length}. Rejected ${d.rejected.length}.</span>`;loadKeys()}catch(e){$("km").textContent=e.message}}
async function rev(k){try{await api("/api/admin/keys/"+encodeURIComponent(k)+"/revoke",{method:"POST"});loadKeys()}catch(e){alert(e.message)}}
async function loadProduct(){let t=$("prod").value;try{let d=await api("/api/admin/product/"+t);$("src").value=d.source;$("cfgname").value=d.config.name||"";$("cfgload").value=d.config.loadstring||"";$("tablecfg").classList.toggle("hidden",t!=="table")}catch(e){alert(e.message)}}
async function save(){let t=$("prod").value,c={name:$("cfgname").value,loadstring:$("cfgload").value};if(t==="table")c.configuration=dummy();try{await api("/api/admin/product/"+t,{method:"POST",body:JSON.stringify({source:$("src").value,config:c})});alert("Saved.")}catch(e){alert(e.message)}}
function dummy(){return $("src").value.includes("Config")?$("src").value:"-- Table configuration\nreturn {}"}
openApp();