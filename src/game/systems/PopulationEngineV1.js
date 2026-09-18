const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export class PopulationEngineV1 {
  update(states,economy){for(const state of states.values()){const eco=economy.get(state.code)||{};const urbanization=clamp(35+state.metrics.infrastructure.current*.42+state.metrics.economy.current*.22);const basicNeeds=clamp(100-(state.resources.food.shortage||0)*48-(state.resources.energy.shortage||0)*32);const morale=clamp(state.metrics.stability.current*.42+basicNeeds*.34+(eco.employment||50)*.24);const displacement=Math.max(0,Math.round(state.populationCount*((100-state.metrics.stability.current)/100)*.00005));state.populationV1={population:state.populationCount,urbanization,employment:eco.employment||50,basicNeeds,morale,displacement,dataClass:'DERIVED_SIMULATION'};} }
}
