"use strict";
const STYLES=[{"id":"01","title":"Rounded flat shapes","file":"images/01-rounded-flat.png"},{"id":"02","title":"Bold outline cartoon","file":"images/02-bold-outline.png"},{"id":"03","title":"Cut-paper collage","file":"images/03-cut-paper.png"},{"id":"04","title":"Torn painted paper","file":"images/04-torn-paper.png"},{"id":"05","title":"Wax crayon","file":"images/05-wax-crayon.png"},{"id":"06","title":"Sparse colored pencil","file":"images/06-colored-pencil.png"},{"id":"07","title":"Chalk pastel","file":"images/07-chalk-pastel.png"},{"id":"08","title":"Felt applique","file":"images/08-felt-applique.png"},{"id":"09","title":"Midcentury geometry","file":"images/09-midcentury-geometric.png"},{"id":"10","title":"Two-ink risograph","file":"images/10-two-ink-print.png"},{"id":"11","title":"Soft block print","file":"images/11-soft-block-print.png"},{"id":"12","title":"Loose ink and wash","file":"images/12-loose-ink-wash.png"},{"id":"13","title":"Naive folk art","file":"images/13-folk-art.png"},{"id":"14","title":"Chunky marker","file":"images/14-chunky-marker.png"},{"id":"15","title":"Minimal dot eyes","file":"images/15-minimal-dot-eyes.png"},{"id":"16","title":"Simple gouache","file":"images/16-simple-gouache.png"}];
const API="https://us-central1-you-feed-nalu.cloudfunctions.net/milaVotes";
const KEY="mila-family-ballot-key-v1",DRAFT="mila-family-ballot-draft-v1";
const $=selector=>document.querySelector(selector);
const state={picks:new Set(),name:"",note:"",view:"all",current:0,busy:false,results:null,saved:null,token:null,hasDraft:false,writeEpoch:0};
try{state.token=localStorage.getItem(KEY);const draft=JSON.parse(localStorage.getItem(DRAFT)||"null");if(draft&&typeof draft.name==="string"&&Array.isArray(draft.selections)){state.name=draft.name.slice(0,40);state.note=typeof draft.note==="string"?draft.note.slice(0,400):"";state.picks=new Set(draft.selections.filter(id=>STYLES.some(s=>s.id===id)).slice(0,3));state.hasDraft=true;}}catch{}
if(!/^[a-f0-9]{64}$/.test(state.token||"")){state.token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");try{localStorage.setItem(KEY,state.token);}catch{}}
$("#voter-name").value=state.name;$("#voter-note").value=state.note;
function ballot(){return {name:state.name.trim(),selections:[...state.picks].sort(),note:state.note.trim()};}
function signature(value){return value?JSON.stringify({name:value.name.trim(),selections:[...value.selections].sort(),note:(value.note||"").trim()}):"";}
function persist(){try{localStorage.setItem(DRAFT,JSON.stringify(ballot()));}catch{}}
function status(message,kind=""){$("#save-status").textContent=message;$("#ballot").className="ballot"+(kind?" "+kind:"");}
function changed(){state.hasDraft=true;persist();status(state.saved?"Changes haven’t been sent yet.":"Your vote hasn’t been sent yet.");render();}
function render(){
  const picks=[...state.picks].sort();
  $("#pick-count").textContent=picks.length;$("#selection").textContent=picks.length?"Your picks: "+picks.join(", ")+" ("+picks.length+"/3)":"Choose up to 3 styles";
  document.querySelectorAll("[data-pick]").forEach(b=>{const on=state.picks.has(b.dataset.pick);b.setAttribute("aria-pressed",on);b.textContent=on?"♥":"♡";b.disabled=state.busy;});
  document.querySelectorAll(".card").forEach(card=>{const id=card.dataset.id;card.hidden=state.view==="picks"&&!state.picks.has(id);card.classList.toggle("selected",state.picks.has(id));const score=card.querySelector(".score");score.hidden=state.view!=="results";const n=state.results?.counts[id]||0,total=state.results?.totalBallots||0;score.querySelector(".score-text").textContent=state.results?(n+" "+(n===1?"vote":"votes")):"Loading…";score.querySelector(".fill").style.width=(total?Math.round(n/total*100):0)+"%";});
  document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===state.view));
  $("#empty").hidden=state.view!=="picks"||picks.length>0;
  if(state.results){const total=state.results.totalBallots;$("#voter-count").textContent=total+" "+(total===1?"family vote":"family votes")+" received";}
  $("#submit-vote").disabled=state.busy;$("#submit-vote").textContent=state.busy?"Sending…":state.saved?"Update my vote":"Send my vote";
  $("#voter-name").disabled=state.busy;$("#voter-note").disabled=state.busy;$("#withdraw").disabled=state.busy;$("#withdraw").hidden=!state.saved;
  const on=state.picks.has(STYLES[state.current].id);$("#viewer-pick").setAttribute("aria-pressed",on);$("#viewer-pick").textContent=on?"♥ Picked":"♡ Pick this";$("#viewer-pick").disabled=state.busy;
  const n=state.results?.counts[STYLES[state.current].id]||0;$("#viewer-score").textContent=state.view==="results"&&state.results?n+" "+(n===1?"vote":"votes")+" so far":"";
}
function pick(id){
  if(state.busy)return;
  if(state.picks.has(id))state.picks.delete(id);
  else{if(state.picks.size===3){$("#gallery-message").textContent="You have 3 picks. Unselect one to choose a different style.";return;}state.picks.add(id);}
  $("#gallery-message").textContent="";changed();
}
function show(index){state.current=(index+STYLES.length)%STYLES.length;const s=STYLES[state.current];$("#viewer-image").src=s.file;$("#viewer-image").alt="Mila — "+s.title;$("#viewer-title").textContent=s.id+" · "+s.title;render();if(!$("#viewer").open)$("#viewer").showModal();}
function navigate(delta){const pool=STYLES.map((s,i)=>i).filter(i=>state.view!=="picks"||state.picks.has(STYLES[i].id));if(!pool.length){$("#viewer").close();return;}let at=pool.indexOf(state.current);if(at<0)at=delta>0?-1:0;show(pool[(at+delta+pool.length)%pool.length]);}
async function request(method="GET",body){
  const response=await fetch(API,{method,headers:{Authorization:"Bearer "+state.token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Couldn’t reach voting. Please try again.");return data;
}
async function refresh(initial=false){
  const epoch=state.writeEpoch;
  try{const data=await request();if(epoch!==state.writeEpoch)return;state.results=data;if(initial){state.saved=data.ballot;if(data.ballot&&!state.hasDraft){state.picks=new Set(data.ballot.selections);state.name=data.ballot.name;state.note=data.ballot.note||"";$("#voter-name").value=state.name;$("#voter-note").value=state.note;persist();}if(data.ballot&&signature(data.ballot)===signature(ballot()))status("Your vote is saved. Thank you!","saved");else if(data.ballot)status("You have unsent changes.");}render();}
  catch{if(!state.results)$("#voter-count").textContent="Vote totals are temporarily unavailable";if(initial)status("You can choose styles now. We’ll reconnect when you send.");}
}
$("#ballot").addEventListener("submit",async event=>{
  event.preventDefault();if(state.busy)return;
  state.name=$("#voter-name").value;state.note=$("#voter-note").value;persist();
  if(!state.picks.size){status("Pick at least one style before sending.","error");return;}
  const submission=ballot();state.writeEpoch++;state.busy=true;status("Saving your vote…");render();
  try{const data=await request("POST",submission);state.results=data;state.saved=data.ballot;status("Your vote is saved. Thank you!","saved");}
  catch(error){status(error.name==="TimeoutError"?"Connection timed out. Your picks are still here; try again.":error.message,"error");}
  finally{state.busy=false;render();}
});
$("#withdraw").addEventListener("click",async()=>{if(state.busy)return;state.writeEpoch++;state.busy=true;status("Withdrawing your vote…");render();try{const data=await request("DELETE");state.results=data;state.saved=null;state.picks.clear();persist();status("Your vote was withdrawn. You can choose again.");}catch(error){status(error.message,"error");}finally{state.busy=false;render();}});
$("#voter-name").addEventListener("input",event=>{state.name=event.target.value;changed();});$("#voter-note").addEventListener("input",event=>{state.note=event.target.value;changed();});
document.querySelectorAll("[data-pick]").forEach(b=>b.addEventListener("click",()=>pick(b.dataset.pick)));document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>show(STYLES.findIndex(s=>s.id===b.dataset.open))));document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{state.view=b.dataset.view;render();if(state.view==="results")refresh();}));
$("#viewer-pick").onclick=()=>pick(STYLES[state.current].id);$("#previous").onclick=()=>navigate(-1);$("#next").onclick=()=>navigate(1);$(".close").onclick=()=>$("#viewer").close();
document.addEventListener("keydown",event=>{if(!$("#viewer").open)return;if(event.key==="ArrowRight"){event.preventDefault();navigate(1);}if(event.key==="ArrowLeft"){event.preventDefault();navigate(-1);}});
render();refresh(true);setInterval(()=>{if(!document.hidden&&!state.busy)refresh();},45000);document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!state.busy)refresh();});
