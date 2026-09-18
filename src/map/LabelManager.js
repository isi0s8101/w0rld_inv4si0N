function overlaps(a,b){return !(a.x2<b.x1||a.x1>b.x2||a.y2<b.y1||a.y1>b.y2);}
function labelScale(){
  if(typeof document==='undefined') return 1;
  const raw=getComputedStyle(document.documentElement).getPropertyValue('--wi-map-label-scale');
  const n=Number.parseFloat(raw);
  return Number.isFinite(n)&&n>0?n:1;
}
function scaleFont(font,scale){
  const value=String(font||'12px ui-monospace,monospace');
  return value.replace(/(\d+(?:\.\d+)?)px/,(_,n)=>`${Math.max(11,Math.round(Number(n)*scale))}px`);
}
export class LabelManager{
  constructor(){this.boxes=[];}
  reset(){this.boxes=[];}
  overlaps(box){return this.boxes.some(existing=>overlaps(box,existing));}
  layout(candidates,{ctx,maxLabels=80}={}){
    this.reset();
    const scale=labelScale();
    const sorted=[...candidates].sort((a,b)=>(b.priority||0)-(a.priority||0));
    const out=[];
    for(const c of sorted){
      if(out.length>=maxLabels)break;
      const text=String(c.text||'');if(!text)continue;
      const font=scaleFont(c.font||'12px ui-monospace,monospace',scale);
      ctx.save();ctx.font=font;const w=ctx.measureText(text).width+12*scale;ctx.restore();
      const h=(c.height||17)*scale;
      const gap=Math.max(10,Math.min(42,w*.52));
      const offsets=c.offsets||[[0,0],[0,h+5],[0,-h-5],[gap,0],[-gap,0],[gap,h+5],[-gap,h+5],[gap,-h-5],[-gap,-h-5],[0,h*2+10],[0,-h*2-10]];
      let placed=null;
      for(const [ox,oy] of offsets){
        const x=(c.x||0)+ox-w/2,y=(c.y||0)+oy;
        const box={x1:x,y1:y,x2:x+w,y2:y+h};
        if(!this.overlaps(box)){placed={...c,font,x:x+w/2,y,box};break;}
      }
      if(placed){this.boxes.push(placed.box);out.push(placed);}
    }
    return out;
  }
  draw(ctx,candidates,opts={}){
    for(const l of this.layout(candidates,{ctx,...opts})){
      ctx.save();
      ctx.globalAlpha=l.alpha??.9;
      ctx.font=l.font||'12px ui-monospace,monospace';
      ctx.textAlign='center';ctx.textBaseline='top';
      ctx.lineJoin='round';
      ctx.lineWidth=3;
      ctx.strokeStyle='rgba(1,9,14,.88)';
      ctx.strokeText(l.text,l.x,l.y);
      ctx.fillStyle=l.color||'rgba(226,253,255,.94)';
      ctx.shadowColor='rgba(0,234,255,.16)';
      ctx.shadowBlur=3;
      ctx.fillText(l.text,l.x,l.y);
      ctx.restore();
    }
  }
}
