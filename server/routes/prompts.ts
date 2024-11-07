import { Express } from "express";

import { prompts } from "../Utils/Cache.ts";
import { loadPrompts, savePrompts } from "../Utils/handlers.ts";

export const promptRoutes = (app: Express) => {
    loadPrompts();
    // Save a system prompt
    app.post('/api/prompts', (req, res) => {
        const { id, content } = req.body;
        prompts.set(id, content);
        res.status(200).send({ message: 'Prompt saved!' });
        return;
    });

    // Edit an existing prompt
    app.put('/api/prompts/:id', (req, res) => {
        const { id } = req.params;
        const { content } = req.body;
        if (prompts.has(id)) {
            prompts.set(id, content);
            savePrompts();
            res.status(200).send({ message: 'Prompt updated!' });
            return;
        }
        res.status(404).send({ error: 'Prompt not found' });
        return;
    });

    // Get all prompts
    app.get('/api/prompts', (req, res) => {
        res.json(Array.from(prompts.entries()));
        return;
    });
}
