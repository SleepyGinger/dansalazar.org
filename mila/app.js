"use strict";
const STYLES=[{"id":"01","title":"Rounded flat shapes","file":"images/01-rounded-flat.png"},{"id":"02","title":"Bold outline cartoon","file":"images/02-bold-outline.png"},{"id":"03","title":"Cut-paper collage","file":"images/03-cut-paper.png"},{"id":"04","title":"Torn painted paper","file":"images/04-torn-paper.png"},{"id":"05","title":"Wax crayon","file":"images/05-wax-crayon.png"},{"id":"06","title":"Sparse colored pencil","file":"images/06-colored-pencil.png"},{"id":"07","title":"Chalk pastel","file":"images/07-chalk-pastel.png"},{"id":"08","title":"Felt applique","file":"images/08-felt-applique.png"},{"id":"09","title":"Midcentury geometry","file":"images/09-midcentury-geometric.png"},{"id":"10","title":"Two-ink risograph","file":"images/10-two-ink-print.png"},{"id":"11","title":"Soft block print","file":"images/11-soft-block-print.png"},{"id":"12","title":"Loose ink and wash","file":"images/12-loose-ink-wash.png"},{"id":"13","title":"Naive folk art","file":"images/13-folk-art.png"},{"id":"14","title":"Chunky marker","file":"images/14-chunky-marker.png"},{"id":"15","title":"Minimal dot eyes","file":"images/15-minimal-dot-eyes.png"},{"id":"16","title":"Simple gouache","file":"images/16-simple-gouache.png"}];
const API="https://us-central1-you-feed-nalu.cloudfunctions.net/milaVotes";
const KEY="mila-family-ballot-key-v1",DRAFT="mila-family-ballot-draft-v1";
const $=selector=>document.querySelector(selector);
// Shuffle presentation once per page load; stable style IDs still identify every vote.
const DISPLAY_ORDER=STYLES.map((_,index)=>index);
for(let i=DISPLAY_ORDER.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [DISPLAY_ORDER[i],DISPLAY_ORDER[j]]=[DISPLAY_ORDER[j],DISPLAY_ORDER[i]];
}
const cardsById=new Map([...document.querySelectorAll(".card")].map(card=>[card.dataset.id,card]));
$(".grid").replaceChildren(...DISPLAY_ORDER.map((index,position)=>{
  const card=cardsById.get(STYLES[index].id);
  card.querySelector("img").loading=position<2?"eager":"lazy";
  return card;
}));
const state={picks:new Set(),name:"",step:"choose",view:"all",current:0,busy:false,results:null,saved:null,token:null,hasDraft:false,writeEpoch:0,activity:0,chooseScroll:0};
try{
  state.token=localStorage.getItem(KEY);
  const draft=JSON.parse(localStorage.getItem(DRAFT)||"null");
  if(draft&&typeof draft.name==="string"&&Array.isArray(draft.selections)){
    state.name=draft.name.slice(0,40);
    state.picks=new Set(draft.selections.filter(id=>STYLES.some(s=>s.id===id)).slice(0,3));
    state.hasDraft=true;
  }
}catch{}
if(!/^[a-f0-9]{64}$/.test(state.token||"")){
  state.token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
  try{localStorage.setItem(KEY,state.token);}catch{}
}
$("#voter-name").value=state.name;
function ballot(){return {name:state.name.trim(),selections:[...state.picks].sort()};}
function signature(value){return value?JSON.stringify({name:value.name.trim(),selections:[...value.selections].sort()}):"";}
function persist(){try{localStorage.setItem(DRAFT,JSON.stringify(ballot()));}catch{}}
function status(message){$("#save-status").textContent=message;}
function pickMessage(message,error=false){$("#pick-status").textContent=message;$("#pick-status").classList.toggle("error",error);$("#viewer-message").textContent=error?message:"";}
function changed(){state.activity++;state.hasDraft=true;persist();status("");$("#voter-name").removeAttribute("aria-invalid");render();}
function thumbnails(target,selections){
  target.replaceChildren();
  for(const id of selections){
    const s=STYLES.find(style=>style.id===id);if(!s)continue;
    const figure=document.createElement("figure");figure.className="review-pick";
    const img=document.createElement("img");img.src=s.file;img.alt=s.title;img.width=160;img.height=160;
    const caption=document.createElement("figcaption");caption.textContent=s.id+" · "+s.title;
    figure.append(img,caption);target.append(figure);
  }
}
function go(step,restore=false){
  state.activity++;
  if(state.step==="choose"&&step!=="choose")state.chooseScroll=window.scrollY;
  state.step=step;render();$("#step-title").focus({preventScroll:true});
  window.scrollTo({top:restore?state.chooseScroll:0,behavior:"auto"});
}
function render(){
  const picks=[...state.picks].sort();
  document.body.dataset.step=state.step;
  for(const step of ["choose","review","thanks"])$("#"+step+"-step").hidden=state.step!==step;
  $("#continue-bar").hidden=state.step!=="choose";
  $("#step-label").textContent=state.step==="choose"?"Step 1 of 2 · Choose pictures":state.step==="review"?"Step 2 of 2 · Send your vote":"All done";
  $("#step-title").textContent=state.step==="choose"?"Which pictures feel like Mila?":state.step==="review"?"Almost done!":"Your vote is saved!";
  $("#step-intro").textContent=state.step==="choose"?"Tap 1, 2, or 3 favorites. Then tap Continue.":state.step==="review"?"Add your first name, then send your vote.":"Thank you for helping with Mila’s book. You’re all done.";
  $("#selection").textContent=picks.length?picks.length+" "+(picks.length===1?"picture chosen":"pictures chosen"):"Choose your favorites";
  $("#continue").disabled=!picks.length||state.busy;
  document.querySelectorAll("[data-pick]").forEach(button=>{
    const on=state.picks.has(button.dataset.pick);
    button.setAttribute("aria-pressed",String(on));
    button.querySelector(".pick-label").textContent=on?"✓ Chosen · tap to undo":"Tap to choose";
    button.disabled=state.busy;
  });
  document.querySelectorAll(".card").forEach(card=>{
    const id=card.dataset.id;card.classList.toggle("selected",state.picks.has(id));
    const score=card.querySelector(".score");score.hidden=state.view!=="results";
    const n=state.results?.counts[id]||0,total=state.results?.totalBallots||0;
    score.querySelector(".score-text").textContent=state.results?n+" "+(n===1?"vote":"votes"):"Loading…";
    score.querySelector(".fill").style.width=(total?Math.round(n/total*100):0)+"%";
  });
  $("#results-toolbar").hidden=state.view!=="results";
  if(state.results)$("#voter-count").textContent=state.results.totalBallots+" family "+(state.results.totalBallots===1?"vote":"votes");
  $("#show-results").hidden=state.view==="results";
  $("#submit-vote").disabled=state.busy;
  $("#submit-vote").textContent=state.busy?"Sending…":state.saved?"Save my changes":"Send my vote";
  for(const id of ["voter-name","withdraw","back-to-pictures","edit-vote","saved-results"])$("#"+id).disabled=state.busy;
  const on=state.picks.has(STYLES[state.current].id);
  $("#viewer-pick").setAttribute("aria-pressed",String(on));
  $("#viewer-pick").textContent=on?"✓ Chosen · tap to undo":"Choose this picture";
  $("#viewer-pick").disabled=state.busy;
  if(state.step==="review")thumbnails($("#review-picks"),picks);
  if(state.step==="thanks"&&state.saved){
    thumbnails($("#saved-picks"),state.saved.selections);
    $("#thanks-name").textContent="Thanks, "+state.saved.name+"!";
  }
  // Reserve the real bar height, including larger text and the iPhone safe area.
  if(state.step==="choose")document.documentElement.style.setProperty("--bar-height",$("#continue-bar").getBoundingClientRect().height+"px");
}
function pick(id){
  if(state.busy)return;
  if(state.picks.has(id))state.picks.delete(id);
  else{
    if(state.picks.size===3){pickMessage("You have 3. Tap a chosen picture to undo it first.",true);return;}
    state.picks.add(id);
  }
  changed();
  pickMessage(state.picks.size===3?"Ready? Tap Continue.":state.picks.size?"Choose more, or tap Continue.":"Tap a picture to choose it.");
}
function show(index){
  state.activity++;
  state.current=(index+STYLES.length)%STYLES.length;
  const s=STYLES[state.current];$("#viewer-image").src=s.file;$("#viewer-image").alt="Mila — "+s.title;
  $("#viewer-title").textContent=s.id+" · "+s.title;$("#viewer-message").textContent="";
  render();if(!$("#viewer").open)$("#viewer").showModal();
}
function navigate(delta){
  const position=DISPLAY_ORDER.indexOf(state.current);
  show(DISPLAY_ORDER[(position+delta+DISPLAY_ORDER.length)%DISPLAY_ORDER.length]);
}
async function request(method="GET",body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(API,{method,headers:{Authorization:"Bearer "+state.token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:controller.signal});
    const data=await response.json();if(!response.ok)throw new Error(data.error||"Couldn’t send your vote. Please try again.");return data;
  }finally{clearTimeout(timer);}
}
async function refresh(initial=false){
  const epoch=state.writeEpoch,activity=state.activity;
  try{
    const data=await request();if(epoch!==state.writeEpoch)return;state.results=data;
    if(initial){
      state.saved=data.ballot;
      if(data.ballot&&!state.hasDraft){
        state.picks=new Set(data.ballot.selections);state.name=data.ballot.name;$("#voter-name").value=state.name;persist();
      }
      if(data.ballot&&signature(data.ballot)===signature(ballot())&&activity===state.activity){
        state.step="thanks";
      }
    }
    render();
  }catch{
    if(!state.results)$("#voter-count").textContent="Vote totals aren’t available right now.";
    if(initial&&activity===state.activity)pickMessage("You can choose pictures now. Try sending when you’re connected.");
  }
}
$("#continue").onclick=()=>{if(state.picks.size&&!state.busy){status("");go("review");}};
$("#back-to-pictures").onclick=()=>{if(!state.busy)go("choose",true);};
$("#edit-vote").onclick=()=>{if(!state.busy){state.view="all";pickMessage("Tap a chosen picture to undo it, or choose another.");go("choose");}};
function showResults(){state.view="results";go("choose");refresh();}
$("#show-results").onclick=showResults;$("#saved-results").onclick=showResults;
$("#back-to-choosing").onclick=()=>{state.view="all";render();};
$("#ballot").addEventListener("submit",async event=>{
  event.preventDefault();if(state.busy)return;
  state.name=$("#voter-name").value;persist();
  if(!state.picks.size){go("choose");pickMessage("Choose at least one picture.",true);return;}
  if(!state.name.trim()){status("Please add your first name.");$("#voter-name").setAttribute("aria-invalid","true");$("#voter-name").focus();return;}
  const submission=ballot();state.writeEpoch++;state.busy=true;status("Sending your vote…");render();$("#voter-name").blur();
  try{
    const data=await request("POST",submission);
    state.results=data;state.saved=data.ballot;state.hasDraft=true;persist();
    status("");go("thanks");
  }catch(error){
    status(error.name==="AbortError"?"Your connection is slow. Your choices are still here. Tap send to try again.":"Your vote hasn’t been confirmed. "+error.message);
  }finally{state.busy=false;render();}
});
$("#withdraw").onclick=async()=>{
  if(state.busy||!window.confirm("Remove your saved vote? You can vote again afterward."))return;
  state.writeEpoch++;state.busy=true;$("#withdraw-status").textContent="Removing your vote…";render();
  try{
    const data=await request("DELETE");state.results=data;state.saved=null;state.picks.clear();persist();
    $("#withdraw-status").textContent="";state.view="all";go("choose");pickMessage("Your vote was removed. You can choose again.");
  }catch(error){$("#withdraw-status").textContent="Couldn’t remove your vote. Please try again.";}
  finally{state.busy=false;render();}
};
$("#voter-name").addEventListener("input",event=>{state.name=event.target.value;changed();});
document.querySelectorAll("[data-pick]").forEach(button=>button.addEventListener("click",()=>pick(button.dataset.pick)));
document.querySelectorAll("[data-open]").forEach(button=>button.addEventListener("click",()=>show(STYLES.findIndex(s=>s.id===button.dataset.open))));
$("#viewer-pick").onclick=()=>pick(STYLES[state.current].id);
$("#previous").onclick=()=>navigate(-1);$("#next").onclick=()=>navigate(1);
$(".close").onclick=()=>$("#viewer").close();
document.addEventListener("keydown",event=>{
  if(!$("#viewer").open)return;
  if(event.key==="ArrowRight"){event.preventDefault();navigate(1);}
  if(event.key==="ArrowLeft"){event.preventDefault();navigate(-1);}
});
// Discreet entry only; the admin API still requires the owner's verified Google sign-in.
let firstOwnerPress=null;
$("#owner-access").addEventListener("click",()=>{
  const now=Date.now();
  if(firstOwnerPress!==null&&now-firstOwnerPress<=900){firstOwnerPress=null;window.location.assign("admin/");}
  else firstOwnerPress=now;
});
if(typeof ResizeObserver!=="undefined")new ResizeObserver(()=>{
  if(state.step==="choose")document.documentElement.style.setProperty("--bar-height",$("#continue-bar").getBoundingClientRect().height+"px");
}).observe($("#continue-bar"));
$(".grid").hidden=false;$("#gallery-loading").hidden=true;
render();refresh(true);
setInterval(()=>{if(!document.hidden&&!state.busy)refresh();},45000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!state.busy)refresh();});
