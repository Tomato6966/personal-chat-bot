import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getModels } from "../../handlers/getModels";

import type { APIS } from "../../../../server";

export const SelectModels = ({ api, setModelId, modelId }: { modelId:string, api: APIS, setModelId: (modelId: string) => void }) => {
    useQueryClient();

    const { data, error, isLoading } = useQuery({
        queryKey: ['models', api],
        queryFn: async () => getModels(api),
    });

    return (
        <select
            id="model-select"
            value={modelId}
            data-loading={isLoading}
            disabled={isLoading}
            onChange={(e) => {
                setModelId(e.target.value);
            }}
        >
            <option value="">
                {isLoading
                    ? "Fetching Models..."
                    : error
                        ? "Error :{error.message}"
                        : "--Choose a model--"
            }</option>
            {data?.map((id) => (
                <option key={id} value={id}>{id.substring(0, 50)}</option>
            ))}
        </select>
    );
}
