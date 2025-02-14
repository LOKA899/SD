
function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000) % 60;
    const minutes = Math.floor(milliseconds / (1000 * 60)) % 60;
    const hours = Math.floor(milliseconds / (1000 * 60 * 60)) % 24;
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));

    const formattedTime =;
    if (days > 0) formattedTime.push(`${days} day${days > 1? 's': ''}`);
    if (hours > 0) formattedTime.push(`${hours} hour${hours > 1? 's': ''}`);
    if (minutes > 0) formattedTime.push(`${minutes} minute${minutes > 1? 's': ''}`);
    if (seconds > 0) formattedTime.push(`${seconds} second${seconds > 1? 's': ''}`);

    return formattedTime.join(' ') || '0 seconds';
}

module.exports = { formatTime };
