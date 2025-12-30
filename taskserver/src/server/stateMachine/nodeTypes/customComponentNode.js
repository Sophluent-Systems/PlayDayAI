import { nodeType } from "./nodeType";

export class customComponentNode extends nodeType {
    constructor({ db, session, fullNodeDescription }) {
        super({ db, session, fullNodeDescription });
    }

    async runImpl() {
        const instanceName = this.fullNodeDescription?.instanceName || this.fullNodeDescription?.instanceID || "customComponent";
        throw new Error(`Custom component node "${instanceName}" should have been inlined before execution.`);
    }
}
