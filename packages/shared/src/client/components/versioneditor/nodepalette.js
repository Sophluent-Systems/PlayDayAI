'use client';

import { getMetadataForNodeType } from "@src/common/nodeMetadata";

export const NODE_GROUP_PALETTES = {
  "user-input": {
    backgroundColor: "rgba(245, 158, 11, 0.22)",
    borderColor: "rgba(251, 191, 36, 0.6)",
    textColor: "#fff7ed",
    secondaryColor: "rgba(253, 230, 138, 0.78)",
    dotColor: "rgba(252, 211, 77, 0.9)",
    shadow: "0 18px 45px -25px rgba(245, 158, 11, 0.4)",
    hoverClass: "hover:border-amber-300/80 hover:shadow-[0_16px_40px_-20px_rgba(245,158,11,0.55)]",
  },
  "ai-generation": {
    backgroundColor: "rgba(56, 189, 248, 0.22)",
    borderColor: "rgba(96, 165, 250, 0.6)",
    textColor: "#e0f2fe",
    secondaryColor: "rgba(186, 230, 253, 0.78)",
    dotColor: "rgba(165, 243, 252, 0.9)",
    shadow: "0 18px 45px -25px rgba(56, 189, 248, 0.4)",
    hoverClass: "hover:border-sky-300/80 hover:shadow-[0_16px_40px_-20px_rgba(56,189,248,0.55)]",
  },
  media: {
    backgroundColor: "rgba(217, 70, 239, 0.22)",
    borderColor: "rgba(232, 121, 249, 0.6)",
    textColor: "#f5d0fe",
    secondaryColor: "rgba(245, 208, 254, 0.78)",
    dotColor: "rgba(232, 121, 249, 0.9)",
    shadow: "0 18px 45px -25px rgba(232, 121, 249, 0.4)",
    hoverClass: "hover:border-fuchsia-300/80 hover:shadow-[0_16px_40px_-20px_rgba(232,121,249,0.55)]",
  },
  logic: {
    backgroundColor: "rgba(16, 185, 129, 0.22)",
    borderColor: "rgba(52, 211, 153, 0.6)",
    textColor: "#d1fae5",
    secondaryColor: "rgba(167, 243, 208, 0.78)",
    dotColor: "rgba(52, 211, 153, 0.9)",
    shadow: "0 18px 45px -25px rgba(52, 211, 153, 0.4)",
    hoverClass: "hover:border-emerald-300/80 hover:shadow-[0_16px_40px_-20px_rgba(52,211,153,0.55)]",
  },
  data: {
    backgroundColor: "rgba(99, 102, 241, 0.22)",
    borderColor: "rgba(129, 140, 248, 0.6)",
    textColor: "#e0e7ff",
    secondaryColor: "rgba(199, 210, 254, 0.78)",
    dotColor: "rgba(165, 180, 252, 0.9)",
    shadow: "0 18px 45px -25px rgba(99, 102, 241, 0.4)",
    hoverClass: "hover:border-indigo-300/80 hover:shadow-[0_16px_40px_-20px_rgba(99,102,241,0.55)]",
  },
  other: {
    backgroundColor: "rgba(148, 163, 184, 0.22)",
    borderColor: "rgba(148, 163, 184, 0.6)",
    textColor: "#e2e8f0",
    secondaryColor: "rgba(203, 213, 225, 0.78)",
    dotColor: "rgba(226, 232, 240, 0.9)",
    shadow: "0 18px 45px -25px rgba(148, 163, 184, 0.4)",
    hoverClass: "hover:border-slate-300/70 hover:shadow-[0_16px_40px_-20px_rgba(148,163,184,0.5)]",
  },
};

const GROUP_RESOLUTION = [
  {
    key: "user-input",
    match: (_nodeType, metadata) => Boolean(metadata?.nodeAttributes?.userInput),
  },
  {
    key: "ai-generation",
    match: (nodeType) => ["llm", "llmData", "staticText", "imagePromptWriter", "suggestionsWriter", "scenario"].includes(nodeType),
  },
  {
    key: "media",
    match: (nodeType, metadata) =>
      ["imageGenerator", "tts", "stt", "audioPlayback"].includes(nodeType) ||
      (metadata?.nodeAttributes?.mediaTypes || []).length > 0,
  },
  {
    key: "logic",
    match: (nodeType) => ["ifThenElse", "forLoop", "whileLoop", "delay", "randomNumber"].includes(nodeType),
  },
  {
    key: "data",
    match: (nodeType) => ["codeBlock", "fileStore", "arrayIterator", "arrayIndex"].includes(nodeType),
  },
];

export function resolveNodeGroupKey(nodeType, metadata) {
  const resolvedMetadata = metadata ?? getMetadataForNodeType(nodeType);
  const matched = GROUP_RESOLUTION.find((group) => group.match(nodeType, resolvedMetadata));
  return matched?.key ?? "other";
}

export function getPaletteForNode(nodeType, metadata) {
  const key = resolveNodeGroupKey(nodeType, metadata);
  return NODE_GROUP_PALETTES[key] ?? NODE_GROUP_PALETTES.other;
}

export function getVisualsForNode(nodeType, metadata) {
  const palette = getPaletteForNode(nodeType, metadata);
  return {
    backgroundColor: palette.backgroundColor,
    borderColor: palette.borderColor,
    textColor: palette.textColor,
    secondaryColor: palette.secondaryColor,
    dotColor: palette.dotColor,
    shadow: palette.shadow,
    hoverClass: palette.hoverClass,
  };
}

export function buildContainerStylingFromPalette(palette) {
  if (!palette) {
    return {};
  }

  return {
    backgroundColor: palette.backgroundColor,
    borderColor: palette.borderColor,
    color: palette.textColor,
  };
}

export function buildVisualsFromStyling(styling = {}) {
  const backgroundColor = styling.backgroundColor ?? "rgba(12, 26, 48, 0.85)";
  const borderColor = styling.borderColor ?? "rgba(148, 163, 184, 0.45)";
  const textColor = styling.color ?? "#f8fafc";

  return {
    backgroundColor,
    borderColor,
    textColor,
    secondaryColor: "rgba(248, 250, 252, 0.75)",
    dotColor: textColor,
    shadow: "0 18px 45px -25px rgba(148, 163, 184, 0.4)",
    hoverClass: "hover:border-white/50 hover:shadow-[0_16px_40px_-20px_rgba(148,163,184,0.5)]",
  };
}

export function nodeUsesCustomPersona(node, metadata) {
  if (!node?.personaLocation) {
    return false;
  }

  const defaultPersona = metadata?.defaultPersona;
  const { source, personaID } = node.personaLocation;

  if (source !== "builtin") {
    return true;
  }

  if (personaID && defaultPersona && personaID !== defaultPersona) {
    return true;
  }

  return false;
}
