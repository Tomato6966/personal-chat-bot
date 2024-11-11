export const Temperature = ({ temperature, setTemperature }: { temperature: number, setTemperature: (temperature: number) => void }) => {
    return (
        <div className="temperature">
            <span>Temperature:</span>
            <div>
                <input
                    type="number"
                    min="0.01"
                    max="1.5"
                    value={temperature}
                    step="0.01"
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
                <input
                    type="range"
                    min="0.01"
                    max="1.5"
                    step="0.01"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
            </div>
        </div>
    );
}
