import { Constants } from "@src/common/defaultconfig";

const DEFAULT_MEDIA_TYPE = "text";
const DEFAULT_VERSION = { major: 0, minor: 1, patch: 0 };
const PORT_PREFIX = {
  input: "input",
  output: "output",
  event: "event",
};

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

function coerceBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return Boolean(value);
}

function normalizeVersion(version = {}) {
  if (typeof version === "string") {
    const parts = version.split(".").map((part) => parseInt(part, 10));
    return {
      major: Number.isFinite(parts[0]) ? parts[0] : DEFAULT_VERSION.major,
      minor: Number.isFinite(parts[1]) ? parts[1] : DEFAULT_VERSION.minor,
      patch: Number.isFinite(parts[2]) ? parts[2] : DEFAULT_VERSION.patch,
    };
  }
  return {
    major: Number.isFinite(version.major) ? version.major : DEFAULT_VERSION.major,
    minor: Number.isFinite(version.minor) ? version.minor : DEFAULT_VERSION.minor,
    patch: Number.isFinite(version.patch) ? version.patch : DEFAULT_VERSION.patch,
  };
}

function resolveLibrary(library) {
  if (library) {
    return library;
  }
  const libraries = Constants?.customComponents?.libraries;
  if (libraries?.personal) {
    return "personal";
  }
  return Object.keys(libraries || {})[0] || "personal";
}

function normalizePort(port = {}, index, kind) {
  const prefix = PORT_PREFIX[kind] ?? kind ?? "port";
  const handle = port.handle || port.id || `${prefix}-${index}`;
  const label = port.label || port.name || handle;
  const mediaType = port.mediaType || DEFAULT_MEDIA_TYPE;
  const required = coerceBoolean(port.required);
  const node = port.nodeInstanceID || port.node || null;
  const resolvedPortType = port.portType || port.type || port.annotations?.portType;
  const portType = resolvedPortType || (kind === "event" ? "event" : "variable");
  const inferredMediaType =
    portType === "event" ? "event" : mediaType;
  const portName = port.portName || port.name || null;
  return {
    id: handle,
    handle,
    kind,
    label,
    mediaType: inferredMediaType,
    required,
    nodeInstanceID: node,
    portType,
    portName,
    description: port.description || "",
    defaultValue: port.defaultValue,
    annotations: port.annotations || {},
  };
}

function collectNestedComponentRefs(nodes = []) {
  const refs = new Set();
  nodes.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.nodeType === "customComponent") {
      const componentID = node?.params?.componentID || node.componentID;
      if (componentID) {
        refs.add(componentID);
      }
    }
  });
  return Array.from(refs);
}

function normalizeOwner(owner = {}) {
  if (typeof owner === "string") {
    return { type: "user", id: owner };
  }
  if (!owner || typeof owner !== "object") {
    return { type: "user", id: null };
  }
  const type = owner.type || "user";
  const id = owner.id || owner.userID || null;
  return { type, id };
}

export function normalizeCustomComponentDefinition(definition = {}) {
  const normalizedInputs = ensureArray(definition.exposedInputs).map((port, index) =>
    normalizePort(port, index, "input"),
  );
  const normalizedOutputs = ensureArray(definition.exposedOutputs).map((port, index) =>
    normalizePort(port, index, "output"),
  );
  const normalizedEvents = ensureArray(definition.exposedEvents).map((port, index) =>
    normalizePort(port, index, "event"),
  );

  const nestedRefs = collectNestedComponentRefs(definition.nodes);

  const normalized = {
    componentID: definition.componentID || definition.id || null,
    name: definition.name || "Untitled Component",
    description: definition.description || "",
    version: normalizeVersion(definition.version),
    owner: normalizeOwner(definition.owner),
    library: resolveLibrary(definition.library),
    tags: ensureArray(definition.tags).filter(Boolean),
    nodes: ensureArray(definition.nodes),
    connections: ensureArray(definition.connections),
    exposedInputs: normalizedInputs,
    exposedOutputs: normalizedOutputs,
    exposedEvents: normalizedEvents,
    ghostNodes: ensureArray(definition.ghostNodes),
    dependencies: nestedRefs,
    metadata: {
      createdAt: definition.metadata?.createdAt || null,
      updatedAt: definition.metadata?.updatedAt || null,
    },
    allowNesting: definition.allowNesting ?? true,
    unbundleStrategy: definition.unbundleStrategy || "inline",
  };

  return normalized;
}

export function getComponentPortSummary(definition) {
  const normalized = normalizeCustomComponentDefinition(definition);
  return {
    inputs: normalized.exposedInputs.map((port) => ({
      value: port.handle,
      label: port.label,
      mediaType: port.mediaType,
      required: port.required,
      nodeInstanceID: port.nodeInstanceID,
      portType: port.portType,
      portName: port.portName,
    })),
    outputs: normalized.exposedOutputs.map((port) => ({
      value: port.handle,
      label: port.label,
      mediaType: port.mediaType,
      nodeInstanceID: port.nodeInstanceID,
      portType: port.portType,
      portName: port.portName,
    })),
    events: normalized.exposedEvents.map((event) => ({
      value: event.handle,
      label: event.label,
      nodeInstanceID: event.nodeInstanceID,
      portType: event.portType,
      portName: event.portName,
    })),
  };
}

