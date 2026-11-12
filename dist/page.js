(function(){
var P=window.P||{};
var $=function(s){return document.querySelector(s)};
var fmt=function(n,d){d=d||0;return n.toLocaleString("zh-TW",{minimumFractionDigits:d,maximumFractionDigits:d})};
var sign=function(n){return n>0?"+":n<0?"−":""};
var cls=function(n){return n>0?"up":n<0?"down":""};
var arrow=function(n){return n>0?"▲":n<0?"▼":"–"};
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
var tip=$("#tip");
function showTip(h,x,y){tip.innerHTML=h;tip.style.display="block";var w=tip.offsetWidth;tip.style.left=Math.min(Math.max(8,x-w/2),innerWidth-w-8)+"px";tip.style.top=Math.max(8,y-tip.offsetHeight-12)+"px"}
function hideTip(){tip.style.display="none"}
function hover(el,html){el.addEventListener("pointermove",function(e){showTip(html,e.clientX,e.clientY)});el.addEventListener("pointerleave",hideTip)}
function countUp(el,to,dec,suf){if(!el)return;suf=suf||"";if(reduce){el.textContent=fmt(to,dec)+suf;return}
  var t0=performance.now();(function f(t){var k=Math.min(1,(t-t0)/1200),v=to*(1-Math.pow(1-k,3));el.textContent=fmt(v,dec)+suf;if(k<1)requestAnimationFrame(f)})(t0)}
function onView(el,fn,th){if(!el)return;if(!("IntersectionObserver" in window)){fn();return}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){fn();io.disconnect()}})},{threshold:th||.3});io.observe(el)}
var md=function(d){return d.slice(5).replace("-","/")};
var go=function(d){location.href="/"+d};

/* hero */
if(P.close!=null){countUp($("#idx"),P.close,2);if(P.turnover)countUp($("#tVol"),P.turnover,0," 億")}

