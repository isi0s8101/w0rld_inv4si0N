export class WorldView {
  constructor({ canvas, stateManager, worldEngine, worldProjection, transitionManager, mapCameraEngine = null }) {
    this.canvas=canvas;this.stateManager=stateManager;this.worldEngine=worldEngine;this.projection=worldProjection;this.transitionManager=transitionManager;this.mapCamera=mapCameraEngine;
    this.pointers=new Map();this.dragMoved=false;this.downPoint=null;this.pinch=null;
    for(const name of ['onMove','onLeave','onClick','onPointerDown','onPointerMove','onPointerUp','onWheel','onDoubleClick'])this[name]=this[name].bind(this);
  }
  init(){
    this.canvas.style.touchAction='none';
    this.canvas.addEventListener('pointermove',this.onMove);this.canvas.addEventListener('pointerleave',this.onLeave);this.canvas.addEventListener('click',this.onClick);
    this.canvas.addEventListener('pointerdown',this.onPointerDown);this.canvas.addEventListener('pointermove',this.onPointerMove);this.canvas.addEventListener('pointerup',this.onPointerUp);this.canvas.addEventListener('pointercancel',this.onPointerUp);
    this.canvas.addEventListener('wheel',this.onWheel,{passive:false});this.canvas.addEventListener('dblclick',this.onDoubleClick);
  }
  worldActive(){const s=this.stateManager.get();return s.view==="WORLD"&&!s.transition.active;}
  countryActive(){const s=this.stateManager.get();return s.view==="COUNTRY"&&!s.transition.active;}
  active(){return this.worldActive()||this.countryActive();}
  coords(e){const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  countryAt(e){const s=this.stateManager.get();if(s.view!=='WORLD')return null;this.projection.setCamera(s.world);const p=this.coords(e),geo=this.projection.unproject(p.x,p.y);return geo?this.worldEngine.findCountry(geo.lon,geo.lat):null;}
  onMove(e){if(!this.active()||this.pointers.size)return;const s=this.stateManager.get();if(s.view==='WORLD'){const feature=this.countryAt(e);const code=feature?.properties?.iso2||null;this.stateManager.setHoveredCountry(code);this.canvas.style.cursor=code?'pointer':'grab';}else this.canvas.style.cursor='grab';}
  onLeave(){if(!this.active())return;this.stateManager.setHoveredCountry(null);if(!this.pointers.size)this.canvas.style.cursor='default';}
  onClick(e){if(!this.active()||this.dragMoved)return;const s=this.stateManager.get();if(s.view!=='WORLD')return;const feature=this.countryAt(e),code=feature?.properties?.iso2||null;if(code)this.transitionManager.selectCountry(code);}
  onPointerDown(e){if(!this.active()||e.button!==0)return;const p=this.coords(e);this.pointers.set(e.pointerId,p);this.canvas.setPointerCapture?.(e.pointerId);this.downPoint=p;this.dragMoved=false;this.canvas.style.cursor='grabbing';
    if(this.pointers.size===1){this.mapCamera?.beginDrag(p.x,p.y);}else if(this.pointers.size===2){this.mapCamera?.endDrag();const pts=[...this.pointers.values()];this.pinch={distance:Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y),center:{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2}};}
  }
  onPointerMove(e){if(!this.active()||!this.pointers.has(e.pointerId))return;const p=this.coords(e);this.pointers.set(e.pointerId,p);if(this.downPoint&&Math.hypot(p.x-this.downPoint.x,p.y-this.downPoint.y)>4)this.dragMoved=true;
    if(this.pointers.size===1&&!this.pinch){this.mapCamera?.dragTo(p.x,p.y);return;}
    if(this.pointers.size>=2){const pts=[...this.pointers.values()].slice(0,2);const distance=Math.max(1,Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y));const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};if(this.pinch){this.mapCamera?.panPixels(center.x-this.pinch.center.x,center.y-this.pinch.center.y,{recordVelocity:false});this.mapCamera?.zoomAt(center.x,center.y,distance/Math.max(1,this.pinch.distance));}this.pinch={distance,center};this.dragMoved=true;}
  }
  onPointerUp(e){if(!this.pointers.has(e.pointerId))return;this.pointers.delete(e.pointerId);this.canvas.releasePointerCapture?.(e.pointerId);if(this.pointers.size<2)this.pinch=null;if(this.pointers.size===0){this.mapCamera?.endDrag();this.canvas.style.cursor='grab';if(this.dragMoved)this.canvas.dataset.mapDragSuppressUntil=String(Date.now()+140);setTimeout(()=>{this.dragMoved=false;},0);}else if(this.pointers.size===1){const p=[...this.pointers.values()][0];this.mapCamera?.beginDrag(p.x,p.y);}}
  onWheel(e){if(!this.active())return;e.preventDefault();const p=this.coords(e);const factor=Math.exp(-Math.max(-180,Math.min(180,e.deltaY))*.0022);this.mapCamera?.zoomAt(p.x,p.y,factor);}
  onDoubleClick(e){if(!this.active())return;e.preventDefault();const p=this.coords(e);this.mapCamera?.zoomAt(p.x,p.y,e.shiftKey?.56:1.85);}
  destroy(){
    this.canvas.removeEventListener('pointermove',this.onMove);this.canvas.removeEventListener('pointerleave',this.onLeave);this.canvas.removeEventListener('click',this.onClick);this.canvas.removeEventListener('pointerdown',this.onPointerDown);this.canvas.removeEventListener('pointermove',this.onPointerMove);this.canvas.removeEventListener('pointerup',this.onPointerUp);this.canvas.removeEventListener('pointercancel',this.onPointerUp);this.canvas.removeEventListener('wheel',this.onWheel);this.canvas.removeEventListener('dblclick',this.onDoubleClick);
  }
}
