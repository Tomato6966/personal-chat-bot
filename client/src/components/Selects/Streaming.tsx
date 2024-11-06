export const Streaming = ({ streaming, setStreaming }: { streaming: boolean, setStreaming: (streaming: boolean) => void }) => {
    return (
        <label className="checkbox-wrapper">
            <input
                type="checkbox"
                className="checkbox"
                checked={streaming}
                onChange={(e) => setStreaming(e.target.checked)}
            />
            Enable Streaming
        </label>
    )
}