/* line chart: H=[[date,close]] */
function drawLine(box,H,cur){
  if(!box||H.length<2)return;
  var W=box.clientWidth||680,Hh=W<480?230:270,L=8,R=W<480?50:58,T=28,B=26,N=H.length;
  var vals=H.map(function(h){return h[1]}),lo0=Math.min.apply(0,vals),hi0=Math.max.apply(0,vals);
  var st=Math.pow(10,Math.floor(Math.log10((hi0-lo0)||1)));if((hi0-lo0)/st<3)st/=2;
  var mn=Math.floor(lo0/st)*st,mx=Math.ceil(hi0/st)*st;if(mx===mn)mx=mn+st;
  var xs=function(i){return L+i*(W-L-R)/(N-1)},ys=function(v){return T+(1-(v-mn)/(mx-mn))*(Hh-T-B)};
  var long=H[N-1][0].slice(0,4)!==H[0][0].slice(0,4)&&N>120;
  var lab=function(d){return long?d.slice(2,7).replace("-","/"):md(d)};
  var d="";H.forEach(function(h,i){d+=(i?"L":"M")+xs(i).toFixed(1)+","+ys(h[1]).toFixed(1)});
  var s='<svg width="'+W+'" height="'+Hh+'" role="img" aria-label="加權指數走勢">';
  var ticks=(mx-mn)/st>6?2:1;
  for(var v=mn;v<=mx+1e-6;v+=st*ticks)s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+ys(v)+'" y2="'+ys(v)+'" stroke="var(--grid)"/><text x="'+(W-R+6)+'" y="'+(ys(v)+4)+'" font-size="11" fill="var(--text-muted)">'+fmt(v)+'</text>';
  var nl=W<480?4:6,step=Math.max(1,Math.round((N-1)/nl));
  for(var i=0;i<N;i+=step)if(i<N-step/2)s+='<text x="'+xs(i)+'" y="'+(Hh-6)+'" font-size="11" fill="var(--text-muted)" text-anchor="'+(i===0?"start":"middle")+'">'+lab(H[i][0])+'</text>';
  s+='<text x="'+xs(N-1)+'" y="'+(Hh-6)+'" font-size="11" fill="var(--text-muted)" text-anchor="end">'+lab(H[N-1][0])+'</text>';
  s+='<path class="larea" d="'+d+'L'+xs(N-1)+','+(Hh-B)+'L'+xs(0)+','+(Hh-B)+'Z"/><path class="lpath" pathLength="1" d="'+d+'"/>';
  var hi=vals.indexOf(hi0),lo=vals.indexOf(lo0),ci=cur?H.findIndex(function(h){return h[0]===cur}):N-1;
  function ann(i,txt,above,bold){var a=i<N/4?"start":i>N*3/4?"end":"middle";
    return '<g class="fade" style="transition-delay:1.6s"><circle cx="'+xs(i)+'" cy="'+ys(vals[i])+'" r="4" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/><text x="'+xs(i)+'" y="'+(ys(vals[i])+(above?-10:18))+'" font-size="'+(bold?13:12)+'"'+(bold?' font-weight="700"':'')+' fill="var(--text-'+(bold?"primary":"secondary")+')" text-anchor="'+a+'" style="paint-order:stroke;stroke:var(--surface-1);stroke-width:3px">'+txt+'</text></g>'}
  s+=ann(hi,"高點 "+fmt(hi0),true);
  if(lo!==hi)s+=ann(lo,"低點 "+fmt(lo0)+"（"+((lo0/hi0-1)*100).toFixed(1)+"%）",false);
  if(ci>=0&&ci!==hi&&ci!==lo)s+=ann(ci,(cur&&ci!==N-1?"當日 ":"最新 ")+fmt(vals[ci]),vals[ci]<(hi0+lo0)/2,true);
  s+='<line class="cross" y1="'+T+'" y2="'+(Hh-B)+'"/><rect class="lhit" width="'+W+'" height="'+Hh+'" fill="transparent" style="cursor:pointer"/></svg>';
  box.innerHTML=s;
  var hit=box.querySelector(".lhit"),cross=box.querySelector(".cross");
  var idx=function(e){var r=hit.getBoundingClientRect();var i=Math.round((e.clientX-r.left-L)/((W-L-R)/(N-1)));return Math.max(0,Math.min(N-1,i))};
  hit.addEventListener("pointermove",function(e){var i=idx(e),r=hit.getBoundingClientRect();cross.setAttribute("x1",xs(i));cross.setAttribute("x2",xs(i));cross.style.display="block";
    var c=i?H[i][1]-H[i-1][1]:null;
    showTip("<b>"+H[i][0].replace(/-/g,"/")+"　"+fmt(H[i][1],2)+"</b>"+(c==null?"":'<span class="'+cls(c)+'">'+arrow(c)+" "+fmt(Math.abs(c),2)+" 點（"+sign(c)+Math.abs(c/H[i-1][1]*100).toFixed(2)+"%）</span>")+"<br><small>點一下看當日整理</small>",r.left+xs(i),r.top+ys(H[i][1]))});
  hit.addEventListener("pointerleave",function(){cross.style.display="none";hideTip()});
  hit.addEventListener("click",function(e){go(H[idx(e)][0])});
}

