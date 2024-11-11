import "./App.css";

import React, { useEffect, useRef, useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import defaults from "../../defaults.json";
import { ChatEntry } from "./components/ChatEntry";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { SelectModels } from "./components/Selects/Model";
import { SelectPrompts } from "./components/Selects/Prompts";
import { Streaming } from "./components/Selects/Streaming";
import { Temperature } from "./components/Selects/Temperature";
import { HistoryMsg } from "./Types";

import { APIS } from "../../server/Types";
const queryClient = new QueryClient()

function App() {
    const [loading, setLoading] = useState(() => false);
    const [promptId, setPromptId] = useState(() => '');
    const [chatHistory, setChatHistory] = useState<HistoryMsg[]>(() => []);
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
    const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
        const storedIsCollapsed = localStorage.getItem('isCollapsed');
        return (storedIsCollapsed && JSON.parse(storedIsCollapsed)) ?? false;
    });
    const [api, setAPI] = useState<APIS>(() => {
        const storedAPI = localStorage.getItem('api');
        return (storedAPI && JSON.parse(storedAPI)) ?? defaults.default_api as APIS;
    });
    const [images, setImages] = useState<string[]>([]);


    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    const handleFileAdd = async (files:File | File[]) => {
        const loadedImages = await Promise.all(
            (Array.isArray(files) ? files : [files]).map(file => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = () => {
                    resolve(reader.result as string);
                };

                reader.onerror = () => reject(new Error("Error reading file"));

                reader.readAsDataURL(file);
            }))
        );
        // add image
        setImages(imgs => [...imgs, ...loadedImages].filter((img, i, a) => a.indexOf(img) === i));
    }
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const files = Array.from(event.target.files);

            // Read files and convert them to base64
            const loadedImages = await Promise.all(
                files.map(file => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = () => {
                        resolve(reader.result as string);
                    };

                    reader.onerror = () => reject(new Error("Error reading file"));

                    reader.readAsDataURL(file);
                }))
            );

            // Overrides images
            setImages(loadedImages);
        }
    };


    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer?.files || []);
        const images = Array.from(files || []).filter(item => item.type.includes('image'));

        if(!images.length) return;

        handleFileAdd(files);
    };

    const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        const pastedText = e.clipboardData?.getData?.('text');
        const images = Array.from(items || []).filter(item => item.type.includes('image'));

        if(!images.length) return;

        if(!textareaRef.current || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "")) {
            handleFileAdd(images.map(item => item.getAsFile()).filter(v => v !== null));
            return;
        }

        e.preventDefault();

        handleFileAdd(images.map(item => item.getAsFile()).filter(v => v !== null));

        textareaRef.current.focus();

        if(pastedText) {
            textareaRef.current.value = pastedText;
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if(!textareaRef.current || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "")) return;
        if(e.ctrlKey || e.shiftKey || e.metaKey || e.altKey) return;
        textareaRef.current.focus();
    };

    useEffect(() => {
        document.addEventListener('drop', handleDrop);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('drop', handleDrop);
            document.removeEventListener('paste', handlePaste);
            document.addEventListener('keydown', handleKeyDown);
        };
    }, []);

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
        if (!textareaRef.current?.value) return;

        if(textareaRef.current) {
            textareaRef.current.blur();
            textareaRef.current.style.height = '72px';
        }
        setLoading(true);
        const userMessage:HistoryMsg = { role: 'user', content: textareaRef.current.value, state: "loading" };
        const newHistory = [
            ...chatHistory, userMessage
        ]
        setChatHistory(newHistory);

        try {
            const requestPayload = {
                images,
                modelId,
                api,
                promptId,
                chatHistory: newHistory
                    .filter(v => v.state !== "failed").slice(newHistory.length - defaults.maxHistory, newHistory.length),
                stream: streaming.toString()
            };

            const response = await fetch(`/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload),
            }).catch(() => null);

            if(!response || !response.ok || !response.body) {
                const { status = 500, statusText = "Internal Server Error" } = response || {};
                let text = "";
                try { text = response ? await response.text() : ""; } catch { /* */ }
                setChatHistory((prev) => {
                    prev[prev.length - 1].state = "failed";
                    return prev;
                });
                setLoading(false);
                return alert(`Error sending message: ${status} ${statusText} -- ${text}`);
            }

            if (streaming) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                const amount = newHistory.length;
                let acc = "";

                // Function to handle streaming and update chat history
                let done = false;
                while (!done) {
                    try {
                        const { value, done: doneReading } = await reader.read();

                        done = doneReading;

                        const chunkUnparsed = decoder.decode(value, { stream: true });
                        if (chunkUnparsed.includes("[DONE]")) {
                            handleTextareaChange(null);
                            setChatHistory((prev) => {
                                if(prev[prev.length - 1]?.role === "assistant") {
                                    prev[prev.length - 2].state = "success";
                                    prev[prev.length - 1].state = "success";
                                } else {
                                    prev[prev.length - 1].state = "failed";
                                }
                                return prev;
                            });
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
                                state: "loading",
                                content: acc
                                    .replaceAll("`` `", "```")
                                    .replaceAll("` ``", "```")
                                    .replaceAll("` ` `", "```")
                            };
                            return newChatHistory;
                        });
                    } catch (e) {
                        console.error(e);
                        setChatHistory((prev) => {
                            if(prev[prev.length - 1]?.role === "assistant") {
                                prev[prev.length - 2].state = "success";
                                prev[prev.length - 1].state = "success";
                            } else {
                                prev[prev.length - 1].state = "failed";
                            }
                            return prev;
                        });
                        handleTextareaChange(null);
                        setLoading(false);
                        reader.cancel(); // Stop reading the stream
                        return;
                    }
                }
            } else {
                const data = await response.json();
                setChatHistory((prev) => {
                    prev[prev.length - 1].state = "success";
                    return [
                        ...prev
                        , {
                            role: 'assistant',
                            state: "success",
                            content: data.response
                                .replaceAll("%%newline%%", "\n")
                                .replaceAll("%%space%%", " ")
                        }
                    ]
                });
                handleTextareaChange(null);
                setLoading(false);
            }
        } catch (error) {
            console.error("Error during message sending:", error);
            handleTextareaChange(null);
            setChatHistory((prev) => {
                if(prev[prev.length - 1]?.role === "assistant") {
                    prev[prev.length - 2].state = "success";
                    prev[prev.length - 1].state = "success";
                } else {
                    prev[prev.length - 1].state = "failed";
                }
                return prev;
            });
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
        if(!textareaRef.current) return;
        if(e === null) textareaRef.current.value = "";
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    };

    return (
        <QueryClientProvider client={queryClient}>
            <div className={`App ${isCollapsed ? 'collapsed' : ''}`}>
                {/* Sidebar */}
                <nav className={`inputs ${isCollapsed ? 'collapsed' : ''}`}>
                    <button
                        className="toggle"
                        onClick={() => setIsCollapsed(prevCollapsedState => !prevCollapsedState)}>
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
                                    }}
                                >
                                    {Object.entries(APIS).map(([name, value]) => <option key={value} value={value}>{name}</option>)}
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
                </nav>

                {/* output aka main area */}
                <main className="outputs">
                    <div id="chat-history" ref={chatHistoryRef} className={`${isFocused ? "smaller" : ""}`}>
                        {chatHistory.map((entry, index) => (
                            <ChatEntry key={index} entry={entry} index={index} />
                        ))}
                    </div>

                    <div className="message-input">
                        <textarea
                            ref={textareaRef}
                            onFocus={() => {console.log("FOCUS"); setIsFocused(true)}}
                            onBlur={(e) => { e.preventDefault(); e.stopPropagation(); setIsFocused(false); }}
                            id="user-message"
                            data-loading={loading ? "yes" : "no"}
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
                        <input
                            type="file"
                            id="imageUpload"
                            multiple
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        {
                            images.length > 0 &&
                                (<button type="button" data-delete={true} onClick={() => setImages([])}>
                                    <svg
                                    height="40px"
                                    width="40px"
                                    version="1.1"
                                    id="Layer_1"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 512 512"
                                    fill="#fff"
                                >
                                    <g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill="#F4B2B0;" d="M285.792,328.773c0-58.717,47.599-106.316,106.316-106.316c7.124,0,14.08,0.714,20.812,2.05 c2.964-10.219,4.579-21.011,4.579-32.187c0-63.739-51.671-115.41-115.411-115.41c-45.413,0-84.67,26.248-103.507,64.385 c-14.531-13.426-33.95-21.64-55.294-21.64c-45.018,0-81.512,36.494-81.512,81.512c0,44.562,35.763,80.748,80.151,81.477 c-0.456,0.008-0.907,0.034-1.364,0.034c-36.146,0-66.776-23.535-77.454-56.11c-29.277,13.882-49.53,43.7-49.53,78.255l0,0 c0,47.811,38.759,86.57,86.57,86.57H306.21C293.381,373.828,285.792,352.19,285.792,328.773z"></path> <g> <path fill="#B3404A;" d="M484.618,252.504c-4.772-5.782-13.33-6.6-19.113-1.83c-5.784,4.774-6.602,13.33-1.83,19.113 c13.653,16.543,21.172,37.491,21.172,58.986c0,51.136-41.603,92.739-92.739,92.739c-46.34,0-84.852-34.167-91.668-78.631 c0-0.004-0.001-0.008-0.001-0.014c-0.212-1.382-0.383-2.775-0.532-4.176c-0.037-0.352-0.071-0.703-0.103-1.056 c-0.105-1.102-0.187-2.21-0.254-3.324c-0.023-0.395-0.052-0.789-0.069-1.184c-0.066-1.443-0.11-2.895-0.11-4.354 c0-51.137,41.603-92.74,92.739-92.74c6.067,0,12.181,0.601,18.171,1.789c6.898,1.369,13.718-2.77,15.681-9.535 c3.396-11.707,5.117-23.808,5.117-35.966c0-71.125-57.863-128.988-128.988-128.988c-43.922,0-83.811,21.765-107.536,57.746 c-15.203-9.756-32.921-15.002-51.266-15.002c-52.432,0-95.089,42.657-95.089,95.089c0,5.803,0.519,11.531,1.531,17.127 C19.265,236.109,0,269.201,0,304.825c0,55.221,44.926,100.146,100.147,100.146H299.61c22.008,26.669,55.301,43.696,92.497,43.696 c66.108,0,119.893-53.783,119.893-119.893C512,300.987,502.276,273.9,484.618,252.504z M282.674,377.816H100.147 c-40.248,0-72.993-32.745-72.993-72.992c0-23.271,11.28-45.059,29.607-58.679c16.329,30.523,48.241,50.111,83.8,50.111 c0.418,0,0.834-0.012,1.248-0.027l0.314-0.01c7.416-0.109,13.372-6.146,13.379-13.562c0.007-7.417-5.938-13.467-13.353-13.589 c-36.831-0.604-66.796-31.065-66.796-67.902c0-37.46,30.476-67.936,67.936-67.936c17.128,0,33.494,6.406,46.08,18.035 c3.144,2.905,7.474,4.16,11.686,3.378c4.21-0.779,7.805-3.499,9.702-7.337c17.31-35.049,52.307-56.822,91.334-56.822 c56.151,0,101.834,45.682,101.834,101.834c0,5.704-0.481,11.392-1.434,17.01c-3.458-0.301-6.926-0.452-10.381-0.452 c-66.108,0-119.893,53.783-119.893,119.894c0,1.048,0.014,2.094,0.041,3.135c0.015,0.576,0.043,1.149,0.065,1.723 c0.018,0.453,0.03,0.908,0.053,1.359c0.042,0.827,0.099,1.65,0.158,2.474c0.014,0.187,0.023,0.376,0.037,0.562 c0.075,0.99,0.164,1.977,0.263,2.961c0.001,0.009,0.001,0.02,0.003,0.03C274.129,353.809,277.443,366.192,282.674,377.816z"></path> <path fill="#B3404A;" d="M411.308,328.773l19.568-19.57c5.302-5.302,5.302-13.899,0-19.202c-5.303-5.3-13.897-5.3-19.202,0 l-19.568,19.568l-19.568-19.568c-5.302-5.299-13.896-5.3-19.202,0c-5.302,5.302-5.302,13.899,0,19.202l19.568,19.57l-19.568,19.57 c-5.302,5.302-5.302,13.899,0,19.202c2.652,2.65,6.126,3.977,9.6,3.977s6.949-1.326,9.6-3.977l19.568-19.568l19.568,19.568 c2.652,2.65,6.126,3.977,9.6,3.977c3.474,0,6.949-1.326,9.6-3.977c5.302-5.302,5.302-13.899,0-19.202L411.308,328.773z"></path> </g> </g>
                                </svg>
                            </button>)
                        }
                        <button type="button" data-override={images.length ? "yes" : "no"} onClick={() => document.getElementById('imageUpload')?.click()}>
                            <svg
                                height="40px"
                                width="40px"
                                version="1.1"
                                id="Layer_1"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 512.001 512.001"
                                fill="#fff">
                                <g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path stroke="#119fff;" d="M443.143,214.572c3.514-11.487,5.418-23.68,5.418-36.318c0-68.481-55.515-123.996-123.997-123.996 c-42.254,0-79.547,21.151-101.93,53.427c22.071,19.209,36.041,47.488,36.041,79.045c0,57.869-46.913,104.782-104.782,104.782 c-45.403,0-84.051-28.884-98.6-69.275c-24.564,16.74-40.705,44.922-40.705,76.889l0,0c0,51.368,41.643,93.01,93.01,93.01h78.352 l70.052-85.033l70.052,85.033h78.352c51.368,0,93.01-41.643,93.01-93.01l0,0C497.413,261.588,475.162,229.267,443.143,214.572z"></path> <path fill="#119fff;" d="M460.126,207.099c2.006-9.457,3.02-19.116,3.02-28.846c0-76.415-62.169-138.583-138.584-138.583 c-45.406,0-87.993,22.319-113.916,59.703c-4.239,6.112-3.2,14.434,2.41,19.316c19.721,17.164,31.031,41.965,31.031,68.042 c0,48.18-37.973,87.658-85.561,90.078c-1.535,0.077-3.081,0.118-4.634,0.118c-1.389,0-2.766-0.042-4.14-0.105 c-0.492-0.023-0.982-0.057-1.472-0.088c-0.858-0.053-1.712-0.118-2.564-0.195c-0.611-0.057-1.224-0.112-1.832-0.181 c-0.672-0.074-1.341-0.166-2.009-0.255c-2.862-0.387-5.692-0.899-8.478-1.552c-0.158-0.036-0.315-0.071-0.473-0.109 c-9.903-2.381-19.262-6.414-27.712-11.839c-0.179-0.115-0.36-0.229-0.538-0.346c-0.756-0.492-1.501-0.998-2.241-1.513 c-0.372-0.258-0.74-0.522-1.106-0.788c-0.618-0.443-1.236-0.888-1.842-1.346c-0.963-0.729-1.915-1.472-2.847-2.238 c-0.152-0.124-0.298-0.257-0.449-0.382c-0.915-0.764-1.818-1.542-2.701-2.341c-0.182-0.165-0.362-0.334-0.543-0.499 c-0.903-0.829-1.791-1.672-2.661-2.537c-0.079-0.077-0.158-0.155-0.235-0.233c-8.11-8.135-14.683-17.805-19.234-28.533 c-0.01-0.023-0.02-0.047-0.029-0.07c-4.563-10.78-7.088-22.623-7.088-35.045c0-49.734,40.461-90.195,90.195-90.195 c8.056,0,14.587-6.531,14.587-14.587s-6.531-14.587-14.587-14.587c-65.82,0-119.369,53.548-119.369,119.369 c0,10.384,1.339,20.461,3.844,30.072C14.17,237.149,0,267.187,0,299.126c0,59.329,48.268,107.597,107.597,107.597h75.655 c0.818,0.143,1.65,0.239,2.5,0.239h12.667v50.781c0,8.056,6.531,14.587,14.587,14.587h85.988c8.056,0,14.587-6.531,14.587-14.587 v-50.781h12.667c0.849,0,1.68-0.096,2.5-0.239h75.655c59.329,0,107.597-48.268,107.597-107.597 C512,261.35,491.99,226.437,460.126,207.099z M284.408,392.376v50.781h-56.815v-50.781c0-6.905-4.799-12.689-11.242-14.202 l39.65-48.129l39.65,48.129C289.206,379.685,284.408,385.47,284.408,392.376z M404.403,377.55h-71.468l-65.676-79.72 c-2.772-3.364-6.901-5.313-11.258-5.313c-4.357,0-8.487,1.949-11.258,5.313l-65.676,79.72h-71.468 c-43.243,0-78.424-35.181-78.424-78.424c0-20.002,7.627-38.988,20.97-53.35c6.207,10.879,14.05,20.591,23.125,28.891 c0.251,0.23,0.5,0.46,0.754,0.689c1.233,1.109,2.48,2.198,3.755,3.254c0.413,0.343,0.84,0.67,1.257,1.008 c0.801,0.645,1.606,1.281,2.423,1.905c0.697,0.534,1.4,1.062,2.111,1.58c0.442,0.322,0.89,0.635,1.336,0.951 c1.729,1.228,3.488,2.413,5.282,3.55c0.064,0.041,0.128,0.083,0.193,0.124c10.845,6.844,22.858,11.986,35.674,15.061 c0.181,0.044,0.363,0.083,0.546,0.125c1.956,0.459,3.931,0.869,5.924,1.231c0.632,0.115,1.262,0.233,1.895,0.34 c0.877,0.144,1.758,0.28,2.64,0.406c1.1,0.158,2.206,0.295,3.314,0.422c0.702,0.079,1.403,0.162,2.108,0.229 c1.494,0.144,2.995,0.255,4.5,0.343c0.513,0.031,1.028,0.055,1.545,0.079c1.783,0.08,3.569,0.136,5.367,0.136 c6.17,0,12.234-0.471,18.155-1.378c57.236-8.77,101.216-58.342,101.216-117.992c0-0.009-0.001-0.018-0.001-0.026 c-0.007-29.868-11.214-58.464-31.14-80.334c20.671-23.689,50.685-37.526,82.442-37.526c60.328,0,109.41,49.081,109.41,109.409 c0,10.901-1.609,21.685-4.779,32.052c-2.137,6.987,1.224,14.478,7.865,17.525c27.803,12.761,45.768,40.747,45.768,71.298 C482.826,342.369,447.646,377.55,404.403,377.55z"></path> </g>
                            </svg>
                        </button>
                        <button onClick={sendMessage} disabled={loading}>
                            {
                                loading
                                    ? <div className="buttonSendingLoading"><LoadingSpinner /></div>
                                    : "Send"
                            }
                            </button>
                    </div>
                    {
                        images.length > 0 && <div className="attachment-container">
                            {images.map((image, index) => (
                                <div key={index}>
                                    <img src={image} alt="Attachment" />
                                    <button onClick={() => setImages(images.filter((_, i) => i !== index))}>
                                        <svg height="25px" width="25px" version="1.1" id="Layer_1"xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <polygon style={{ fill: "#F4B2B0" }} points="190.551,495.523 117.226,495.523 87.886,113.866 190.551,113.866 "></polygon> <polygon style={{ fill: "#F4B2B0" }} points="394.773,495.523 321.448,495.523 321.448,113.866 424.112,113.866 "></polygon> </g> <g> <path style={{ fill: "#B3404A" }} d="M468.321,97.389h-44.208H321.446H190.551H87.888h-44.21c-9.1,0-16.477,7.378-16.477,16.477 s7.377,16.477,16.477,16.477h28.95l28.168,366.444c0.661,8.585,7.818,15.213,16.429,15.213h73.325h51.333 c9.1,0,16.477-7.378,16.477-16.477s-7.377-16.477-16.477-16.477H207.03V130.343h97.941v365.18c0,9.099,7.378,16.477,16.477,16.477 h73.327c8.611,0,15.769-6.629,16.429-15.213l28.169-366.444h28.949c9.099,0,16.477-7.378,16.477-16.477 S477.419,97.389,468.321,97.389z M174.074,479.046h-41.589L105.68,130.343h68.394V479.046L174.074,479.046z M379.513,479.046 h-41.59V130.343h68.397L379.513,479.046z"></path> <path style={{ fill: "#B3404A" }} d="M332.693,75.578c-9.099,0-16.477-7.379-16.477-16.477V32.954H201.899V59.1 c0,9.099-7.377,16.477-16.477,16.477s-16.477-7.379-16.477-16.477V16.477C168.944,7.378,176.321,0,185.421,0h147.272 c9.099,0,16.477,7.378,16.477,16.477V59.1C349.17,68.201,341.794,75.578,332.693,75.578z"></path> </g> </g></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    }
                </main>
            </div>
            <footer data-iscollapsed={isCollapsed ? "yes" : "no"}>
                <a href="https://github.com/Tomato6966/personal-chat-bot" rel="noreferrer" target="_blank">
                    <img src="https://img.shields.io/github/stars/Tomato6966/personal-chat-bot?style=social" alt="GitHub Repo stars" />
                </a>
                <span>Made with ❤️ for fun!</span>
            </footer>
        </QueryClientProvider>
    );
}

export default App;
