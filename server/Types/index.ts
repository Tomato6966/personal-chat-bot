export type AIMessage = { role: string, content: string, images?: string[] };
export enum APIS {
    "Ollama" = "ollama",
    "Groq" = "groq",
    "OpenAI" = "openai",
};