/* daily change columns */
function drawCols(box,H,cur){
  if(!box||H.length<2)return;
  var W=box.clientWidth||680,Hh=220,L=8,R=W<480?46:54,T=16,B=26;
  var ch=H.slice(1).map(function(h,i){return [h[0],h[1]-H[i][1]]}),N=ch.length;
  var mxa=Math.max.apply(0,ch.map(function(c){return Math.abs(c[1])})),st=mxa>1500?1000:mxa>600?500:mxa>200?200:100,m=Math.ceil(mxa/st)*st||100;
  var ys=function(v){return T+(1-(v+m)/(2*m))*(Hh-T-B)},band=(W-L-R)/N,bw=Math.max(1,Math.min(18,band-2));
  var s='<svg width="'+W+'" height="'+Hh+'" role="img" aria-label="每日漲跌點數">';
  [-m,0,m].concat(m>=2*st?[-m/2,m/2]:[]).forEach(function(v){s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+ys(v)+'" y2="'+ys(v)+'" stroke="'+(v===0?"var(--text-muted)":"var(--grid)")+'"/><text x="'+(W-R+6)+'" y="'+(ys(v)+4)+'" font-size="11" fill="var(--text-muted)">'+sign(v)+fmt(Math.abs(v))+'</text>'});
  var nl=W<480?4:6,step=Math.max(1,Math.round((N-1)/nl));
  ch.forEach(function(c,i){var x=L+i*band+(band-bw)/2,y0=ys(0),y1=ys(c[1]),h=Math.max(1,Math.abs(y1-y0)),y=c[1]>=0?y1:y0;
    s+='<rect class="col '+(c[1]>=0?"pos":"neg")+(c[0]===cur?" cur":"")+'" x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="'+Math.min(3,bw/2)+'" style="transition-delay:'+(reduce?0:Math.min(1.2,i*0.03)).toFixed(2)+'s"/>';
    if(i%step===0&&i<N-step/2)s+='<text x="'+(x+bw/2)+'" y="'+(Hh-6)+'" font-size="11" fill="var(--text-muted)" text-anchor="middle">'+md(c[0])+'</text>'});
  s+='<text x="'+(W-R)+'" y="'+(Hh-6)+'" font-size="11" fill="var(--text-muted)" text-anchor="end">'+md(ch[N-1][0])+'</text>';
  ch.forEach(function(c,i){s+='<rect class="chit" data-i="'+i+'" x="'+(L+i*band)+'" y="'+T+'" width="'+band+'" height="'+(Hh-T-B)+'" fill="transparent" style="cursor:pointer"/>'});
  box.innerHTML=s+"</svg>";
  box.querySelectorAll(".chit").forEach(function(r){var c=ch[+r.dataset.i];
    hover(r,"<b>"+c[0].replace(/-/g,"/")+'</b><span class="'+cls(c[1])+'">'+arrow(c[1])+" "+fmt(Math.abs(c[1]),2)+" 點</span>");
    r.addEventListener("click",function(){go(c[0])})});
}

/* diverging rows: el contains .drow[data-v] */
function showDiv(el){if(!el)return;var rows=el.querySelectorAll(".drow"),mx=0;
  rows.forEach(function(r){mx=Math.max(mx,Math.abs(+r.dataset.v))});mx=mx*1.9||1;
  rows.forEach(function(r){var v=+r.dataset.v,p=Math.abs(v)/mx*50;r.querySelector(".bar").style.width=Math.max(p,.4)+"%";
    r.querySelector(".val").style[v>=0?"left":"right"]="calc("+(50+p)+"% + 6px)"})}
document.querySelectorAll(".drow").forEach(function(r){r.querySelector(".val").style[+r.dataset.v>=0?"left":"right"]="50%";hover(r,r.dataset.tip)});

/* breadth */
var br=$("#breadth");if(br)br.querySelectorAll("div").forEach(function(d){hover(d,d.dataset.tip)});

/* wiring */
var lc=$("#lineChart"),cc=$("#colChart"),al=$("#allLine");
function drawAll(){drawLine(lc,P.hist||[],P.date);drawCols(cc,P.hist||[],P.date);drawLine(al,P.all||[],null)}
drawAll();
[lc,cc,al].forEach(function(b){if(b)onView(b,function(){requestAnimationFrame(function(){b.classList.add("shown")})})});
onView(br,function(){br.querySelectorAll("div").forEach(function(d){d.style.width=d.dataset.w+"%"})});
document.querySelectorAll(".div").forEach(function(el){onView(el,function(){showDiv(el)})});
document.querySelectorAll(".reveal").forEach(function(el){onView(el,function(){el.classList.add("in")},.1)});
var more=$("#secMore");if(more)more.addEventListener("click",function(){var el=$("#sectors");el.querySelectorAll(".drow[hidden]").forEach(function(r){r.hidden=false});more.remove();showDiv(el)});
var lw=innerWidth;addEventListener("resize",function(){if(innerWidth===lw)return;lw=innerWidth;drawAll();[lc,cc,al].forEach(function(b){if(b)b.classList.add("shown")})});
})();

