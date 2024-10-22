import { BuiltInPersonas } from "@src/common/builtinpersonas";
import { getMetadataForNodeType } from "@src/common/nodeMetadata";

export function getPersonaFromLocation(versionInfo, personaLocation) {
    let persona = null;
    if (personaLocation.source === "inline") {
        persona = personaLocation.persona;
    } else if (personaLocation.source === "builtin") {
        const index = BuiltInPersonas.findIndex((persona) => persona.personaID === personaLocation.personaID);
        persona = BuiltInPersonas[index];
    } else if (personaLocation.source === "version" && versionInfo.personas && versionInfo.personas.length > 0) {
        const index = versionInfo.personas.findIndex((persona) => persona.personaID === personaLocation.personaID);
        persona = versionInfo.personas[index];
    }

    return persona;
}

export function getNodePersonaDetails(versionInfo, node) {
    
    let persona = null;
    if (node.personaLocation) {
        persona = getPersonaFromLocation(versionInfo, node.personaLocation);
    }
    if (!persona) {
        const nodeMetadata = getMetadataForNodeType(node.nodeType);
        const nodeAttributes =  nodeMetadata.nodeAttributes;
        const defaultPersonaLocation = {
            source: "builtin",
            personaID: nodeMetadata.defaultPersona,
        };
        const index = BuiltInPersonas.findIndex((persona) => persona.personaID === defaultPersonaLocation.personaID);
        persona = BuiltInPersonas[index];
    }

    return persona;
}
