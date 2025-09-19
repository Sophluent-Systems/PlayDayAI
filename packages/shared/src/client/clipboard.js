
// Copy data to clipboard
export const copyDataToClipboard = async (data) => {
    try {
        await navigator.clipboard.writeText(JSON.stringify(data));
        console.log('Data copied to clipboard');
    } catch (err) {
        console.error('Failed to copy data:', err);
    }
};

// Paste data from clipboard
export const pasteDataFromClipboard = async () => {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        console.log('Data retrieved from clipboard:', data);
        return data;
    } catch (err) {
        console.error('Failed to read data:', err);
        return null;
    }
};