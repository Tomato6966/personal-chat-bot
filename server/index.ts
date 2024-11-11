import colors from "colors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { chatRoutes } from "./routes/chat";
import { modelsRoutes } from "./routes/models";
import { promptRoutes } from "./routes/prompts";
import { centerString, getDateFormatted } from "./Utils/handlers";

colors.enable();
dotenv.config();

const app = express();

app.use(express.json({ limit: "100mb"}));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(express.static(path.join(__dirname, '../client/build')));

app.use("*", (req, res, next) => {
    const bodyStr = req.method === "POST" && req.body && Object.keys(req.body).length > 0
        ? `${"Body:".bold}\n${JSON.stringify(req.body, null, 2).dim.italic}`
        : "No Body".italic.bold;
    console.log(" [INFO] ".cyan, getDateFormatted().yellow.dim, `[${centerString(req.method, 8)}]`.cyan.bold, "Request made to: ".italic.dim, req.url.dim, " | ", bodyStr)
    next();
});

promptRoutes(app);
modelsRoutes(app);
chatRoutes(app);

app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'client/build', 'index.html')));

app.get('*', (req, res) => {
    res.status(404).send("Not found");
    return;
});

const port = process.env.PORT ? Number(process.env.PORT) : 80;

const readyStr = `${"Chatbot server running on:".green} http://localhost:${port}`.italic;
const hiphens = "─".repeat(readyStr.length * 0.72).dim.white;
app.listen(port, () => console.log(
    `${hiphens}\n\n${readyStr}\n\n${hiphens}`.bold,
));

// make sure the app doesn't crash
process.on("unhandledRejection", (error) => console.error("unhandledRejection", error));
process.on("uncaughtException", (error) => console.error("uncaughtException", error));
