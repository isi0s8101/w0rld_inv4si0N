const LABELS={GLOBAL:"ALL",TRADE:"TRADE",ENERGY:"ENERGY",AIR:"AIR",SEA:"SEA",LAND:"LAND",DATA:"DATA"};
export class FlowLayerPanel {
  constructor({root,gameEngine}){
    this.root=root;this.gameEngine=gameEngine;
    this.el=document.createElement("div");this.el.className="world-flow-layers";this.el.setAttribute("aria-label","Filtres des flux mondiaux");
    const title=document.createElement("span");title.className="world-flow-label";title.textContent="FLOW LAYER";this.el.append(title);
    this.buttons=document.createElement("div");this.buttons.className="world-flow-buttons";
    for(const layer of ["GLOBAL","TRADE","ENERGY","AIR","SEA","LAND","DATA"]){
      const b=document.createElement("button");b.type="button";b.dataset.layer=layer;b.textContent=LABELS[layer];
      b.addEventListener("click",(event)=>{event.stopPropagation();this.gameEngine.api.setFlowLayer(layer);this.update(true);});
      this.buttons.append(b);
    }
    this.el.append(this.buttons);
    root?.querySelector(".world-sim-toolbar")?.after(this.el);
    this.update(true);
  }
  update(force=false){
    const layer=this.gameEngine.api.getFlowLayer();
    for(const b of this.buttons.querySelectorAll("button"))b.classList.toggle("is-active",b.dataset.layer===layer);
  }
  destroy(){this.el?.remove();}
}
