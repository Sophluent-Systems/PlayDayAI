import { normalizeCustomComponentDefinition, validateCustomComponentDefinition, mergeComponentRegistries } from "@src/common/customcomponents";

export class CustomComponentRegistry {
    constructor(options = {}) {
        this.maxNestingDepth = Number.isFinite(options.maxNestingDepth)
            ? options.maxNestingDepth
            : undefined;
        this.registry = new Map();
        if (options.definitions) {
            this.registerMany(options.definitions, { skipDepthCheck: true });
        }
    }

    clone() {
        const clone = new CustomComponentRegistry({
            maxNestingDepth: this.maxNestingDepth,
        });
        clone.registry = new Map(this.registry);
        return clone;
    }

    register(definition, options = {}) {
        const normalized = validateCustomComponentDefinition(definition, {
            registry: this.registry,
            skipDepthCheck: options.skipDepthCheck,
            nestingDepth: options.nestingDepth,
        });
        if (!normalized.componentID) {
            throw new Error("Custom Component definitions must include a componentID.");
        }
        this.registry.set(normalized.componentID, normalized);
        return normalized;
    }

    registerMany(definitions, options = {}) {
        if (!definitions) {
            return;
        }
        if (Array.isArray(definitions)) {
            definitions.forEach((definition) => this.register(definition, options));
        } else if (definitions instanceof Map) {
            definitions.forEach((definition) => this.register(definition, options));
        } else if (typeof definitions === "object") {
            Object.keys(definitions).forEach((key) => {
                const definition = definitions[key];
                if (definition) {
                    const normalized = { componentID: key, ...definition };
                    this.register(normalized, options);
                }
            });
        }
    }

    mergeWith(...registries) {
        const merged = mergeComponentRegistries(this.registry, ...registries);
        const clone = new CustomComponentRegistry({ maxNestingDepth: this.maxNestingDepth });
        merged.forEach((definition, key) => {
            clone.registry.set(key, definition);
        });
        return clone;
    }

    hydrateFromVersionInfo(versionInfo) {
        if (!versionInfo || typeof versionInfo !== "object") {
            return;
        }
        const graph = versionInfo.stateMachineDescription || {};
        const definitions =
            graph.customComponents ||
            graph.componentDefinitions ||
            versionInfo.customComponents ||
            [];
        this.registerMany(definitions, { skipDepthCheck: true });
    }

    resolve(componentID) {
        if (!componentID) {
            return null;
        }
        return this.registry.get(componentID) || null;
    }

    has(componentID) {
        return this.registry.has(componentID);
    }

    list() {
        return Array.from(this.registry.values());
    }

    get size() {
        return this.registry.size;
    }
}

