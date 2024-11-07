import { Express } from "express";
import { writeFileSync } from "fs";

import { AIMessage, APIS } from "../Types";
import { cachedModels, prompts } from "../Utils/Cache";
import { defaults, fetchModels, groq, ollama } from "../Utils/handlers";

import type Groq from "groq-sdk";

export const chatRoutes = (app: Express) => {
    // Send a chat message and get a response
    app.post('/api/chat', async (req, res) => {
        const { images, modelId, promptId, chatHistory, temperature, stream, api = "groq" } = req.body as {
            promptId: string,
            chatHistory: { role: string, content: string, state: "loading" | "success" | "failed" }[],
            images: string[],
            modelId: string,
            api?: APIS;
            temperature?: number,
            stream?: "true" | "false",
        };

        const history = chatHistory.slice(chatHistory.length - defaults.maxHistory, chatHistory.length);

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

        if(images.length) writeFileSync(process.cwd() + "/test.json", JSON.stringify({ images }));

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
                        await res.status(200).json({ response: responseContent });
                        return;
                    }

                    const bundled: string[] = [];

                    for await (const chunk of completion) {
                        const content = getData(chunk)
                        bundled.push(content);
                        await res.status(200).write(`data: ${JSON.stringify({ content })}\n\n`);
                    }

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
                    const lastUserRequest = history.map(v => v.role).lastIndexOf("user");
                    const only1UserRequest = modelId.includes("llava") && lastUserRequest > -1;
                    const historyMapped = history
                        .filter((v, i) => !only1UserRequest || (only1UserRequest && (v.role !== "user" || i === lastUserRequest)))
                        .map((v, i) => ({
                            content: v.content,
                            images: images?.length && (history.length - 1) === i ? images.map(img => {
                                const cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg);base64,/, '').trim();
                                try {
                                    atob(cleanBase64)
                                    return cleanBase64;
                                } catch (error) {
                                    console.error("Invalid base64 string:", error, cleanBase64);
                                    return null;
                                }
                            }).filter(v => typeof v === "string") : [],
                            role: v.role,
                        }));
                    const completion = await ollama.chat(
                        {
                            model: modelId,
                            messages: systemContent.length ? [
                                systemMessage,
                                ...historyMapped
                            ] : [
                                ...historyMapped,
                            ],
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
                    const only1UserRequest = modelId.includes("llava");
                    const lastUserRequest = history.reverse().findIndex(v => v.role === "user");
                    const historyMapped = history
                        .filter((v, i) => !only1UserRequest || (only1UserRequest && (v.role !== "user" || i === lastUserRequest)))
                        .map((v, i) => ({
                        content: (v.role === "user" && images?.length && (history.length - 1) !== i)
                        ? [
                            {
                                "type": "text",
                                "text": v.content
                            },
                            ...images.map(base64Url => ({
                                "type": "image_url",
                                "image_url": { "url": base64Url }
                            }))
                        ] : v.content,
                        role: v.role,
                    }));
                    writeFileSync(process.cwd() + "/test.json", JSON.stringify({ messages: (systemContent.length ? [systemMessage, ...historyMapped] : [...historyMapped]) as Groq.Chat.ChatCompletionMessageParam[],
                        model: modelId,
                        stream: useStream,
                        temperature: temperature || defaults.temperature,
                    }));
                    const completion = await groq.chat.completions.create(
                        {
                            messages: (systemContent.length ? [systemMessage, ...historyMapped] : [...historyMapped]) as Groq.Chat.ChatCompletionMessageParam[],
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
