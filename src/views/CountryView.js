export class CountryView {
  constructor({ miniCanvas, stateManager, transitionManager, worldEngine, miniWorldProjection }) {
    this.miniCanvas=miniCanvas;
    this.stateManager=stateManager;
    this.transitionManager=transitionManager;
    this.worldEngine=worldEngine;
    this.projection=miniWorldProjection;
    this.onClick=this.onClick.bind(this);
  }

  init(){this.miniCanvas.addEventListener("click",this.onClick);}

  coords(e){
    const r=this.miniCanvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }

  countryAt(e){
    if(!this.projection||!this.worldEngine)return null;
    this.projection.setCamera({centerX:0,centerY:0,zoom:1});
    const p=this.coords(e),geo=this.projection.unproject(p.x,p.y);
    return geo?this.worldEngine.findCountry(geo.lon,geo.lat):null;
  }

  onClick(e){
    const state=this.stateManager.get();
    if(state.transition.active)return;

    if(!state.selectedCountry&&(state.view==="WORLD"||state.view==="COUNTRY")){
      this.transitionManager.toGlobe();
      return;
    }

    if(state.selectedCountry&&state.view==="COUNTRY"){
      const feature=this.countryAt(e);
      const code=feature?.properties?.iso2||null;
      if(code&&code!==state.selectedCountry)this.transitionManager.selectCountry(code);
      else this.transitionManager.clearCountry();
    }
  }

  destroy(){this.miniCanvas.removeEventListener("click",this.onClick);}
}
