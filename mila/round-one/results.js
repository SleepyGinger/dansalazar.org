"use strict";
const API="https://us-central1-you-feed-nalu.cloudfunctions.net/milaVotes";
const STYLES=[{"id":"01","title":"Rounded flat shapes","file":"01-rounded-flat.png"},{"id":"02","title":"Bold outline cartoon","file":"02-bold-outline.png"},{"id":"03","title":"Cut-paper collage","file":"03-cut-paper.png"},{"id":"04","title":"Torn painted paper","file":"04-torn-paper.png"},{"id":"05","title":"Wax crayon","file":"05-wax-crayon.png"},{"id":"06","title":"Sparse colored pencil","file":"06-colored-pencil.png"},{"id":"07","title":"Chalk pastel","file":"07-chalk-pastel.png"},{"id":"08","title":"Felt applique","file":"08-felt-applique.png"},{"id":"09","title":"Midcentury geometry","file":"09-midcentury-geometric.png"},{"id":"10","title":"Two-ink risograph","file":"10-two-ink-print.png"},{"id":"11","title":"Soft block print","file":"11-soft-block-print.png"},{"id":"12","title":"Loose ink and wash","file":"12-loose-ink-wash.png"},{"id":"13","title":"Naive folk art","file":"13-folk-art.png"},{"id":"14","title":"Chunky marker","file":"14-chunky-marker.png"},{"id":"15","title":"Minimal dot eyes","file":"15-minimal-dot-eyes.png"},{"id":"16","title":"Simple gouache","file":"16-simple-gouache.png"}];
const $=selector=>document.querySelector(selector);
let busy=false,hasResults=false;
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function render(data){
  const cards=[...STYLES].sort((a,b)=>(data.counts[b.id]||0)-(data.counts[a.id]||0)||a.id.localeCompare(b.id)).map((style,index)=>{
    const votes=data.counts[style.id]||0,card=element("article","card");card.dataset.id=style.id;
    const link=element("a","art");link.href="../images/"+style.file;link.target="_blank";link.rel="noopener";link.setAttribute("aria-label","Look closer at picture "+style.id+": "+style.title);
    const img=element("img");img.src=link.href;img.alt=style.title;img.width=1254;img.height=1254;img.loading=index<2?"eager":"lazy";link.append(img);
    const caption=element("div","caption"),title=element("h2");title.append(element("span","number",style.id+" · "),document.createTextNode(style.title));caption.append(title);
    const score=element("div","score");score.append(element("strong","",votes+" "+(votes===1?"vote":"votes")+(votes>=2?" · Finalist":"")));
    const track=element("span","track"),fill=element("span","fill");fill.style.width=(data.totalBallots?Math.min(100,Math.round(votes/data.totalBallots*100)):0)+"%";track.setAttribute("aria-hidden","true");track.append(fill);score.append(track);
    card.append(link,caption,score);return card;
  });
  $("#results").replaceChildren(...cards);
  $("#voter-count").textContent=data.totalBallots+" family "+(data.totalBallots===1?"ballot":"ballots")+" · Round one complete";
}
async function loadResults(){
  if(busy)return;busy=true;$("#refresh").disabled=true;$("#results-status").textContent="Loading first-round results…";
  try{
    // Public totals only: no browser vote key, names, or write requests.
    const response=await fetch(API,{method:"GET",cache:"no-store",signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error("Couldn’t load results. Please try again.");
    const data=await response.json();
    if(data.poll!=="mila-round-01"||!Number.isInteger(data.totalBallots)||data.totalBallots<0||!data.counts||!STYLES.every(style=>Number.isInteger(data.counts[style.id])&&data.counts[style.id]>=0))throw new Error("The results are unavailable. Please try again.");
    render(data);hasResults=true;$("#results-status").textContent="";
  }catch(error){$("#results-status").textContent=error.name==="TimeoutError"?"The request timed out. Tap Refresh results to try again.":error.message;if(!hasResults)$("#voter-count").textContent="Results unavailable";}
  finally{busy=false;$("#refresh").disabled=false;}
}
$("#refresh").addEventListener("click",loadResults);
loadResults();
