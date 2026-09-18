export class SimulationPanel {
  constructor({ root, gameEngine }) {
    this.root=root; this.gameEngine=gameEngine; this.lastDay=-1; this.lastSpeed=null;
    this.el=document.createElement("div"); this.el.className="world-sim-toolbar"; this.el.setAttribute("aria-label","Contrôles de simulation mondiale");
    this.date=document.createElement("span"); this.date.className="world-sim-date";
    this.controls=document.createElement("div"); this.controls.className="world-sim-speeds";
    for(const speed of [0,1,2,5,10,50]){
      const button=document.createElement("button"); button.type="button"; button.dataset.speed=String(speed); button.textContent=speed===0?"Ⅱ":`×${speed}`;
      button.setAttribute("aria-label",speed===0?"Mettre la simulation en pause":`Vitesse simulation x${speed}`);
      button.addEventListener("click",(event)=>{event.stopPropagation();this.gameEngine.clock.setSpeed(speed);this.update(true);});
      this.controls.append(button);
    }
    this.el.append(this.date,this.controls);
    root?.querySelector(".cyber-mini-header")?.after(this.el);
  }
  update(force=false){
    const clock=this.gameEngine.clock;
    if(!force&&clock.day===this.lastDay&&clock.speed===this.lastSpeed)return;
    this.lastDay=clock.day;this.lastSpeed=clock.speed;const t=this.gameEngine.simulation?.getSimulationTime?.();this.date.textContent=t?`SIM ${String(t.date).slice(0,10)} · H${t.hour}`:`SIM ${clock.date()}`;
    for(const button of this.controls.querySelectorAll("button"))button.classList.toggle("is-active",Number(button.dataset.speed)===clock.speed);
  }
  destroy(){this.el?.remove();}
}
