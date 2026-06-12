const fs=require("fs"),path=require("path");
const DATA="./.claude/specs/cards-data";
function parseTsv(p){const raw=fs.readFileSync(p,"utf8").replace(/\r/g,"");const lines=raw.split("\n").filter(l=>l.length>0);if(!lines.length)return[];const h=lines[0].split("\t");return lines.slice(1).map(line=>{const c=line.split("\t");const r={};h.forEach((k,i)=>r[k]=c[i]??"");return r;});}
const kinds=["character","event","case","partner"];
const cat={};
for(const pkg of fs.readdirSync(DATA)){if(!/^(ct-[dp]\d\d|pr-\d\d)$/.test(pkg))continue;for(const k of kinds){const p=path.join(DATA,pkg,k+".tsv");if(!fs.existsSync(p))continue;for(const r of parseTsv(p)){if(!r.cardNum)continue;r.kind=k;r.pkg=pkg;cat[r.cardNum]=r;}}}
const gc=JSON.parse(fs.readFileSync(".claude/specs/catalog-survey-2026-06-06/classification-complete.json","utf8")).greenCandidate;
const rtc=JSON.parse(fs.readFileSync(".claude/specs/catalog-survey-2026-06-06/remaining-to-classify.json","utf8"));
const byRep={};for(const t of rtc.todo)byRep[t.rep]=t;
function rec(num){const c=cat[num];if(!c)return null;return {id:num,pkg:c.pkg,kind:c.kind,title:c.title,no:(c.cardId||"")+"/"+num,imageUrl:c.imagePath||"",color:c.color||"",level:c.level||"",ap:c.ap||"",lp:c.lp||"",rarity:c.rarity||"",features:c.features||"",effect:c.effect||"",cutIn:c.cutIn||"",hirameki:c.hirameki||"",henso:c.henso||""};}
const out=[];
const kindDist={};
for(const e of gc){
  const r=rec(e.rep); if(!r){console.error("MISSING",e.rep);continue;}
  kindDist[r.kind]=(kindDist[r.kind]||0)+1;
  const memNums=(byRep[e.rep]?byRep[e.rep].members:[e.rep]);
  const members=memNums.map(rec).filter(Boolean);
  out.push({rep:e.rep,size:e.size,kind:r.kind,title:r.title,repRecord:r,members});
}
fs.writeFileSync(".claude/specs/catalog-survey-2026-06-06/green-candidates-enriched.json",JSON.stringify(out,null,1));
console.log("enriched reps:",out.length);
console.log("kind distribution (reps):",JSON.stringify(kindDist));
console.log("total member-cards:",out.reduce((s,o)=>s+o.members.length,0));
// quick text-feature buckets for pre-grouping
const feat=(t)=>{const s=[t.effect,t.cutIn,t.hirameki,t.henso].join(" ");const tags=[];
  if(/【登場時】/.test(s))tags.push("enter");
  if(/【宣言】/.test(s))tags.push("declared");
  if(/【ヒラメキ】/.test(s))tags.push("hirameki");
  if(/【現場リムーブ時】/.test(s))tags.push("leaveRemove");
  if(/【変装時】|〚変装〛/.test(s))tags.push("disguise");
  if(/【カットイン】|〚カットイン〛/.test(s)||t.cutIn)tags.push("cutin");
  if(/リムーブ.*登場|リムーブ.*現場に登場/.test(s))tags.push("reanimate");
  if(/上から.*枚(見る|公開|リムーブ)/.test(s))tags.push("lookN");
  if(/手札に加える/.test(s))tags.push("toHand");
  if(/スリープ状態で登場/.test(s))tags.push("enterSleep");
  if(/〚突撃〛|〚迅速〛|〚疾風|〚ブレット〛/.test(s))tags.push("keyword");
  if(t.kind==="event")tags.push("EVENT");
  if(t.kind==="case")tags.push("CASE");
  return tags.length?tags.join("+"):"OTHER";};
const bDist={};for(const o of out){const b=feat(o.repRecord);bDist[b]=(bDist[b]||0)+1;}
const sorted=Object.entries(bDist).sort((a,b)=>b[1]-a[1]);
console.log("--- pre-group buckets (rep count) ---");for(const[k,v]of sorted)console.log(String(v).padStart(3),k);
