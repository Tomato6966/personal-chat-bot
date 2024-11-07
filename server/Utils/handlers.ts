import { existsSync, readFileSync, writeFileSync } from "fs";
import Groq from "groq-sdk";
import { Ollama } from "ollama";
import { join } from "path";

import defaults_imported from "../../defaults.json";
import { APIS } from "../Types";
import { cachedModels, prompts } from "./Cache";

const APIKEYS = process.env.GROQ_API_KEY?.split(" ") || [];

const groqs = new Map<string, number>(Array.from({ length: APIKEYS?.length }, (_, i) => ([APIKEYS[i], 0])));

export const getGroq = () => {
    const vals = Array.from(groqs.entries());
    const [leastUsedId, leastUsedCalls] = vals.sort((a, b) => a[1] - b[1])[0];
    if(!leastUsedId) throw new Error("No groq instances available");
    groqs.set(leastUsedId, leastUsedCalls + 1);
    return new Groq({ apiKey: leastUsedId });
}

export const ollama = new Ollama();
export const promptsFilePath = join(__dirname, '../../prompts.json');
export const defaults = defaults_imported;

export const centerString = (str: string, width: number) => {
    const spaces = width - str.length;
    const left = Math.floor(spaces / 2);
    const right = spaces - left;
    return `${" ".repeat(left)}${str}${" ".repeat(right)}`;
}

export const getDateFormatted = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds().toFixed(4)}`;
}

export const fetchModels = async (api:APIS) => {
    if(cachedModels.has(api)) {
        return cachedModels.get(api);
    }
    const groq = getGroq();
    let models:string[] = [];
    switch(api) {
        case "groq": models = (await groq.models.list()).data.map(model => model.id); break;
        case "ollama": models = (await ollama.list()).models.map(model => model.name); break;
        // case "openai": break;
        // case "huggingface": break;
        // case "openrouter": break;
    };
    cachedModels.set(api, models);
    return models
}

export const loadPrompts = () => {
    if (!existsSync(promptsFilePath)) return console.error("tried to load prompts, but fiel doesn't exist");
    const data = readFileSync(promptsFilePath, 'utf-8');
    const promptsData = JSON.parse(data);
    const entries = Object.entries(promptsData) as [string, string][];
    for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        prompts.set(key, value);
    }
    return;
};

export const savePrompts = () => {
    const data = JSON.stringify(Object.fromEntries(prompts), null, 2);
    writeFileSync(promptsFilePath, data);
    loadPrompts();
    return;
};
