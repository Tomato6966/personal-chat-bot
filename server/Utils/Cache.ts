import { AIMessage } from "../Types";

export const prompts = new Map<string, string>();
export const chatHistory = new Map<string, AIMessage[]>();
export const cachedModels = new Map<string, string[]>();
