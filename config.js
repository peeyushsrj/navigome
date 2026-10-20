/** @typedef {{id: string, name: string, window: [string, string], projects: number[], color: string}} State */

const config = {
  /** @type {State[]} */
  states: [
    { id: "morning", name: "Morning · Spiritual", window: ["05:00", "09:00"], projects: [14, 12], color: "#f4a261" },
    { id: "daytime", name: "Daytime · Work + Errands", window: ["09:00", "17:30"], projects: [6, 7], color: "#2a9d8f" },
    { id: "sunset", name: "Sunset · Nature", window: ["17:30", "18:30"], projects: [15], color: "#e76f51" },
    { id: "evening", name: "Evening · Errands", window: ["18:30", "21:30"], projects: [10, 11], color: "#8338ec" },
    { id: "night", name: "Night · Self-care", window: ["21:30", "05:00"], projects: [13], color: "#3a86ff" },
  ],
};

export default config;
