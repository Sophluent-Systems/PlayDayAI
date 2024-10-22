import { nullUndefinedOrEmpty } from "@src/common/objects";


export function COMPAT_ensureV1InputStructure(versionInfo) {

    let updatesNeeded = {
        stateMachineDescription: {
            nodes: []
        }
    };

    // Loop all nodes and all inputs to all nodes
    if (!nullUndefinedOrEmpty(versionInfo.stateMachineDescription) && !nullUndefinedOrEmpty(versionInfo.stateMachineDescription.nodes)) {
        for (let i = 0; i < versionInfo.stateMachineDescription.nodes.length; i++) {
            let node = versionInfo.stateMachineDescription.nodes[i];
            if (!nullUndefinedOrEmpty(node.inputs) && node.inputs.length > 0) {
                for (let j = 0; j < node.inputs.length; j++) {
                    let input = node.inputs[j];
                    if (input.triggers && input.triggers.length > 0) {
                        if (!input.triggers && !input.variables) {

                            let newInput = {
                                producerInstanceID: input.producerInstanceID,
                                triggers: [],
                            };

                            //
                            // Convert old format to new
                            //
                            
                            // automatically this is a trigger
                            newInput.triggers.push({
                                producerEvent: 'completed',
                                targetTrigger: 'default',
                                includeHistory: input.includeHistory,
                                historyParams: input.historyParams,   
                            });

                            if (input.params && input.params.length > 0) {
                                newInput.variables = [];
                                for(let j = 0; j < input.params.length; j++) {
                                    let param = input.params[j];
                                    newInput.variables.push({
                                        producerOutput: 'result',
                                        consumerVariable: param.variable,
                                    });
                                }
                            }
                            node.inputs[j] = newInput;
                        }
                    }
                }
            }
            updatesNeeded.stateMachineDescription.nodes.push(node);
        }
    }

    return updatesNeeded;
}

export function COMPAT_generateUpdatesForVersion(versionInfo) {

    let updatesNeeded = {};

    if (!versionInfo.engineVersion) {

        const latestUpdatesNeeded = COMPAT_ensureV1InputStructure(versionInfo);

        updatesNeeded = {
            ...updatesNeeded,
            ...latestUpdatesNeeded
        }
    }


    return updatesNeeded;
}


export function COMPAT_ensureV1Recordtructure(record) {

    let updatesNeeded = {};

    if (record.eventsEmitted) {
        return {};
    }

    updatesNeeded.eventsEmitted = ["completed"];

    updatesNeeded.output = {
        result: record.output
    }

    return updatesNeeded;
}


export function COMPAT_generateUpdatesForRecord(record) {
    let updatesNeeded = {};

    if (!record.engineVersion) {
        updatesNeeded = {
            ...updatesNeeded,
            ...COMPAT_ensureV1RecordStructure(record)
        }
    }

    return updatesNeeded;
}