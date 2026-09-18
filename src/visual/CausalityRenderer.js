export class CausalityRenderer {
  render(ctx,causality,projection,{alpha=1}={}){
    if(!causality?.active||!projection)return;const nodes=new Map((causality.nodes||[]).filter(n=>n.position).map(n=>[n.id,n]));if(!nodes.size)return;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineWidth=1.2;
    for(const edge of causality.edges||[]){const a=nodes.get(edge.from),b=nodes.get(edge.to);if(!a||!b)continue;const pa=projection.project(a.position.lon,a.position.lat),pb=projection.project(b.position.lon,b.position.lat);if(!pa||!pb)continue;ctx.globalAlpha=.65*alpha;ctx.strokeStyle=edge.direction==='UPSTREAM'?'rgba(255,190,70,.9)':'rgba(80,245,255,.9)';ctx.setLineDash(edge.kind==='ROUTE'?[5,4]:[]);ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();const t=.7,x=pa.x+(pb.x-pa.x)*t,y=pa.y+(pb.y-pa.y)*t,ang=Math.atan2(pb.y-pa.y,pb.x-pa.x);ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7*Math.cos(ang-.45),y-7*Math.sin(ang-.45));ctx.moveTo(x,y);ctx.lineTo(x-7*Math.cos(ang+.45),y-7*Math.sin(ang+.45));ctx.stroke();}
    for(const n of nodes.values()){const p=projection.project(n.position.lon,n.position.lat);if(!p)continue;ctx.globalAlpha=.9*alpha;ctx.fillStyle=n.relation==='ROOT'?'rgba(255,255,255,.95)':n.relation==='UPSTREAM'?'rgba(255,190,70,.9)':'rgba(80,245,255,.9)';ctx.beginPath();ctx.arc(p.x,p.y,n.relation==='ROOT'?5:3.2,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}
