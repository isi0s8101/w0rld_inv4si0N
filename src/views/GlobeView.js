export class GlobeView {
  constructor({ canvas, stateManager, cameraEngine, transitionManager, globeProjection }) {
    this.canvas=canvas; this.stateManager=stateManager; this.cameraEngine=cameraEngine; this.transitionManager=transitionManager; this.projection=globeProjection;
    this.pointerId=null; this.start=null; this.dragDistance=0;
    this.onDown=this.onDown.bind(this); this.onMove=this.onMove.bind(this); this.onUp=this.onUp.bind(this); this.onWheel=this.onWheel.bind(this); this.onKey=this.onKey.bind(this);
  }
  init(){
    this.canvas.addEventListener("pointerdown",this.onDown); this.canvas.addEventListener("pointermove",this.onMove); this.canvas.addEventListener("pointerup",this.onUp); this.canvas.addEventListener("pointercancel",this.onUp); this.canvas.addEventListener("wheel",this.onWheel,{passive:false}); this.canvas.addEventListener("keydown",this.onKey);
  }
  active(){ return this.stateManager.get().view==="GLOBE"; }
  coords(e){ const r=this.canvas.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  onDown(e){ if(!this.active()||e.button!==0) return; const p=this.coords(e); if(!this.projection.containsPoint(p.x,p.y)) return; this.pointerId=e.pointerId; this.start=p; this.dragDistance=0; this.canvas.setPointerCapture?.(e.pointerId); this.cameraEngine.beginGlobeDrag(p.x,p.y); }
  onMove(e){ if(!this.active()||this.pointerId!==e.pointerId) return; const p=this.coords(e); if(this.start) this.dragDistance=Math.max(this.dragDistance,Math.hypot(p.x-this.start.x,p.y-this.start.y)); this.cameraEngine.dragGlobe(p.x,p.y); }
  onUp(e){ if(this.pointerId!==e.pointerId) return; const wasClick=this.dragDistance<7; this.cameraEngine.endGlobeDrag(); this.canvas.releasePointerCapture?.(e.pointerId); this.pointerId=null; this.start=null; if(wasClick&&this.active()) this.transitionManager.toWorld(); }
  onWheel(e){ if(!this.active()) return; e.preventDefault(); const z=this.stateManager.get().globe.zoom; this.cameraEngine.zoomTo(z+(e.deltaY<0?0.08:-0.08)); }
  onKey(e){ if(!this.active()) return; if(e.key==="Enter"||e.key===" "){e.preventDefault();this.transitionManager.toWorld();} }
  destroy(){ this.canvas.removeEventListener("pointerdown",this.onDown);this.canvas.removeEventListener("pointermove",this.onMove);this.canvas.removeEventListener("pointerup",this.onUp);this.canvas.removeEventListener("pointercancel",this.onUp);this.canvas.removeEventListener("wheel",this.onWheel);this.canvas.removeEventListener("keydown",this.onKey); }
}
