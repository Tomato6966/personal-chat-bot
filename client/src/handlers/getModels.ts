import type { APIS } from "../../../server";

export const getModels = async (api:APIS) => {
    const response = await fetch('/api/models?api=' + api);
    const data = await response.json();
    return data as string[];
}