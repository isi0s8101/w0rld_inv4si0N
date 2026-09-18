const avg=(...x)=>x.reduce((a,b)=>a+b,0)/Math.max(1,x.length);
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function pairStrength(e,rev){
  return avg(e?.diplomaticRelation||0,rev?.diplomaticRelation||0,e?.trust||0,rev?.trust||0,e?.alliance||0,rev?.alliance||0);
}

function jaccard(a=[],b=[]){
  const A=new Set(a),B=new Set(b);let intersection=0;
  for(const x of A)if(B.has(x))intersection++;
  const union=new Set([...A,...B]).size;
  return union?intersection/union:0;
}

export class AllianceBlocSystem{
  constructor({ledger}={}){
    this.ledger=ledger;
    this.alliances=[];
    this.blocs=[];
    this.sequence=0;
    this.transitionSequence=0;
    this.lastReviewDay=-1;
    this.memberToBloc=new Map();
    this.membershipState=new Map();
    this.transitions=[];
  }

  relationAffinity(country,bloc,relations){
    if(!bloc?.members?.length)return 0;
    const peers=bloc.members.filter(code=>code!==country);
    if(!peers.length)return 0;
    const values=[];
    for(const peer of peers){
      const e=relations.get(country,peer),rev=relations.get(peer,country);
      if(!e&&!rev)continue;
      const d=avg(e?.diplomaticRelation??50,rev?.diplomaticRelation??50);
      const t=avg(e?.trust??50,rev?.trust??50);
      const a=avg(e?.alliance??35,rev?.alliance??35);
      const trade=avg(e?.trade??35,rev?.trade??35);
      values.push(d*.34+t*.30+a*.24+trade*.12);
    }
    return values.length?clamp(values.reduce((s,v)=>s+v,0)/values.length):0;
  }

  recordTransition({day,country,type,fromBloc=null,toBloc=null,affinity=0,status=null}){
    const row={id:`BT${++this.transitionSequence}`,day,country,type,fromBloc,toBloc,affinity:Number(affinity.toFixed(2)),status,dataClass:'SIM_BLOC_TRANSITION'};
    this.transitions.push(row);
    if(this.transitions.length>4000)this.transitions.splice(0,this.transitions.length-4000);
    this.ledger?.record({day,kind:'BLOC_TRANSITION',country,target:toBloc||fromBloc,type,effects:{fromBloc,toBloc,affinity:row.affinity,status}});
    return row;
  }

  matchBlocId(members,previous,used){
    let best=null,bestScore=0;
    for(const bloc of previous){
      if(used.has(bloc.id))continue;
      const score=jaccard(members,bloc.members);
      if(score>bestScore){best=bloc;bestScore=score;}
    }
    if(best&&bestScore>=0.34){used.add(best.id);return {id:best.id,name:best.name,formedDay:best.formedDay??this.lastReviewDay,continuity:bestScore};}
    const id=`BL${++this.sequence}`;
    return {id,name:`Strategic Bloc ${this.sequence}`,formedDay:Math.max(0,this.lastReviewDay),continuity:0};
  }