export function detectRecursiveInclusion(componentID, registry, trail = []) {
  if (!componentID || !registry) {
    return null;
  }
  if (trail.includes(componentID)) {
    return [...trail, componentID];
  }
  const definition = registry.get(componentID);
  if (!definition) {
    return null;
  }
  const normalized = normalizeCustomComponentDefinition(definition);
  if (!normalized.dependencies.length) {
    return null;
  }
  const nextTrail = [...trail, componentID];
  for (const nestedID of normalized.dependencies) {
    const cycle = detectRecursiveInclusion(nestedID, registry, nextTrail);
    if (cycle) {
      return cycle;
    }
  }
  return null;
}

function getMaxNestingDepth() {
  const value = Constants?.customComponents?.maxNestingDepth;
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 5;
}

export function validateCustomComponentDefinition(definition, options = {}) {
  const normalized = normalizeCustomComponentDefinition(definition);
  const registry = options.registry;

  if (!normalized.nodes.length) {
    throw new Error("Custom Component must include at least one node.");
  }

  const handles = new Set();
  [...normalized.exposedInputs, ...normalized.exposedOutputs, ...normalized.exposedEvents].forEach(
    (port) => {
      if (!port.handle) {
        throw new Error("Exposed ports require a stable handle.");
      }
      if (handles.has(port.handle)) {
        throw new Error(`Duplicate exposed port handle detected: ${port.handle}`);
      }
      handles.add(port.handle);
    },
  );

  if (registry && normalized.componentID) {
    const cycle = detectRecursiveInclusion(normalized.componentID, registry);
    if (cycle) {
      throw new Error(`Recursive component inclusion detected: ${cycle.join(" -> ")}`);
    }
  }

  if (
    !options.skipDepthCheck &&
    Number.isFinite(options.nestingDepth) &&
    options.nestingDepth >= getMaxNestingDepth()
  ) {
    throw new Error("Maximum Custom Component nesting depth exceeded.");
  }

  return normalized;
}

export function getComponentDefinitionFromNode(node, options = {}) {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (node.customComponentDefinition) {
    return normalizeCustomComponentDefinition(node.customComponentDefinition);
  }

  const inline =
    node.params?.customComponentDefinition ||
    node.params?.definition ||
    node.definition ||
    node.customComponent;
  if (inline) {
    return normalizeCustomComponentDefinition(inline);
  }

  const componentID = node.params?.componentID || node.componentID;
  if (!componentID) {
    return null;
  }

  if (options.registry && typeof options.registry.get === "function") {
    const found = options.registry.get(componentID);
    if (found) {
      return normalizeCustomComponentDefinition(found);
    }
  }

  if (options.definitions && options.definitions[componentID]) {
    return normalizeCustomComponentDefinition(options.definitions[componentID]);
  }

  if (Array.isArray(options.definitions)) {
    for (const definition of options.definitions) {
      const normalized = normalizeCustomComponentDefinition(definition);
      if (normalized.componentID === componentID) {
        return normalized;
      }
    }
  }

  return null;
}

export function getComponentPortMetadataForNode(node, options = {}) {
  const definition = getComponentDefinitionFromNode(node, options);
  if (!definition) {
    return { inputs: [], outputs: [], events: [] };
  }
  return getComponentPortSummary(definition);
}

export function listComponentDependencies(definition) {
  const normalized = normalizeCustomComponentDefinition(definition);
  return normalized.dependencies;
}

export function mergeComponentRegistries(...registries) {
  const merged = new Map();
  registries.forEach((registry) => {
    if (!registry) {
      return;
    }
    if (registry instanceof Map) {
      registry.forEach((value, key) => {
        merged.set(key, value);
      });
      return;
    }
    if (Array.isArray(registry)) {
      registry.forEach((definition) => {
        const normalized = normalizeCustomComponentDefinition(definition);
        if (normalized.componentID) {
          merged.set(normalized.componentID, normalized);
        }
      });
      return;
    }
    if (typeof registry === "object") {
      Object.keys(registry).forEach((key) => {
        merged.set(key, normalizeCustomComponentDefinition(registry[key]));
      });
    }
  });
  return merged;
}

export function isCustomComponentNode(node) {
  return Boolean(node && node.nodeType === "customComponent");
}

export function createGhostHandleDescriptors(definition) {
  const normalized = normalizeCustomComponentDefinition(definition);
  const descriptors = [];
  normalized.exposedInputs.forEach((port, index) => {
    descriptors.push({
      id: `ghost-input-${port.handle}`,
      kind: "input",
      label: port.label,
      index,
      mediaType: port.mediaType,
    });
  });
  normalized.exposedOutputs.forEach((port, index) => {
    descriptors.push({
      id: `ghost-output-${port.handle}`,
      kind: "output",
      label: port.label,
      index,
      mediaType: port.mediaType,
    });
  });
  normalized.exposedEvents.forEach((port, index) => {
    descriptors.push({
      id: `ghost-event-${port.handle}`,
      kind: "event",
      label: port.label,
      index,
    });
  });
  return descriptors;
}
