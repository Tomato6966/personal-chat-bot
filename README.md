# personal-chat-bot

A personal llm-based chat bot, very simple, but with a rest api

I made this project to create a simple chatbot interface, to interacft with the api of [groq](https://groq.com) and ollama (for local llms)
This way i can have a localhost chatbot, for free / cheap / easy and fast llm access.
That way i do not rely on chatgpt or claude for simple tasks anymore.

### How it should be used

- This app has **no auth** so only on localhost!
- The chat-history, is configureable and limitable ( in the defaults.json ), and stored on the frontend so that...
  - When you refresh the page, the chat history is cleared
- *Mind: Models like llava don't properly support chathistory*
- *If you use ollama, you can keep the chat-history decently big, but if you use some "paid" service, i'd recommend to keep it low..*


## Features

- Pick the api (hosting) of your choice
- Pick the model (llm) of your choice *(models are cached on the server, so if they change, restart the server)*
- Fully supported markdown rendering(s)
- Sick modern UI, for ultimate interactivity.
- Easy to host & extend
- Custom system prompts (instructions) in `prompts.json` declare able
- Supports multiple api's:
    - groq (https://groq.com)
    - ollama (https://ollama.ai)
    - ... *easy to add more, but i don't need more...*

![PersonalChatBot](https://github.com/user-attachments/assets/40569c1f-0a68-4336-8af7-ad38a15671c6)

![PersonalChatBotExample](https://github.com/user-attachments/assets/856a7ff3-5b8a-4b29-b11b-b5799278fe79)

## Usage

1. Clone the repo `git clone https://github.com/Tomato6966/personal-chat-bot`
2. Install dependencies `cd personal-chat-bot && bun install`
3. Create a `.env` file in the root directory, and fill it out (example in: `example.env`)
4. Run `bun run start` or `bun run start:watch`
- Note that, if you update the UI you need to call `bun run build:client` or `bun run build:client:watch` to update the client/ui build folder


### How to auto launch the server on startup **` (WINDOWS) `**

1. `win + r` -> `shell:startup`
2. Right Click `startApi.bat` -> create shortcut
3. Paste the shortcut in the startup folder (from step 1)

### How to auto launch the server on startup **` (LINUX) `**

1. Create a new systmed service `nano /etc/systemd/system/personal-chat-bot.service`
2. Paste the following content:
```
[Unit]
Description=Personal Chat Bot
After=network.target

[Service]
ExecStart=cd /home/personal-chat-bot && bun run start
Restart=always
User=root
Group=root
Type=simple

[Install]
WantedBy=multi-user.target
```
3. Save and exit `ctrl + s` & `ctrl + x`
4. Reload the systemd daeomn `sudo systemctl daemon-reload`
5. Enable the service `sudo systemctl enable personal-chat-bot.service`
6. Start the service `sudo systemctl start personal-chat-bot.service`


Why yet another chatbot?
- I made many chatbots with llms in the past already, and there are many opensource solutions available already, however this was a fun project and i wanted to include the groq api in particular.
