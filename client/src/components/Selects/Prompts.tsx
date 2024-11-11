import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getPrompts } from "../../handlers/getPrompts";

export const SelectPrompts = ({ promptId, setPromptId, setIsEditing }: { promptId: string, setPromptId: (promptId: string) => void, setIsEditing: (isEditing: boolean) => void }) => {
    useQueryClient();

    const { data, error, isLoading } = useQuery({
        queryKey: ['prompts'],
        queryFn: getPrompts,
    })

    return (
        <select
            id="prompt-select"
            value={promptId}
            onChange={(e) => {
                setPromptId(e.target.value);
                setIsEditing(false);
            }}
            data-loading={isLoading}
            disabled={isLoading}
        >
        <option value="">
            {isLoading
                ? "Fetching prompts..."
                : error
                    ? "Error :{error.message}"
                    : "--Choose a prompt--"
        }</option>
            {data?.map(([id, content]) => (
                <option key={id} value={id}>{content.substring(0, 50)}...</option>
            ))}
        </select>
    );
}
