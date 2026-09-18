const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export class MapCameraEngine {
  constructor({ stateManager, projections, worldEngine = null, bus = null } = {}) {
    this.state=stateManager;this.projections=projections;this.worldEngine=worldEngine;this.bus=bus;
    this.dragging=false;this.lastPointer=null;this.velocity={x:0,y:0};this.inertia=.88;this.reducedMotion=false;this.followTarget=null;this.followResolver=null;
  }
  setReducedMotion(value){this.reducedMotion=Boolean(value);if(this.reducedMotion)this.velocity={x:0,y:0};}
  activeView(){const v=this.state.get().view;return v==='COUNTRY'?'COUNTRY':v==='WORLD'?'WORLD':null;}
  key(view=this.activeView()){return view==='COUNTRY'?'country':view==='WORLD'?'world':null;}
  projection(view=this.activeView()){return view==='COUNTRY'?this.projections.country:view==='WORLD'?this.projections.world:null;}
  camera(view=this.activeView()){const k=this.key(view);return k?this.state.get()[k]:null;}
  syncProjection(view=this.activeView()){
    const p=this.projection(view),c=this.camera(view);if(!p||!c)return null;
    if(view==='COUNTRY'){const code=this.state.get().selectedCountry;const feature=code?this.worldEngine?.getCountry(code):null;if(feature)p.setFeature(feature);}
    p.setCamera(c);return p;
  }
  patchCamera(view,patch,reason='map-camera'){
    const key=this.key(view);const p=this.projection(view);if(!key||!p)return false;
    if(view==='COUNTRY'){const code=this.state.get().selectedCountry;const feature=code?this.worldEngine?.getCountry(code):null;if(feature)p.setFeature(feature);}
    const next=p.setCamera({...this.state.get()[key],...patch});this.state.patch({[key]:next},reason);return next;
  }
  viewport(view=this.activeView()){const p=this.syncProjection(view);return p?.viewport?.()||null;}
  zoomAt(x,y,factor,{view=this.activeView()}={}){
    const p=this.syncProjection(view),cam=this.camera(view);if(!p||!cam)return false;
    const before=p.unproject(x,y,{allowOutside:true});if(!before)return false;
    const nextZoom=(Number(cam.zoom)||1)*Math.max(.25,Number(factor)||1);
    this.patchCamera(view,{zoom:nextZoom},'map-camera:zoom');
    const p2=this.syncProjection(view);const after=p2.unproject(x,y,{allowOutside:true});if(!after)return false;
    this.patchCamera(view,{centerX:this.camera(view).centerX+(before.lon-after.lon),centerY:this.camera(view).centerY+(before.lat-after.lat)},'map-camera:zoom-anchor');
    this.velocity={x:0,y:0};return this.camera(view).zoom;
  }
  zoomTo(zoom,{x=null,y=null,view=this.activeView()}={}){
    const vp=this.viewport(view);if(!vp)return false;const cam=this.camera(view);const factor=(Number(zoom)||1)/Math.max(.0001,cam.zoom||1);
    return this.zoomAt(x??vp.x+vp.width/2,y??vp.y+vp.height/2,factor,{view});
  }
  panPixels(dx,dy,{view=this.activeView(),recordVelocity=true}={}){
    const p=this.syncProjection(view);if(!p)return false;const vp=p.viewport();const cx=vp.x+vp.width/2,cy=vp.y+vp.height/2;
    const moved=p.unproject(cx-Number(dx||0),cy-Number(dy||0),{allowOutside:true});if(!moved)return false;
    const next=this.patchCamera(view,{centerX:moved.lon,centerY:moved.lat},'map-camera:pan');
    if(recordVelocity&&!this.reducedMotion)this.velocity={x:Number(dx||0),y:Number(dy||0)};return next;
  }
  beginDrag(x,y){if(!this.activeView())return false;this.dragging=true;this.lastPointer={x,y,time:globalThis.performance?.now?.()??Date.now()};this.velocity={x:0,y:0};this.cancelFollow();return true;}
  dragTo(x,y){if(!this.dragging||!this.lastPointer)return false;const now=globalThis.performance?.now?.()??Date.now();const dx=x-this.lastPointer.x,dy=y-this.lastPointer.y;const dt=Math.max(8,now-this.lastPointer.time);this.panPixels(dx,dy,{recordVelocity:false});if(!this.reducedMotion)this.velocity={x:dx*(16/dt),y:dy*(16/dt)};this.lastPointer={x,y,time:now};return true;}
  endDrag(){this.dragging=false;this.lastPointer=null;if(this.reducedMotion)this.velocity={x:0,y:0};}
  reset(view=this.activeView()){
    if(view==='WORLD')return this.patchCamera('WORLD',{centerX:0,centerY:0,zoom:1},'map-camera:reset');
    if(view==='COUNTRY'){
      const code=this.state.get().selectedCountry,feature=code?this.worldEngine?.getCountry(code):null;if(!feature)return false;
      const p=this.syncProjection('COUNTRY');const b=p?.bounds;if(!b)return false;
      const next=p.setCamera({centerX:b.centerX,centerY:b.centerY,zoom:1});this.state.patch({country:{...next,code}},'map-camera:reset');return next;
    }
    return false;
  }
  fitBounds(bounds,{view=this.activeView(),padding=.14}={}){
    const p=this.syncProjection(view);if(!p?.fitBounds)return false;const next=p.fitBounds(bounds,{padding});const key=this.key(view);this.state.patch({[key]:next},'map-camera:fit');this.cancelFollow();return next;
  }
  focus(position,{view=this.activeView(),zoom=null}={}){
    if(!position)return false;const current=this.camera(view);const targetZoom=zoom??Math.max(current?.zoom||1,view==='COUNTRY'?2.2:2.6);return this.patchCamera(view,{centerX:position.lon,centerY:position.lat,zoom:targetZoom},'map-camera:focus');
  }
  setFollowTarget(target,resolver){this.followTarget=target||null;this.followResolver=typeof resolver==='function'?resolver:null;this.velocity={x:0,y:0};this.bus?.emit?.('map:follow',{target:this.followTarget});return Boolean(this.followTarget&&this.followResolver);}
  cancelFollow(){if(this.followTarget)this.bus?.emit?.('map:follow-ended',{target:this.followTarget});this.followTarget=null;this.followResolver=null;}
  update(dt){
    const view=this.activeView();if(!view)return;
    if(this.followTarget&&this.followResolver){const pos=this.followResolver(this.followTarget);if(pos){const cam=this.camera(view);const smoothing=this.reducedMotion?1:clamp((Number(dt)||0)*5.5,.05,.32);this.patchCamera(view,{centerX:cam.centerX+(pos.lon-cam.centerX)*smoothing,centerY:cam.centerY+(pos.lat-cam.centerY)*smoothing},'map-camera:follow-step');}}
    if(!this.dragging&&!this.followTarget&&!this.reducedMotion&&(Math.abs(this.velocity.x)>.05||Math.abs(this.velocity.y)>.05)){
      this.panPixels(this.velocity.x,this.velocity.y,{view,recordVelocity:false});const decay=Math.pow(this.inertia,Math.max(.5,(Number(dt)||.016)*60));this.velocity.x*=decay;this.velocity.y*=decay;
    }
  }
}
