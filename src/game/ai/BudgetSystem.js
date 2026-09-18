import { clamp01 } from "../simulation/constants.js";

function metric(state,name){ return state.metrics?.[name]?.current ?? 50; }

export class BudgetSystem {
  initialize(state, random){
    if(state.policy?.budget)return state.policy;
    const economy=metric(state,"economy")/100;
    const population=metric(state,"population")/100;
    const resilience=metric(state,"resilience")/100;
    const annualBudget=24 + economy*62 + population*24 + resilience*10;
    const monthlyRevenue=annualBudget/12;
    state.policy={
      strategy:"BALANCED",
      budget:{
        currency:"SIM_BUDGET_UNITS",
        annualCapacity:Number(annualBudget.toFixed(3)),
        monthlyRevenue:Number(monthlyRevenue.toFixed(3)),
        treasury:Number((monthlyRevenue*random.range(2.2,5.2)).toFixed(3)),
        spentThisYear:0,
        debt:0,
        debtLimit:Number((annualBudget*0.45).toFixed(3))
      },
      reserveTargetRatio:{food:0.52,energy:0.52,goods:0.46,data:0.42},
      supplierPreferences:{food:[],energy:[],goods:[],data:[]},
      priorities:{food:0.5,energy:0.5,goods:0.45,data:0.4,infrastructure:0.5,science:0.4,resilience:0.5},
      adaptation:{diversification:0,stockpiling:0,investment:0,aid:0},
      lastDecisionDay:0,
      decisionCount:0,
      lastReviewDay:0
    };
    return state.policy;
  }

  accrueDay(state,day){
    const p=state.policy; if(!p?.budget)return;
    const economyFactor=0.55 + metric(state,"economy")/220;
    const stabilityFactor=0.65 + metric(state,"stability")/285;
    const revenue=(p.budget.monthlyRevenue/30)*economyFactor*stabilityFactor;
    p.budget.treasury=Math.max(0,p.budget.treasury+revenue);
    if(day>0 && day%365===0)p.budget.spentThisYear=0;
  }

  available(state){ return Math.max(0,state.policy?.budget?.treasury||0); }

  spend(state,amount){
    const b=state.policy?.budget; if(!b || !Number.isFinite(amount) || amount<=0)return false;
    const available=b.treasury + Math.max(0,b.debtLimit-b.debt);
    if(amount>available+1e-9)return false;
    const cash=Math.min(b.treasury,amount); b.treasury-=cash;
    const borrowed=amount-cash; if(borrowed>0)b.debt+=borrowed;
    b.spentThisYear+=amount;
    return true;
  }

  monthlyDebtService(state){
    const b=state.policy?.budget; if(!b || b.debt<=0)return 0;
    const payment=Math.min(b.debt,Math.max(0.04,b.monthlyRevenue*0.06));
    const paid=Math.min(payment,b.treasury); b.treasury-=paid; b.debt-=paid;
    return paid;
  }

  fiscalStress(state){
    const b=state.policy?.budget; if(!b)return 0;
    const debtRatio=b.debt/Math.max(1,b.debtLimit);
    const treasuryRatio=b.treasury/Math.max(1,b.monthlyRevenue*2);
    return clamp01(debtRatio*0.7 + Math.max(0,1-treasuryRatio)*0.3);
  }
}