/* ---------- 個股走勢（價格＋成交量兩個面板，共用時間軸） ---------- */
(function(){
var box=document.getElementById("stockChart");if(!box)return;
var fmt=function(n,d){return n.toLocaleString("zh-TW",{minimumFractionDigits:d||0,maximumFractionDigits:d||0})};
var tip=document.getElementById("tip"),ALL=[],range=250;
function showTip(h,x,y){tip.innerHTML=h;tip.style.display="block";var w=tip.offsetWidth;tip.style.left=Math.min(Math.max(8,x-w/2),innerWidth-w-8)+"px";tip.style.top=Math.max(8,y-tip.offsetHeight-12)+"px"}
function draw(anim){
  var H=range>=ALL.length?ALL:ALL.slice(-range),N=H.length;if(N<2)return;
  var W=box.clientWidth||680,L=8,R=W<480?52:60,T=24,PH=W<480?200:240,G=14,VH=60,B=24,Hh=T+PH+G+VH+B;
  var vals=H.map(function(h){return h[1]}),lo=Math.min.apply(0,vals),hi=Math.max.apply(0,vals),pad=(hi-lo)*.08||1;
  var mn=lo-pad,mx=hi+pad,vmax=Math.max.apply(0,H.map(function(h){return h[2]}))||1;
  var tt=H.map(function(h){return Date.parse(h[0])}),t0=tt[0],t1=tt[N-1];
  var xs=function(i){return L+(tt[i]-t0)/(t1-t0)*(W-L-R)},ys=function(v){return T+(1-(v-mn)/(mx-mn))*PH},vy=T+PH+G;
  var nice=function(v){var p=Math.pow(10,Math.floor(Math.log10(v)));return [1,2,2.5,5,10].map(function(m){return m*p}).find(function(s){return (mx-mn)/s<=5})};
  var st=nice(mx-mn),s='<svg width="'+W+'" height="'+Hh+'" role="img" aria-label="股價走勢與成交量">';
  for(var v=Math.ceil(mn/st)*st;v<=mx;v+=st)s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+ys(v)+'" y2="'+ys(v)+'" stroke="var(--grid)"/><text x="'+(W-R+6)+'" y="'+(ys(v)+4)+'" font-size="11" fill="var(--text-muted)">'+fmt(Math.abs(v)<1e-9?0:v,st<1?1:0)+'</text>';
  var d="";H.forEach(function(h,i){d+=(i?"L":"M")+xs(i).toFixed(1)+","+ys(h[1]).toFixed(1)});
  s+='<path class="larea" d="'+d+'L'+xs(N-1)+','+(T+PH)+'L'+xs(0)+','+(T+PH)+'Z"/><path class="lpath" pathLength="1" d="'+d+'"/>';
  H.forEach(function(h,i){var g=Math.min(i?xs(i)-xs(i-1):1e9,i<N-1?xs(i+1)-xs(i):1e9),bw=Math.max(.8,Math.min(g-.6,12)),bh=h[2]/vmax*VH;
    s+='<rect x="'+(xs(i)-bw/2)+'" y="'+(vy+VH-bh)+'" width="'+bw+'" height="'+Math.max(.5,bh)+'" fill="var(--flat)"/>'});
  s+='<text x="'+(W-R+6)+'" y="'+(vy+10)+'" font-size="11" fill="var(--text-muted)">成交量</text>';
  // 時間軸刻度：依期間長短用年、月或日
  var span=(t1-t0)/864e5,nl=W<480?3:5,ticks=[];
  if(span>900){for(var y=new Date(t0).getUTCFullYear()+1;Date.UTC(y,0,1)<=t1;y++)ticks.push([Date.UTC(y,0,1),String(y)]);var ev=Math.ceil(ticks.length/nl);ticks=ticks.filter(function(k,i){return i%ev===0})}
  else{var k=Math.max(1,Math.round((N-1)/nl));for(var i=0;i<N;i+=k)ticks.push([tt[i],(span>200?H[i][0].slice(2,7):H[i][0].slice(5)).replace("-","/")])}
  ticks.forEach(function(k){var x=L+(k[0]-t0)/(t1-t0)*(W-L-R);if(x<W-R-20)s+='<text x="'+x+'" y="'+(Hh-6)+'" font-size="11" fill="var(--text-muted)" text-anchor="'+(x<L+15?"start":"middle")+'">'+k[1]+'</text>'});
  var hiI=vals.indexOf(hi),loI=vals.indexOf(lo);
  var ann=function(i,t,up){var a=i<N/5?"start":i>N*4/5?"end":"middle";return '<g class="fade" style="transition-delay:1.4s"><circle cx="'+xs(i)+'" cy="'+ys(vals[i])+'" r="3.5" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/><text x="'+xs(i)+'" y="'+(ys(vals[i])+(up?-9:16))+'" font-size="12" fill="var(--text-secondary)" text-anchor="'+a+'" style="paint-order:stroke;stroke:var(--surface-1);stroke-width:3px">'+t+'</text></g>'};
  s+=ann(hiI,"高 "+fmt(hi,hi<100?2:0),true);if(loI!==hiI)s+=ann(loI,"低 "+fmt(lo,lo<100?2:0),false);
  s+='<line class="cross" y1="'+T+'" y2="'+(vy+VH)+'"/><rect class="lhit" width="'+W+'" height="'+Hh+'" fill="transparent" style="cursor:pointer"/></svg>';
  box.classList.remove("shown");box.innerHTML=s;
  requestAnimationFrame(function(){requestAnimationFrame(function(){box.classList.add("shown")})});
  var hit=box.querySelector(".lhit"),cross=box.querySelector(".cross");
  var idx=function(e){var r=hit.getBoundingClientRect(),x=e.clientX-r.left,b=0;for(var i=1;i<N;i++)if(Math.abs(xs(i)-x)<Math.abs(xs(b)-x))b=i;return b};
  hit.addEventListener("pointermove",function(e){var i=idx(e),r=hit.getBoundingClientRect(),c=i?H[i][1]-H[i-1][1]:null;
    cross.setAttribute("x1",xs(i));cross.setAttribute("x2",xs(i));cross.style.display="block";
    showTip("<b>"+H[i][0].replace(/-/g,"/")+"　"+fmt(H[i][1],2)+"</b>"+(c==null?"":'<span class="'+(c>0?"up":c<0?"down":"")+'">'+(c>0?"▲":c<0?"▼":"–")+" "+fmt(Math.abs(c),2)+"（"+(c/H[i-1][1]*100).toFixed(2)+"%）</span>")+"<br>"+(range>=ALL.length&&i<N-250?"週收盤｜日均量 ":"成交量 ")+fmt(H[i][2])+" 張",r.left+xs(i),r.top+ys(H[i][1]))});
  hit.addEventListener("pointerleave",function(){cross.style.display="none";tip.style.display="none"});
  hit.addEventListener("click",function(e){location.href="/"+H[idx(e)][0]});
}
document.querySelectorAll(".rng button").forEach(function(b){b.addEventListener("click",function(){
  document.querySelectorAll(".rng button").forEach(function(o){o.setAttribute("aria-pressed",o===b)});range=+b.dataset.n;draw()})});
fetch(box.dataset.src).then(function(r){return r.json()}).then(function(j){ALL=j;draw()});
var lw=innerWidth;addEventListener("resize",function(){if(innerWidth!==lw){lw=innerWidth;draw()}});
})();
