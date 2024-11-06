import dotenv from "dotenv";
import express from "express";
import path from "path";

import { chatRoutes } from "./routes/chat";
import { modelsRoutes } from "./routes/models";
import { promptRoutes } from "./routes/prompts";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

promptRoutes(app);
modelsRoutes(app);
chatRoutes(app);

app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'client/build', 'index.html')));

app.get('*', (req, res) => {
    res.status(404).send("Not found").end();
    return;
});

const port = process.env.PORT ? Number(process.env.PORT) : 80;
app.listen(port, () => console.log(`Chatbot server running on http://localhost:${port}`));

// make sure the app doesn't crash
process.on("unhandledRejection", (error) => console.error("unhandledRejection", error));
process.on("uncaughtException", (error) => console.error("uncaughtException", error));
