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
const RANKS=["1st","2nd","3rd"];
let displayedOrder=DISPLAY_ORDER.join(",");
const state={picks:new Set(),name:"",step:"choose",view:"all",current:0,busy:false,results:null,saved:null,token:null,hasDraft:false,legacyChoices:[],writeEpoch:0,activity:0,chooseScroll:0};
try{
  state.token=localStorage.getItem(KEY);
  const draft=JSON.parse(localStorage.getItem(DRAFT)||"null");
  if(draft&&typeof draft.name==="string"&&Array.isArray(draft.selections)){
    state.name=draft.name.slice(0,40);
    if(Array.isArray(draft.ranking)){
      state.picks=new Set(draft.ranking.filter(id=>STYLES.some(s=>s.id===id)).slice(0,3));
      state.hasDraft=true;
    }else state.legacyChoices=draft.selections.filter(id=>STYLES.some(s=>s.id===id)).slice(0,3);
  }
}catch{}
if(!/^[a-f0-9]{64}$/.test(state.token||"")){
  state.token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
  try{localStorage.setItem(KEY,state.token);}catch{}
}
$("#voter-name").value=state.name;
function ballot(){return {name:state.name.trim(),selections:[...state.picks].sort(),ranking:[...state.picks]};}
function signature(value){return value?JSON.stringify({name:value.name.trim(),selections:[...value.selections].sort(),ranking:value.ranking||null}):"";}
function persist(){try{localStorage.setItem(DRAFT,JSON.stringify(ballot()));}catch{}}
function status(message){$("#save-status").textContent=message;}
function pickMessage(message,error=false){$("#pick-status").textContent=message;$("#pick-status").classList.toggle("error",error);$("#viewer-message").textContent=error?message:"";}
function changed(){state.activity++;state.hasDraft=true;persist();status("");$("#voter-name").removeAttribute("aria-invalid");render();}
function thumbnails(target,selections,editable=false,ranked=true){
  target.replaceChildren();
  for(const [index,id] of selections.entries()){
    const s=STYLES.find(style=>style.id===id);if(!s)continue;
    const figure=document.createElement("figure");figure.className="review-pick";
    const img=document.createElement("img");img.src=s.file;img.alt=s.title;img.width=160;img.height=160;
    const rank=document.createElement("strong");rank.className="review-rank";rank.textContent=ranked?RANKS[index]+(index===0?" · Top choice":" choice"):"Earlier choice";
    const caption=document.createElement("figcaption");caption.textContent=s.id+" · "+s.title;
    figure.append(rank,img,caption);
    if(editable){
      const up=document.createElement("button");up.type="button";up.className="move-up";up.dataset.moveUp=id;up.textContent="↑ Move up";up.disabled=state.busy||index===0;
      up.setAttribute("aria-label","Move picture "+id+" up one place");
      up.onclick=()=>{if(state.busy||index===0)return;const order=[...state.picks];[order[index-1],order[index]]=[order[index],order[index-1]];state.picks=new Set(order);changed();[...document.querySelectorAll("[data-move-up]")].find(button=>button.dataset.moveUp===id)?.focus();};
      figure.append(up);
    }
    target.append(figure);
  }
}
function galleryOrder(){
  return state.view==="results"?[...DISPLAY_ORDER].sort((a,b)=>(state.results?.counts[STYLES[b].id]||0)-(state.results?.counts[STYLES[a].id]||0)):DISPLAY_ORDER;
}
function nextChoiceMessage(){return state.picks.size===3?"All 3 chosen. Tap Review & send.":"Now tap your "+RANKS[state.picks.size]+(state.picks.size===0?" choice — your favorite picture.":" favorite picture.");}
function go(step,restore=false){
  state.activity++;
  if(state.step==="choose"&&step!=="choose")state.chooseScroll=window.scrollY;
  state.step=step;render();$("#step-title").focus({preventScroll:true});
  window.scrollTo({top:restore?state.chooseScroll:0,behavior:"auto"});
}
function render(){
  const picks=[...state.picks],results=state.view==="results"&&state.step==="choose";
  document.body.dataset.step=state.step;
  for(const step of ["choose","review","thanks"])$("#"+step+"-step").hidden=state.step!==step;
  $("#continue-bar").hidden=state.step!=="choose"||results;
  $("#step-label").textContent=results?"Most votes first":state.step==="choose"?"Step 1 of 2 · Rank 3 pictures":state.step==="review"?"Step 2 of 2 · Check your order & send":"All done";
  $("#step-title").textContent=results?"Family results":state.step==="choose"?"Choose your top 3 pictures":state.step==="review"?"Is this your favorite order?":"Your vote is saved!";
  $("#step-intro").textContent=results?"Sorted by total votes. Every chosen picture counts once, including earlier votes.":state.step==="choose"?"First tap your favorite picture. Then choose a 2nd and a 3rd favorite. All three are needed before you send.":state.step==="review"?"Your favorite goes first. Use Move up to change the order, then add your name and send.":state.saved?.ranking?"Your 1st, 2nd and 3rd choices are saved. Thank you!":"This is your earlier vote, without a ranking. You can choose your top 3 to update it, or remove it under More options.";
  $("#selection").textContent=picks.length+" of 3 chosen";
  $("#continue").disabled=picks.length!==3||state.busy;
  $("#continue").textContent=picks.length===3?"Review & send →":"Choose all 3";
  const legacy=state.saved&&!state.saved.ranking;
  $("#legacy-vote").hidden=!legacy||results;
  $("#legacy-view").hidden=!legacy||results;
  $("#legacy-vote").textContent=legacy?"Your earlier vote is still saved (picture"+(state.saved.selections.length===1?" ":"s ")+state.saved.selections.join(", ")+"). Choose a 1st, 2nd and 3rd favorite to update it.":"";
  for(let index=0;index<3;index++){
    const chosen=STYLES.find(s=>s.id===picks[index]),image=$("#rank-image-"+index);
    image.hidden=!chosen;if(chosen){image.src=chosen.file;image.alt=RANKS[index]+" choice: "+chosen.title;}
    $("#rank-slot-"+index).textContent=chosen?"Picture "+chosen.id:index===picks.length?"Choose now":"Not chosen";
    $("#rank-choice-"+index).classList.toggle("next",index===picks.length);
  }
  $("#end-hint").textContent=results?"Totals include all family votes. Rank your favorites on the voting page.":"That’s all 16 pictures. Choose your 1st, 2nd and 3rd favorites, then tap Review & send.";
  const order=galleryOrder(),key=order.join(",");
  if(key!==displayedOrder){$(".grid").replaceChildren(...order.map(index=>cardsById.get(STYLES[index].id)));displayedOrder=key;}
  document.querySelectorAll("[data-pick]").forEach(button=>{
    const on=state.picks.has(button.dataset.pick);
    if(results)button.removeAttribute("aria-pressed");else button.setAttribute("aria-pressed",String(on));
    button.querySelector(".pick-label").textContent=results?"Tap to look closer":on?"✓ "+RANKS[picks.indexOf(button.dataset.pick)]+" choice · tap to undo":picks.length===3?"Undo a choice first":"Tap for "+RANKS[picks.length]+" choice";
    button.setAttribute("aria-label",results?"Look closer at picture "+button.dataset.pick:on?"Remove picture "+button.dataset.pick+", your "+RANKS[picks.indexOf(button.dataset.pick)]+" choice":"Choose picture "+button.dataset.pick+(picks.length<3?" as your "+RANKS[picks.length]+" choice":""));
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
  $("#edit-vote").textContent=legacy?"Choose my top 3":"Change my choices";
  const on=state.picks.has(STYLES[state.current].id);
  $("#viewer-pick").setAttribute("aria-pressed",String(on));
  $("#viewer-pick").hidden=state.view==="results";
  $("#viewer-pick").textContent=on?"✓ "+RANKS[picks.indexOf(STYLES[state.current].id)]+" choice · undo":picks.length===3?"Undo a choice first":"Choose as "+RANKS[picks.length]+" favorite";
  $("#viewer-pick").disabled=state.busy;
  if(state.step==="review")thumbnails($("#review-picks"),picks,true);
  if(state.step==="thanks"&&state.saved){
    thumbnails($("#saved-picks"),state.saved.ranking||state.saved.selections,false,!!state.saved.ranking);
    $("#thanks-name").textContent="Thanks, "+state.saved.name+"!";
  }
  // Reserve the real bar height, including larger text and the iPhone safe area.
  document.body.dataset.results=String(results);
  if(state.step==="choose"&&!results)document.documentElement.style.setProperty("--bar-height",$("#continue-bar").getBoundingClientRect().height+"px");
}
function pick(id){
  if(state.busy||state.view==="results")return;
  if(state.picks.has(id))state.picks.delete(id);
  else{
    if(state.picks.size===3){pickMessage("You have all 3 choices. Tap a chosen picture to undo it first.",true);return;}
    state.picks.add(id);
  }
  changed();
  pickMessage(nextChoiceMessage());
}
function show(index){
  state.activity++;
  state.current=(index+STYLES.length)%STYLES.length;
  const s=STYLES[state.current];$("#viewer-image").src=s.file;$("#viewer-image").alt="Mila — "+s.title;
  $("#viewer-title").textContent=s.id+" · "+s.title;$("#viewer-message").textContent="";
  render();if(!$("#viewer").open)$("#viewer").showModal();
}
function navigate(delta){
  const order=galleryOrder(),position=order.indexOf(state.current);
  show(order[(position+delta+order.length)%order.length]);
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
      if(data.ballot?.ranking&&!state.hasDraft){
        state.picks=new Set(data.ballot.ranking);state.name=data.ballot.name;$("#voter-name").value=state.name;persist();
      }
      if(data.ballot&&!state.name){state.name=data.ballot.name;$("#voter-name").value=state.name;}
      if(data.ballot?.ranking&&signature(data.ballot)===signature(ballot())&&activity===state.activity){
        state.step="thanks";
      }
    }
    render();
  }catch{
    if(!state.results)$("#voter-count").textContent="Vote totals aren’t available right now.";
    if(initial&&activity===state.activity)pickMessage("You can choose pictures now. Try sending when you’re connected.");
  }
}
$("#continue").onclick=()=>{if(state.picks.size===3&&!state.busy){status("");go("review");}};
$("#back-to-pictures").onclick=()=>{if(!state.busy)go("choose",true);};
$("#edit-vote").onclick=()=>{if(!state.busy){state.view="all";pickMessage(state.picks.size?"Tap a chosen picture to undo it. You can change the order on the next page.":nextChoiceMessage());go("choose");}};
$("#legacy-view").onclick=()=>{if(state.saved&&!state.busy)go("thanks");};
function showResults(){state.view="results";go("choose");refresh();}
$("#show-results").onclick=showResults;$("#saved-results").onclick=showResults;
$("#back-to-choosing").onclick=()=>{state.view="all";pickMessage(nextChoiceMessage());render();};
$("#ballot").addEventListener("submit",async event=>{
  event.preventDefault();if(state.busy)return;
  state.name=$("#voter-name").value;persist();
  if(state.picks.size!==3){go("choose");pickMessage("Choose your 1st, 2nd and 3rd favorites before sending.",true);return;}
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
document.querySelectorAll("[data-pick]").forEach(button=>button.addEventListener("click",()=>state.view==="results"?show(STYLES.findIndex(s=>s.id===button.dataset.pick)):pick(button.dataset.pick)));
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
pickMessage(nextChoiceMessage());
render();refresh(true);
setInterval(()=>{if(!document.hidden&&!state.busy)refresh();},45000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!state.busy)refresh();});
