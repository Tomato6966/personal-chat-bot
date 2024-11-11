export const getPrompts = async () => {
    const response = await fetch('/api/prompts');
    const data = await response.json();
    return data as [string, string][];
}
