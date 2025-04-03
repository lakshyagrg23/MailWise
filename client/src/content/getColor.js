const isLightColor = (hex) => {
    // Convert hex to RGB
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);

    // Calculate brightness using the relative luminance formula
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

    // Consider a color light if brightness > 200 (adjustable threshold)
    return brightness > 200;
};

const wordToAsciiSum = (word) => {
    if (!word || typeof word !== 'string') {
        console.warn("wordToAsciiSum received invalid input:", word);
        return 0; // Default value to prevent errors
    }
    return word.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
};


export  const getRandomColor = (name) => {
    const index=wordToAsciiSum(name)
    const hue = (index * 1) % 360; // Fixed sequence with step of 30°
    let color;
    do {
        color = `hsl(${hue}, 100%, ${index/30}%)`; // Darker colors with 30% lightness
    } while (isLightColor(color)); // Ensure it's not a light color
    return color;
};

