import { ContextAwareNode } from  './ContextAwareNode.js';
import { Config } from "@src/backend/config";
import { getRandomInt } from '@src/common/math';


export class scenarioNode extends ContextAwareNode {
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    getScenarioIfItsTime(params, turn, lastScenarioTurn, usedScenarioIndices) {
      const { Constants } = Config;      

      if (params.catalog && params.catalog.length > 0) {
        
        const timeBetweenScenarios = getRandomInt(params.frequencyMin, params.frequencyMax);
        const turnsSinceLastScenario = turn - lastScenarioTurn;

        Constants.debug.logScenarios && console.error("getScenarioIfItsTime: turnsSinceLastScenario ", turnsSinceLastScenario, " timeBetweenScenarios ", timeBetweenScenarios, " turn ", turn)
    
        Constants.debug.logScenarios && console.error("getScenarioIfItsTime: ", turnsSinceLastScenario, " >= ", timeBetweenScenarios, "?", turnsSinceLastScenario >= timeBetweenScenarios);
    
        if (turnsSinceLastScenario >= timeBetweenScenarios) {
            const randomIndex = getRandomInt(0,params.catalog.length - 1);
            var indexToUse = randomIndex;

            Constants.debug.logScenarios && console.error("random index: ", randomIndex);
            while (usedScenarioIndices.includes(indexToUse) || params.catalog[indexToUse].firstEligibleTurn > turn || params.catalog[indexToUse].lastEligibleTurn < turn) {
                
                Constants.debug.logScenarios && console.error("can't use index: ", randomIndex);
                indexToUse = (indexToUse+1) % params.catalog.length;
                if (indexToUse === randomIndex) {
                  // all the scenarios have been used!
                  return undefined;
                }
            }

            return indexToUse;
          }
      }
      
      return undefined;
    }


    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the inputs
    // from previous node runs.
    //
    async runImpl({params, record, seed}) {

      let returnVal = {
        state: "completed",
        eventsEmitted: ["completed"],
        output: {
            result: {
                "text": "",
            },
        },
      }

      let turn = this.getLocalVariable(record, "turn", 0);
      const lastScenarioTurn = this.getLocalVariable(record, "lastScenarioTurn", 0);
      turn++;
      this.setLocalVariable(record, "turn", turn);

      let usedScenarioIndices = this.getLocalVariable(record, "usedScenarioIndices", []);

      let scenarioIndex = this.getScenarioIfItsTime(params, turn, lastScenarioTurn, usedScenarioIndices);
      
      if (typeof scenarioIndex !== "undefined") {

        usedScenarioIndices.push(scenarioIndex);
        this.setLocalVariable(record, "lastScenarioTurn", turn);
        this.setLocalVariable(record, "usedScenarioIndices", usedScenarioIndices);
        const scenario = params.catalog[scenarioIndex];
        
        returnVal.output.result["text"] = scenario.text;

      } else {

       console.error("No scenario this turn");
      }

      return returnVal;
  }
}