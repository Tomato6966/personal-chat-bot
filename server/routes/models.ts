import { Express } from "express";

import { APIS } from "../Types";
import { fetchModels } from "../Utils/handlers";

export const modelsRoutes = (app: Express) => {

    app.get('/api/models', async (req, res) => {
        const { api } = req.query as { api: APIS };
        res.send(await fetchModels(api));
        return;
    })
}
