import { nodeType } from "./nodeType";

export class customComponentNode extends nodeType {
    constructor({ db, session, fullNodeDescription, componentRegistry }) {
        super({ db, session, fullNodeDescription });
        this.componentRegistry = componentRegistry || null;
        this.componentDefinition =
            fullNodeDescription?.resolvedComponentDefinition || null;
    }

    setComponentRegistry(registry) {
        this.componentRegistry = registry || null;
        if (!this.componentDefinition) {
            this.componentDefinition = this.resolveComponentDefinition();
        }
    }

    setComponentDefinition(definition) {
        this.componentDefinition = definition || null;
    }

    resolveComponentDefinition() {
        if (this.componentDefinition) {
            return this.componentDefinition;
        }
        const componentID =
            this.fullNodeDescription?.params?.componentID ||
            this.fullNodeDescription?.componentID;
        if (!componentID) {
            return null;
        }
        if (this.componentRegistry?.resolve) {
            return this.componentRegistry.resolve(componentID);
        }
        return null;
    }

    buildEmptyOutputPayload(definition) {
        const payload = {};
        if (!definition) {
            return payload;
        }
        definition.exposedOutputs.forEach((port) => {
            if (!port?.handle) {
                return;
            }
            if (port.mediaType === "composite") {
                payload[port.handle] = null;
            } else {
                payload[port.handle] = {
                    [port.mediaType]: null,
                };
            }
        });
        return payload;
    }

    overwriteInputParams(inputs) {
        const definition = this.resolveComponentDefinition();
        if (!definition) {
            return {};
        }
        const portLookup = new Map();
        definition.exposedInputs.forEach((port) => {
            portLookup.set(port.handle, port);
        });
        const paramsToOverwrite = {};
        if (!Array.isArray(inputs)) {
            return paramsToOverwrite;
        }
        inputs.forEach((input) => {
            const values = input?.values;
            if (!values) {
                return;
            }
            Object.keys(values).forEach((handle) => {
                const port = portLookup.get(handle);
                const value = values[handle];
                if (!port) {
                    paramsToOverwrite[handle] = value;
                    return;
                }
                if (port.mediaType === "composite") {
                    paramsToOverwrite[handle] = value;
                } else {
                    paramsToOverwrite[handle] = value?.[port.mediaType] ?? null;
                }
            });
        });
        return paramsToOverwrite;
    }

    async runImpl({ stateMachine, record, inputs, channel, debuggingTurnedOn, seed, wasCancelled, keySource }) {
        const definition = this.resolveComponentDefinition();
        if (!definition) {
            throw new Error(
                `Custom Component node "${this.fullNodeDescription?.instanceName}" is missing a component definition.`,
            );
        }

        if (stateMachine?.executeCustomComponentNode) {
            return stateMachine.executeCustomComponentNode({
                nodeInstance: this,
                definition,
                record,
                inputs,
                channel,
                debuggingTurnedOn,
                seed,
                wasCancelled,
                keySource,
            });
        }

        return {
            state: "completed",
            eventsEmitted: ["completed"],
            output: this.buildEmptyOutputPayload(definition),
            context: {
                componentID: definition.componentID,
                componentName: definition.name,
            },
        };
    }
}
