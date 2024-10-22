import React from 'react';


export function getWarningsForNode(node) {
    let warnings = [];
    
    if (!node.isSourceNode && (node.instanceID !== 'start') && (!node.inputs || !node.inputs.length)) {
        warnings.push("This node has no inputs. It will not be run.");
    }

    if (warnings.length > 0) {
        return warnings;
    }

    return null;
}