  review(states,relations,worldEngine,day){
    if(day!==0&&day!==1&&day%90!==0)return {alliances:this.alliances,blocs:this.blocs,transitions:[]};
    this.lastReviewDay=day;
    const previousBlocs=this.blocs.map(b=>structuredClone(b));
    const previousMembership=new Map([...this.membershipState.entries()].map(([k,v])=>[k,structuredClone(v)]));

    const pair=new Map();
    for(const e of relations.all()){
      const rev=relations.get(e.to,e.from);if(!rev)continue;
      const key=[e.from,e.to].sort().join(':');if(pair.has(key))continue;
      const strength=pairStrength(e,rev);
      if(strength>=64)pair.set(key,{id:`AL:${key}`,members:key.split(':'),strength:Number(strength.toFixed(2)),status:strength>=76?'STRONG':'COOPERATIVE',dataClass:'SIM_ALLIANCE'});
    }
    this.alliances=[...pair.values()].sort((a,b)=>b.strength-a.strength||a.id.localeCompare(b.id));

    const adj=new Map([...states.keys()].map(c=>[c,new Set()]));
    for(const alliance of this.alliances.filter(x=>x.strength>=70)){
      adj.get(alliance.members[0])?.add(alliance.members[1]);
      adj.get(alliance.members[1])?.add(alliance.members[0]);
    }

    const seen=new Set(),components=[];
    for(const start of [...states.keys()].sort())if(!seen.has(start)){
      const q=[start],members=[];seen.add(start);
      while(q.length){const c=q.shift();members.push(c);for(const n of adj.get(c)||[])if(!seen.has(n)){seen.add(n);q.push(n);}}
      if(members.length>=3)components.push(members.sort());
    }

    const usedPrevious=new Set();
    const blocs=[];
    for(const members of components){
      const matched=this.matchBlocId(members,previousBlocs,usedPrevious);
      const internal=this.alliances.filter(a=>a.members.every(m=>members.includes(m)));
      const cohesion=internal.length?internal.reduce((s,a)=>s+a.strength,0)/internal.length:0;
      const regions=[...new Set(members.map(c=>worldEngine.getCountryMeta(c)?.region||'GLOBAL'))];
      blocs.push({
        id:matched.id,name:matched.name,members,size:members.length,regions,
        cohesion:Number(cohesion.toFixed(2)),formedDay:matched.formedDay,continuity:Number(matched.continuity.toFixed(3)),
        lifecycle:'ACTIVE',dataClass:'SIM_DYNAMIC_BLOC'
      });
    }
    this.blocs=blocs.sort((a,b)=>b.size-a.size||a.id.localeCompare(b.id));

    this.memberToBloc.clear();
    const currentActive=new Map();
    for(const bloc of this.blocs)for(const member of bloc.members){this.memberToBloc.set(member,bloc.id);currentActive.set(member,bloc.id);}

    const reviewTransitions=[];
    const nextMembership=new Map();
    for(const code of [...states.keys()].sort()){
      const prev=previousMembership.get(code)||null;
      const activeBlocId=currentActive.get(code)||null;
      if(activeBlocId){
        const activeBloc=this.blocs.find(b=>b.id===activeBlocId);
        const affinity=this.relationAffinity(code,activeBloc,relations);
        let type=null;
        if(!prev)type='JOIN';
        else if(prev.blocId!==activeBlocId)type=prev.status==='SUSPENDED'?'REJOIN':'SWITCH';
        else if(prev.status!=='ACTIVE')type='REJOIN';
        const row={blocId:activeBlocId,status:'ACTIVE',affinity,sinceDay:(prev?.blocId===activeBlocId?prev.sinceDay:day),lastTransitionDay:type?day:(prev?.lastTransitionDay??day),dataClass:'SIM_BLOC_MEMBERSHIP'};
        nextMembership.set(code,row);
        if(type)reviewTransitions.push(this.recordTransition({day,country:code,type,fromBloc:prev?.blocId||null,toBloc:activeBlocId,affinity,status:'ACTIVE'}));
        continue;
      }

      const candidates=this.blocs.map(bloc=>({bloc,affinity:this.relationAffinity(code,bloc,relations)})).sort((a,b)=>b.affinity-a.affinity||a.bloc.id.localeCompare(b.bloc.id));
      const best=candidates[0]||null;
      const previousBloc=prev?.blocId?(this.blocs.find(b=>b.id===prev.blocId)||previousBlocs.find(b=>b.id===prev.blocId)):null;
      const oldAffinity=previousBloc?this.relationAffinity(code,previousBloc,relations):(prev?.affinity||0);

      if(prev?.blocId&&oldAffinity>=54){
        const row={blocId:prev.blocId,status:'SUSPENDED',affinity:oldAffinity,sinceDay:prev.sinceDay??day,lastTransitionDay:prev.status==='SUSPENDED'?(prev.lastTransitionDay??day):day,dataClass:'SIM_BLOC_MEMBERSHIP'};
        nextMembership.set(code,row);
        if(prev.status!=='SUSPENDED')reviewTransitions.push(this.recordTransition({day,country:code,type:'SUSPEND',fromBloc:prev.blocId,toBloc:prev.blocId,affinity:oldAffinity,status:'SUSPENDED'}));
      }else if(best&&best.affinity>=58){
        const row={blocId:best.bloc.id,status:'APPROACHING',affinity:best.affinity,sinceDay:day,lastTransitionDay:day,dataClass:'SIM_BLOC_MEMBERSHIP'};
        nextMembership.set(code,row);
        const changed=!prev||prev.blocId!==best.bloc.id||prev.status!=='APPROACHING';
        if(changed)reviewTransitions.push(this.recordTransition({day,country:code,type:'APPROACH',fromBloc:prev?.blocId||null,toBloc:best.bloc.id,affinity:best.affinity,status:'APPROACHING'}));
      }else{
        const prior=prev?.blocId||null;
        const status=prior?'DISTANCING':'UNALIGNED';
        const row={blocId:null,status,affinity:best?.affinity||0,sinceDay:day,lastTransitionDay:day,dataClass:'SIM_BLOC_MEMBERSHIP'};
        nextMembership.set(code,row);
        if(prior)reviewTransitions.push(this.recordTransition({day,country:code,type:prev?.status==='ACTIVE'?'LEAVE':'DISTANCE',fromBloc:prior,toBloc:null,affinity:oldAffinity,status}));
      }
    }

    this.membershipState=nextMembership;
    this.ledger?.record({day,kind:'BLOC_REVIEW',type:'DYNAMIC_BLOCS',effects:{alliances:this.alliances.length,blocs:this.blocs.length,transitions:reviewTransitions.length}});
    return {alliances:this.alliances,blocs:this.blocs,transitions:reviewTransitions};
  }

  sameBloc(a,b){const id=this.memberToBloc.get(a);return !!id&&id===this.memberToBloc.get(b);}
  getAlliances(code=null){return structuredClone(code?this.alliances.filter(a=>a.members.includes(code)):this.alliances);}
  getBlocFor(code){const id=this.memberToBloc.get(code);const b=id?this.blocs.find(x=>x.id===id):null;return b?structuredClone(b):null;}
  getMembership(code){return structuredClone(this.membershipState.get(code)||{blocId:null,status:'UNALIGNED',affinity:0,dataClass:'SIM_BLOC_MEMBERSHIP'});}
  getTransitions({country=null,sinceDay=0,limit=100}={}){return structuredClone(this.transitions.filter(t=>(!country||t.country===country)&&t.day>=sinceDay).slice(-limit));}
  getBlocs(){return structuredClone(this.blocs);}
}
