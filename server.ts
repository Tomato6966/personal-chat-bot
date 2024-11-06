import dotenv from "dotenv";
import express from "express";
import { existsSync, readFileSync, writeFileSync } from "fs";
import Groq from "groq-sdk";
import { Ollama } from "ollama";
import path from "path";

import defaults from "./defaults.json";

dotenv.config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ollama = new Ollama();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for prompts and chat history

let prompts = new Map<string, string>();
const promptsFilePath = path.join(__dirname, 'prompts.json');
const loadPrompts = () => {
    if (existsSync(promptsFilePath)) {
        const data = readFileSync(promptsFilePath, 'utf-8');
        const promptsData = JSON.parse(data);
        prompts = new Map(Object.entries(promptsData));
    }
};

const savePrompts = () => {
    const data = JSON.stringify(Object.fromEntries(prompts), null, 2);
    writeFileSync(promptsFilePath, data);
};

loadPrompts();


type AIMessage = { role: string, content: string };
const history: Array<AIMessage> = [];

app.use(express.static(path.join(__dirname, 'client/build')));


// Save a system prompt
app.post('/api/prompts', (req, res) => {
    const { id, content } = req.body;
    prompts.set(id, content);
    res.status(200).send({ message: 'Prompt saved!' });
});


const cachedModels = new Map<string, string[]>();

const fetchModels = async (api:APIS) => {
    if(cachedModels.has(api)) {
        return cachedModels.get(api);
    }
    let models = [];
    switch(api) {
        case "groq": models = (await groq.models.list()).data.map(model => model.id); break;
        case "ollama": models = (await ollama.list()).models.map(model => model.name); break;
    };
    cachedModels.set(api, models);
    return models
}

app.get('/api/models', async (req, res) => {
    const { api } = req.query as { api: APIS };
    res.send(await fetchModels(api));
    return;
})

// Edit an existing prompt
app.put('/api/prompts/:id', (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    if (prompts.has(id)) {
        prompts.set(id, content);
        savePrompts();
        res.status(200).send({ message: 'Prompt updated!' });
    } else {
        res.status(404).send({ error: 'Prompt not found' });
    }
});

// Get all prompts
app.get('/api/prompts', (req, res) => {
    res.json(Array.from(prompts.entries()));
});

const addHistory = (content: string, role: "system" | "user" | "assistant") => {
    history.push({ role, content });
    if (history.length > defaults.maxHistory) history.shift();
};

export type APIS = "ollama" | "groq";
// Send a chat message and get a response
app.post('/api/chat', async (req, res) => {
    const { modelId, promptId, message, temperature, stream, api = "groq" } = req.body as {
        promptId: string,
        message: string,
        modelId: string,
        api?: APIS;
        temperature?: number,
        stream?: "true" | "false",
    };

    if(!cachedModels.has(api)) {
        await fetchModels(api);
    }
    const models = cachedModels.get(api);
    if(!models?.includes(modelId)) {
        console.error("COULD NOT FIND MODEL", { modelId, models });
        res.status(404).send({ error: 'Model not found' });
        return;
    }

    const systemContent = prompts.get(promptId) || '';
    const systemMessage = { role: 'system', content: systemContent } as AIMessage;

    addHistory(message, "user");

    const useStream = stream === "true" ? true : stream === "false" ? false : defaults.stream;
    if (useStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
    }

    try {
        const handleData = async (completion:any, getData: (completion:any) => string) => {
            try {
                if(!useStream) {
                    const responseContent = getData(completion);
                    if(responseContent) addHistory(responseContent, "assistant");
                    await res.status(200).json({ response: responseContent });
                    return;
                }

                const bundled:string[] = [];

                for await (const chunk of completion) {
                    const content = getData(chunk)
                    bundled.push(content);
                    await res.status(200).write(`data: ${JSON.stringify({ content })}\n\n`);
                }

                addHistory(bundled.join(""), "assistant");

                await res.status(200).write('data: [DONE]\n\n');
                await res.status(200).end();

                return;
            } catch (error) {
                console.error('Error fetching completion:', error);
            }
        }

        switch (api) {
            default:
            case "ollama": {
                // ollama completion localhost api:
                const completion = await ollama.chat(
                    {
                        model: modelId,
                        messages: systemContent.length ? [systemMessage, ...history] : [...history],
                        // @ts-expect-error boolean is not assignable to false
                        stream: useStream,
                        options: {
                            temperature: temperature || defaults.temperature,
                        }
                    }
                );
                handleData(completion, (comp) => comp.message.content);
                return;
            } break;

            case "groq": {
                const completion = await groq.chat.completions.create(
                    {
                        messages: (systemContent.length ? [systemMessage, ...history] : [...history]) as Groq.Chat.ChatCompletionMessageParam[],
                        model: modelId,
                        stream: useStream,
                        temperature: temperature || defaults.temperature,
                    },
                );

                handleData(completion, (comp) => useStream ? comp.choices[0]?.delta?.content : comp.choices[0]?.message.content);
                return;
            } break;
        }
    } catch (error) {
        console.error('Error fetching completion:', error);
        res.status(500).json({ error: 'Failed to fetch completion' });
    }
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client/build', 'index.html')));


// Start the server on port 80
app.listen(80, () => {
    console.log('Chatbot server running on http://localhost');
});
