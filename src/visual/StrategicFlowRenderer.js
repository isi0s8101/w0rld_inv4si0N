import { THEME } from "./Theme.js";

function hash01(text=""){
  let h=2166136261>>>0; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;} return (h%10000)/10000;
}
function toVec(lat,lon){const a=lat*Math.PI/180,b=lon*Math.PI/180;return [Math.cos(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.sin(a)];}
function fromVec(v){const n=Math.hypot(...v)||1,x=v[0]/n,y=v[1]/n,z=v[2]/n;return {lat:Math.asin(z)*180/Math.PI,lon:Math.atan2(y,x)*180/Math.PI};}
function slerp(a,b,t){
  const av=toVec(a.lat,a.lon),bv=toVec(b.lat,b.lon);const dot=Math.max(-1,Math.min(1,av[0]*bv[0]+av[1]*bv[1]+av[2]*bv[2]));
  const omega=Math.acos(dot);if(omega<1e-5)return {lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};
  const so=Math.sin(omega),k1=Math.sin((1-t)*omega)/so,k2=Math.sin(t*omega)/so;return fromVec([av[0]*k1+bv[0]*k2,av[1]*k1+bv[1]*k2,av[2]*k1+bv[2]*k2]);
}
function familyAlpha(f){return f==="DATA"?.42:f==="AIR"?.34:f==="SEA"?.30:f==="LAND"?.27:f==="ENERGY"?.38:.32;}
function familyWidth(f,mode){
  if(f==="DATA")return mode==="DATA_SPACE"?.62:.72;
  if(f==="ENERGY")return 1.05;if(f==="TRADE")return .82;if(f==="AIR")return .74;if(f==="SEA")return .78;return .68;
}

export class StrategicFlowRenderer {
  constructor(){ this.countryCache=null; this.cacheSource=null; }
  countryMap(worldEngine){ if(this.cacheSource!==worldEngine){ this.cacheSource=worldEngine; this.countryCache=new Map(worldEngine.listCountries().map(c=>[c.iso2,c])); } return this.countryCache; }
  render(ctx,flows,worldEngine,projection,{alpha=1,mode="world",country=null,time=0}={}){
    if(!flows?.length)return;
    const countries=this.countryMap(worldEngine);
    for(const flow of flows){
      const a=countries.get(flow.from),b=countries.get(flow.to);
      if(!a||!b)continue;
      if(country && flow.from!==country && flow.to!==country && !(flow.route||[]).includes(country))continue;
      const from={lat:a.center[1],lon:a.center[0]},to={lat:b.center[1],lon:b.center[0]};
      const samples=mode==="globe"?22:mode==="country"?18:26;
      const path=[];
      for(let i=0;i<=samples;i++){const g=slerp(from,to,i/samples),p=projection.project(g.lat,g.lon);path.push(p);}
      const imp=Math.max(.05,Math.min(1,Number(flow.importance)||.15));
      const util=Math.max(0,Math.min(1.4,Number(flow.utilization)||0));
      ctx.save();
      ctx.strokeStyle=THEME.traffic;
      ctx.lineWidth=(familyWidth(flow.family,flow.mode)+(mode==="country"?.24:0))*(.74+imp*.52);
      ctx.globalAlpha=alpha*familyAlpha(flow.family)*(0.42+imp*.58)*(flow.state==="CONSTRAINED"?.72:1);
      ctx.shadowColor=THEME.traffic;ctx.shadowBlur=flow.family==="DATA"?4:7;
      if(flow.family==="DATA"&&flow.mode==="DATA_SPACE")ctx.setLineDash([2.2,4.8]);
      else if(flow.family==="SEA")ctx.setLineDash([5.5,4]);
      else if(flow.family==="LAND")ctx.setLineDash([3.5,2.8]);
      ctx.beginPath();let started=false;
      for(const p of path){if(!p.visible){started=false;continue;}if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}
      ctx.stroke();
      if(flow.family!=="LAND"){
        const phase=(time*(flow.family==="DATA"?.075:.042)+hash01(flow.id||`${flow.from}${flow.to}`))%1;
        const g=slerp(from,to,phase),p=projection.project(g.lat,g.lon);
        if(p.visible){ctx.setLineDash([]);ctx.globalAlpha=alpha*Math.min(.78,.28+imp*.42+util*.08);ctx.fillStyle=THEME.coastStrong;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(p.x,p.y,mode==="country"?1.8:1.35,0,Math.PI*2);ctx.fill();}
      }
      ctx.restore();
    }
  }
}
