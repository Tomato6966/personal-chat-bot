import "./App.css";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import defaults from "../../defaults.json";
import { ChatEntry } from "./components/ChatEntry";
import { SelectModels } from "./components/Selects/Model";
import { SelectPrompts } from "./components/Selects/Prompts";
import { Streaming } from "./components/Selects/Streaming";
import { Temperature } from "./components/Selects/Temperature";
import { getModels } from "./handlers/getModels";

import type { APIS } from "../../server";
const queryClient = new QueryClient()

function App() {
    const [loading, setLoading] = useState(() => false);
    const [promptId, setPromptId] = useState(() => '');
    const [message, setMessage] = useState(() => '');
    const [chatHistory, setChatHistory] = useState<{ role: string, content: string }[]>(() => []);
    const [newPrompt, setNewPrompt] = useState(() => '');
    const [editPrompt, setEditPrompt] = useState(() => '');
    const [isEditing, setIsEditing] = useState(() => false);
    const [isFocused, setIsFocused] = useState(() => false);

    const [modelId, setModelId] = useState(() => {
        const storedModelId = localStorage.getItem('modelId');
        return (storedModelId && JSON.parse(storedModelId)) ?? '';
    });
    const [streaming, setStreaming] = useState(() => {
        const storedStreaming = localStorage.getItem('streaming');
        return (storedStreaming && JSON.parse(storedStreaming)) ?? defaults.stream;
    });
    const [temperature, setTemperature] = useState(() => {
        const storedTemperature = localStorage.getItem('temperature');
        return (storedTemperature && JSON.parse(storedTemperature)) ?? defaults.temperature;
    });
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const storedIsCollapsed = localStorage.getItem('isCollapsed');
        return (storedIsCollapsed && JSON.parse(storedIsCollapsed)) ?? false;
    });
    const [api, setAPI] = useState<APIS>(() => {
        const storedAPI = localStorage.getItem('api');
        return (storedAPI && JSON.parse(storedAPI)) ?? defaults.default_api as APIS;
    });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    console.log("RENDER API", api);

    // Save to localStorage when dependencies change
    useEffect(() => {
        localStorage.setItem('streaming', JSON.stringify(streaming));
        localStorage.setItem('temperature', JSON.stringify(temperature));
        localStorage.setItem('isCollapsed', JSON.stringify(isCollapsed));
        localStorage.setItem('api', JSON.stringify(api));
        localStorage.setItem('modelId', JSON.stringify(modelId));
    }, [streaming, temperature, isCollapsed, api, modelId]);

    // scroll to bottom when chatHistory changes
    useEffect(() => {
        chatHistoryRef.current?.scrollTo({
            top: chatHistoryRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }, [chatHistory]);

    // Send message to the chatbot (with streaming support)
    const sendMessage = async () => {
        if (!modelId?.length) {
            document.getElementById("model-select")?.focus();
            return alert("Pick a model first")
        };
        if (!message) return;

        if(textareaRef.current) textareaRef.current.style.height = '72px';
        setLoading(true);
        console.log("message", message)
        const userMessage = { role: 'user', content: message };
        setChatHistory((prev) => [...prev, userMessage]);

        try {
            const requestPayload = { modelId, api, promptId, message, stream: streaming.toString() };

            if (streaming) {
                // Using fetch for a streaming request
                const response = await fetch(`/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestPayload),
                });
                if (!response.body) {
                    throw new Error('No response body');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                const amount = chatHistory.length + 1;
                let acc = "";
                // Send the initial user message to chat history
                const userMessage = { role: 'user', content: message };
                setChatHistory(prevChatHistory => [...prevChatHistory, userMessage]);

                // Function to handle streaming and update chat history
                let done = false;
                while (!done) {
                    try {
                        const { value, done: doneReading } = await reader.read();

                        done = doneReading;

                        const chunkUnparsed = decoder.decode(value, { stream: true });

                        if (chunkUnparsed.includes("[DONE]")) {
                            handleTextareaChange(null);
                            setLoading(false);
                            reader.cancel(); // Stop reading the stream
                            return;
                        }

                        const unparsedChunks = chunkUnparsed.split("data: {").filter(v => v.length > 0);
                        const chunks = unparsedChunks.map(chunk => JSON.parse(String("{" + chunk)));
                        acc += chunks.map(chunk => chunk.content).join("");
                        // eslint-disable-next-line no-loop-func
                        setChatHistory(prevChatHistory => {
                            const newChatHistory = [...prevChatHistory];
                            newChatHistory[amount] = {
                                role: 'assistant',
                                content: acc
                                    .replaceAll("`` `", "```")
                                    .replaceAll("` ``", "```")
                                    .replaceAll("` ` `", "```")
                            };
                            return newChatHistory;
                        });
                    } catch (e) {
                        console.error(e);
                    }
                }

            } else {
                // For non-streaming, use regular fetch request
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestPayload),
                });

                const data = await response.json();
                const assistantMessage = {
                    role: 'assistant',
                    content: data.response
                        .replaceAll("%%newline%%", "\n")
                        .replaceAll("%%space%%", " ")
                };
                setChatHistory((prev) => [...prev, assistantMessage]);
                handleTextareaChange(null);
                setLoading(false);
            }

        } catch (error) {
            console.error("Error during message sending:", error);
            handleTextareaChange(null);
            setLoading(false);
        }
    };

    // Add a new prompt
    const addPrompt = async () => {
        if (!newPrompt) return;
        const id = Date.now().toString();
        await fetch('/api/prompts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, content: newPrompt }),
        });
        setNewPrompt('');
        queryClient.refetchQueries({ queryKey: ['prompts'] });
    };

    // Edit an existing prompt
    const editExistingPrompt = async () => {
        if (!editPrompt || !promptId) return;
        await fetch(`/api/prompts/${promptId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: editPrompt }),
        });
        setEditPrompt('');
        setIsEditing(false);
        queryClient.refetchQueries({ queryKey: ['prompts'] });
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement> | null) => {
        if(e === null) {
            setMessage('');
            if(textareaRef.current) textareaRef.current.value = ''
        }
        else setMessage(e.target.value);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    // Toggle sidebar collapse
    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <QueryClientProvider client={queryClient}>
            <div className={`App ${isCollapsed ? 'collapsed' : ''}`}>
                <div className={`inputs ${isCollapsed ? 'collapsed' : ''}`}>
                    <button className="toggle" onClick={toggleSidebar}>
                        {isCollapsed ? '▶' : '◀'}
                    </button>
                    <h1>Simple personal Chatbot</h1>
                    {!isCollapsed && (
                        <>
                            <div className="select-prompt">
                                <select
                                    id="api-select"
                                    value={api}
                                    onChange={(e) => {
                                        setAPI(e.target.value as APIS);
                                        setIsEditing(false);
                                    }}
                                >
                                    <option value="groq">Groq</option>
                                    <option value="ollama">Ollama</option>
                                </select>
                            </div>
                            <div className="select-prompt">
                                <SelectModels api={api} setModelId={setModelId} modelId={modelId} />
                            </div>
                            <div className="select-prompt">
                                <SelectPrompts promptId={promptId} setPromptId={setPromptId} setIsEditing={setIsEditing} />
                                <button onClick={() => setIsEditing(true)}>Edit Selected Prompt</button>
                            </div>

                            {isEditing ? (
                                <div className="edit-prompt">
                                    <input
                                        type="text"
                                        value={editPrompt}
                                        onChange={(e) => setEditPrompt(e.target.value)}
                                        placeholder="Edit prompt content"
                                    />
                                    <button onClick={editExistingPrompt}>Save Changes</button>
                                    <button onClick={() => setIsEditing(false)}>Cancel</button>
                                </div>
                            ) : (
                                <div className="add-prompt">
                                    <input
                                        type="text"
                                        value={newPrompt}
                                        onChange={(e) => setNewPrompt(e.target.value)}
                                        placeholder="New prompt content"
                                    />
                                    <button onClick={addPrompt}>Add New Prompt</button>
                                </div>
                            )}

                            <div className="extras">
                                <Streaming streaming={streaming} setStreaming={setStreaming} />
                                <Temperature temperature={temperature} setTemperature={setTemperature} />
                            </div>
                        </>
                    )}
                </div>
                <div className="outputs">
                    <div id="chat-history" ref={chatHistoryRef} className={`chat-history ${isFocused ? "smaller" : ""}`}>
                        {chatHistory.map((entry, index) => (
                            <ChatEntry key={index} entry={entry} index={index} />
                        ))}
                    </div>

                    <div className="message-input">
                        <textarea
                            ref={textareaRef}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            id="user-message"
                            data-loading={loading ? "yes" : "no"}
                            value={message}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    sendMessage();
                                }
                                if(e.key === 'Escape' && textareaRef.current) {
                                    textareaRef.current.blur();
                                }
                            }}
                            onChange={handleTextareaChange}
                            disabled={loading}
                            minLength={2}
                            placeholder="Ask me anything.."
                        />
                        <button onClick={sendMessage} disabled={loading}>Send</button>
                    </div>
                </div>
            </div>
        </QueryClientProvider>
    );
}

export default App;
