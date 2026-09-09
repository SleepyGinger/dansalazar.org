"use strict";
const STYLES=[{"id":"01","title":"Rounded flat shapes","file":"images/final/01-rounded-flat-final-v3.png"},{"id":"04","title":"Torn painted paper","file":"images/final/04-torn-paper-final-v3.png"},{"id":"05","title":"Wax crayon","file":"images/final/05-wax-crayon-final-v3.png"},{"id":"06","title":"Sparse colored pencil","file":"images/final/06-colored-pencil-final-v3.png"},{"id":"14","title":"Chunky marker","file":"images/final/14-chunky-marker-final-v3.png"},{"id":"16","title":"Simple gouache","file":"images/final/16-simple-gouache-final-v4.png"}];
const API="https://us-central1-you-feed-nalu.cloudfunctions.net/milaVotes/final";
const KEY="mila-final-ballot-key-v1",DRAFT="mila-final-ballot-draft-v1";
const $=selector=>document.querySelector(selector);
const DISPLAY_ORDER=STYLES.map((_,index)=>index);
for(let i=DISPLAY_ORDER.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[DISPLAY_ORDER[i],DISPLAY_ORDER[j]]=[DISPLAY_ORDER[j],DISPLAY_ORDER[i]];}
const cardsById=new Map([...document.querySelectorAll(".card")].map(card=>[card.dataset.id,card]));
$(".grid").replaceChildren(...DISPLAY_ORDER.map((index,position)=>{const card=cardsById.get(STYLES[index].id);card.querySelector("img").loading=position<2?"eager":"lazy";return card;}));
let displayedOrder=DISPLAY_ORDER.join(",");
const state={pick:null,name:"",step:"choose",view:"all",current:0,busy:false,results:null,saved:null,token:null,hasDraft:false,writeEpoch:0,activity:0,chooseScroll:0};
const validPick=id=>STYLES.some(s=>s.id===id);
try{
  state.token=localStorage.getItem(KEY);
  const draft=JSON.parse(localStorage.getItem(DRAFT)||"null");
  if(draft&&typeof draft.name==="string"&&Array.isArray(draft.selections)){
    state.name=draft.name.slice(0,40);state.pick=draft.selections.length===1&&validPick(draft.selections[0])?draft.selections[0]:null;state.hasDraft=true;
  }else{
    const earlier=JSON.parse(localStorage.getItem("mila-family-ballot-draft-v1")||"null");
    if(typeof earlier?.name==="string")state.name=earlier.name.slice(0,40);
  }
}catch{}
if(!/^[a-f0-9]{64}$/.test(state.token||"")){
  state.token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
  try{localStorage.setItem(KEY,state.token);}catch{}
}
$("#voter-name").value=state.name;
function ballot(){return {name:state.name.trim(),selections:state.pick?[state.pick]:[]};}
function signature(value){return value?JSON.stringify({name:value.name.trim(),selections:value.selections}):"";}
function persist(){try{localStorage.setItem(DRAFT,JSON.stringify(ballot()));}catch{}}
function status(message){$("#save-status").textContent=message;}
function pickMessage(message){$("#pick-status").textContent=message;}
function changed(){state.activity++;state.hasDraft=true;persist();status("");$("#voter-name").removeAttribute("aria-invalid");render();}
function isClosed(){return state.results?.closed===true;}
function configured(){return state.results?.poll==="mila-final-01"&&Array.isArray(state.results.eligibleStyleIds)&&[...state.results.eligibleStyleIds].sort().join(",")===STYLES.map(s=>s.id).sort().join(",");}
function canSend(){return configured()&&!isClosed();}
function thumbnail(target,id){
  target.replaceChildren();const s=STYLES.find(style=>style.id===id);if(!s)return;
  const figure=document.createElement("figure");figure.className="review-pick";
  const img=document.createElement("img");img.src=s.file;img.alt=s.title;img.width=260;img.height=260;
  const caption=document.createElement("figcaption");caption.textContent=s.id+" · "+s.title;figure.append(img,caption);target.append(figure);
}
function galleryOrder(){return state.view==="results"?[...DISPLAY_ORDER].sort((a,b)=>(state.results?.counts[STYLES[b].id]||0)-(state.results?.counts[STYLES[a].id]||0)):DISPLAY_ORDER;}
function go(step,restore=false){
  state.activity++;if(state.step==="choose"&&step!=="choose")state.chooseScroll=window.scrollY;
  state.step=step;render();$("#step-title").focus({preventScroll:true});window.scrollTo({top:restore?state.chooseScroll:0,behavior:"auto"});
}
function render(){
  const results=state.view==="results"&&state.step==="choose",closed=isClosed();
  document.body.dataset.step=state.step;document.body.dataset.results=String(results);
  for(const step of ["choose","review","thanks"])$("#"+step+"-step").hidden=state.step!==step;
  $("#continue-bar").hidden=state.step!=="choose"||results||closed;
  $("#round-status").hidden=!closed&&(!state.results||configured());
  $("#round-status").textContent=closed?"The final round is closed. You can still see the results.":"The finalists have changed. Please reload this page before voting.";
  $("#step-label").textContent=results?"Most votes first":state.step==="choose"?"Step 1 of 2 · Choose just one":state.step==="review"?"Step 2 of 2 · Add your name & send":"All done";
  $("#step-title").textContent=results?"Final-round results":state.step==="choose"?"Which one is your favorite?":state.step==="review"?"Ready to send your favorite?":"Your final vote is saved!";
  $("#step-intro").textContent=results?"One favorite per voter. These votes are separate from round one.":state.step==="choose"?"Choose ONE picture for Mila’s book. Tap your favorite, then tap Continue.":state.step==="review"?"This is your one final choice. Add your first name, then tap Send my final vote.":"Thank you! Your one favorite is saved for the final round.";
  $("#selection").textContent=state.pick?"✓ Picture "+state.pick+" chosen":"Choose one favorite";
  $("#continue").disabled=!state.pick||state.busy||closed;
  $("#continue").textContent="Continue →";
  $("#end-hint").textContent=results?"These are final-round votes only. Round-one results are linked below.":"That’s all six finalists. Choose just ONE. Tap a different picture to change your choice.";
  const order=galleryOrder(),key=order.join(",");
  if(key!==displayedOrder){$(".grid").replaceChildren(...order.map(index=>cardsById.get(STYLES[index].id)));displayedOrder=key;}
  document.querySelectorAll("[data-pick]").forEach(button=>{
    const on=state.pick===button.dataset.pick;
    if(results||closed)button.removeAttribute("aria-pressed");else button.setAttribute("aria-pressed",String(on));
    button.querySelector(".pick-label").textContent=results||closed?"Tap to look closer":on?"✓ Your ONE choice · tap to undo":"Choose this one";
    button.setAttribute("aria-label",results||closed?"Look closer at picture "+button.dataset.pick:on?"Undo picture "+button.dataset.pick:"Choose picture "+button.dataset.pick+" as your only favorite");
    button.disabled=state.busy;
  });
  document.querySelectorAll(".card").forEach(card=>{
    const id=card.dataset.id;card.classList.toggle("selected",state.pick===id&&!results);
    const score=card.querySelector(".score");score.hidden=!results;
    const n=state.results?.counts[id]||0,total=state.results?.totalBallots||0;
    score.querySelector(".score-text").textContent=state.results?n+" "+(n===1?"vote":"votes"):"Loading…";
    score.querySelector(".fill").style.width=(total?Math.round(n/total*100):0)+"%";
  });
  $("#results-toolbar").hidden=!results;$("#show-results").hidden=results;
  if(state.results)$("#voter-count").textContent=state.results.totalBallots+" final-round "+(state.results.totalBallots===1?"vote":"votes");
  $("#back-to-choosing").hidden=closed;
  $("#submit-vote").disabled=state.busy||!canSend();
  $("#submit-vote").textContent=state.busy?"Sending…":closed?"Voting is closed":state.saved?"Save my new choice":"Send my final vote";
  for(const id of ["voter-name","withdraw","back-to-pictures","edit-vote","saved-results"])$("#"+id).disabled=state.busy;
  $("#withdraw").disabled=state.busy||!canSend();$("#edit-vote").hidden=closed;
  $("#viewer-pick").setAttribute("aria-pressed",String(state.pick===STYLES[state.current].id));
  $("#viewer-pick").hidden=results||closed;$("#viewer-pick").disabled=state.busy;
  $("#viewer-pick").textContent=state.pick===STYLES[state.current].id?"✓ Your one choice · undo":"Choose this one";
  if(state.step==="review")thumbnail($("#review-picks"),state.pick);
  if(state.step==="thanks"&&state.saved){thumbnail($("#saved-picks"),state.saved.selections[0]);$("#thanks-name").textContent="Thanks, "+state.saved.name+"!";}
  if(state.step==="choose"&&!results&&!closed)document.documentElement.style.setProperty("--bar-height",$("#continue-bar").getBoundingClientRect().height+"px");
}
function pick(id){if(state.busy||state.view==="results"||isClosed()||!validPick(id))return;state.pick=state.pick===id?null:id;changed();pickMessage(state.pick?"Just one choice. Tap Continue when you’re ready.":"Tap the picture you like best.");}
function show(index){state.activity++;state.current=(index+STYLES.length)%STYLES.length;const s=STYLES[state.current];$("#viewer-image").src=s.file;$("#viewer-image").alt="Mila — "+s.title;$("#viewer-title").textContent=s.id+" · "+s.title;render();if(!$("#viewer").open)$("#viewer").showModal();}
function navigate(delta){const order=galleryOrder(),position=order.indexOf(state.current);show(order[(position+delta+order.length)%order.length]);}
async function request(method="GET",body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(API,{method,headers:{Authorization:"Bearer "+state.token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:controller.signal});
    const data=await response.json();if(!response.ok){const error=new Error(data.error||"Couldn’t send your vote. Please try again.");error.status=response.status;throw error;}return data;
  }finally{clearTimeout(timer);}
}
async function refresh(initial=false){
  const epoch=state.writeEpoch,activity=state.activity;
  try{
    const data=await request();if(epoch!==state.writeEpoch)return;state.results=data;
    if(initial){
      state.saved=data.ballot;
      if(data.ballot&&!state.hasDraft&&activity===state.activity){
        state.pick=validPick(data.ballot.selections?.[0])?data.ballot.selections[0]:null;state.name=data.ballot.name;$("#voter-name").value=state.name;persist();
      }
      if(data.ballot&&signature(data.ballot)===signature(ballot())&&activity===state.activity)state.step="thanks";
    }
    if(isClosed()&&state.step!=="thanks"){state.step="choose";state.view="results";}
    render();
  }catch{
    if(!state.results)$("#voter-count").textContent="Vote totals aren’t available right now.";
    if(initial&&activity===state.activity)pickMessage("You can choose now. Reconnect or reload before sending.");
  }
}
$("#continue").onclick=()=>{if(state.pick&&!state.busy&&!isClosed()){status(canSend()?"":"Connecting to voting…");go("review");if(!canSend())refresh().then(()=>{if(!canSend())status("Voting hasn’t connected yet. Please reload when you’re online; your choice is saved on this device.");else status("");});}};
$("#back-to-pictures").onclick=()=>{if(!state.busy)go("choose",true);};
$("#edit-vote").onclick=()=>{if(!state.busy&&!isClosed()){state.view="all";pickMessage("Tap another picture to replace your choice, then Continue.");go("choose");}};
function showResults(){state.view="results";go("choose");refresh();}
$("#show-results").onclick=showResults;$("#saved-results").onclick=showResults;
$("#back-to-choosing").onclick=()=>{state.view="all";render();};
$("#ballot").addEventListener("submit",async event=>{
  event.preventDefault();if(state.busy)return;
  state.name=$("#voter-name").value;persist();
  if(!state.pick){go("choose");pickMessage("Choose ONE favorite before sending.");return;}
  if(!state.name.trim()){status("Please add your first name.");$("#voter-name").setAttribute("aria-invalid","true");$("#voter-name").focus();return;}
  if(!canSend()){status(isClosed()?"Voting is closed.":"Voting hasn’t connected yet. Please reload when you’re online.");return;}
  const submission=ballot();state.writeEpoch++;state.busy=true;status("Sending your vote…");render();$("#voter-name").blur();
  try{
    const data=await request("POST",submission);
    if(signature(data.ballot)!==signature(submission))throw new Error("The saved choice could not be verified. Please try again.");
    state.results=data;state.saved=data.ballot;state.hasDraft=true;persist();status("");go("thanks");
  }catch(error){
    if(error.status===409){state.results={...state.results,closed:true};}
    status(error.name==="AbortError"?"Your connection is slow. Your choice is still here. Tap send to try again.":"Your vote hasn’t been confirmed. "+error.message);
  }finally{state.busy=false;render();}
});
$("#withdraw").onclick=async()=>{
  if(state.busy||!canSend()||!window.confirm("Remove your saved final vote? Your round-one vote will not change."))return;
  state.writeEpoch++;state.busy=true;$("#withdraw-status").textContent="Removing your final vote…";render();
  try{const data=await request("DELETE");state.results=data;state.saved=null;state.pick=null;persist();$("#withdraw-status").textContent="";state.view="all";go("choose");pickMessage("Your final vote was removed. You can choose again.");}
  catch(error){if(error.status===409)state.results={...state.results,closed:true};$("#withdraw-status").textContent=error.status===409?"Voting is closed.":"Couldn’t remove your vote. Please try again.";}
  finally{state.busy=false;render();}
};
$("#voter-name").addEventListener("input",event=>{state.name=event.target.value;changed();});
document.querySelectorAll("[data-pick]").forEach(button=>button.addEventListener("click",()=>state.view==="results"||isClosed()?show(STYLES.findIndex(s=>s.id===button.dataset.pick)):pick(button.dataset.pick)));
document.querySelectorAll("[data-open]").forEach(button=>button.addEventListener("click",()=>show(STYLES.findIndex(s=>s.id===button.dataset.open))));
$("#viewer-pick").onclick=()=>pick(STYLES[state.current].id);
$("#previous").onclick=()=>navigate(-1);$("#next").onclick=()=>navigate(1);$(".close").onclick=()=>$("#viewer").close();
document.addEventListener("keydown",event=>{if(!$("#viewer").open)return;if(event.key==="ArrowRight"){event.preventDefault();navigate(1);}if(event.key==="ArrowLeft"){event.preventDefault();navigate(-1);}});
let firstOwnerPress=null;
$("#owner-access").addEventListener("click",()=>{const now=Date.now();if(firstOwnerPress!==null&&now-firstOwnerPress<=900){firstOwnerPress=null;window.location.assign("admin/");}else firstOwnerPress=now;});
if(typeof ResizeObserver!=="undefined")new ResizeObserver(()=>{if(state.step==="choose")document.documentElement.style.setProperty("--bar-height",$("#continue-bar").getBoundingClientRect().height+"px");}).observe($("#continue-bar"));
$(".grid").hidden=false;$("#gallery-loading").hidden=true;render();refresh(true);
setInterval(()=>{if(!document.hidden&&!state.busy)refresh();},45000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!state.busy)refresh();});
