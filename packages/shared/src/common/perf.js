
export function measureExecutionTime(fn) {
    // Start the timer
    let startTime = performance.now();

    // Execute the passed function
    let result = fn();

    // End the timer
    let endTime = performance.now();

    // Calculate the difference and log it
    let elapsedTime = endTime - startTime;

    return {
        result,
        elapsedTime,
    };
}


export async function measureExecutionTimeAsync(fn) {
    // Start the timer
    let startTime = performance.now();

    // Execute the passed function
    let result = await fn();

    // End the timer
    let endTime = performance.now();

    // Calculate the difference and log it
    let elapsedTime = endTime - startTime;

    return {
        result,
        elapsedTime,
    };
}