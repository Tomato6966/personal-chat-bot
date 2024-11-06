import { Express } from "express";

import { AIMessage, APIS } from "../Types";
import { cachedModels, chatHistory, prompts } from "../Utils/Cache";
import { addHistory, defaults, fetchModels, groq, ollama } from "../Utils/handlers";

import type Groq from "groq-sdk";

export const chatRoutes = (app: Express) => {
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

        const historyKey = "chrissy8283"; // add the unique user identifier / chat thread ...

        if (!cachedModels.has(api)) {
            await fetchModels(api);
        }
        const models = cachedModels.get(api);
        if (!models?.includes(modelId)) {
            console.error("COULD NOT FIND MODEL", { modelId, models });
            res.status(404).send({ error: 'Model not found' });
            return;
        }

        const systemContent = prompts.get(promptId) || '';
        const systemMessage = { role: 'system', content: systemContent } as AIMessage;

        addHistory(historyKey, message, "user");

        const useStream = stream === "true" ? true : stream === "false" ? false : defaults.stream;
        if (useStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
        }

        try {
            const handleData = async (completion: any, getData: (completion: any) => string) => {
                try {
                    if (!useStream) {
                        const responseContent = getData(completion);
                        if (responseContent) addHistory(historyKey, responseContent, "assistant");
                        await res.status(200).json({ response: responseContent });
                        return;
                    }

                    const bundled: string[] = [];

                    for await (const chunk of completion) {
                        const content = getData(chunk)
                        bundled.push(content);
                        await res.status(200).write(`data: ${JSON.stringify({ content })}\n\n`);
                    }

                    addHistory(historyKey, bundled.join(""), "assistant");

                    await res.status(200).write('data: [DONE]\n\n');
                    await res.status(200).end();

                    return;
                } catch (error) {
                    console.error('Error fetching completion:', error);
                }
            }
            const oldHistory = chatHistory.get(historyKey) || [];

            switch (api) {
                default:
                case "ollama": {
                    const completion = await ollama.chat(
                        {
                            model: modelId,
                            messages: systemContent.length ? [systemMessage, ...oldHistory] : [...oldHistory],
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

                // case "openai": break;
                // case "huggingface": break;
                // case "openrouter": break;

                case "groq": {
                    const completion = await groq.chat.completions.create(
                        {
                            messages: (systemContent.length ? [systemMessage, ...oldHistory] : [...oldHistory]) as Groq.Chat.ChatCompletionMessageParam[],
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
}
