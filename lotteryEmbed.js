
const { EmbedBuilder } = require('discord.js');
const { formatTime } = require('./utils');

function createSouldrawEmbed(souldraw) {
    const timeRemaining = Math.max(0, souldraw.endTime - Date.now());
    const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle('✨ Ongoing Souldraw ✨')
        .setDescription(
            `**Prize:** ${souldraw.prize}\n` +
            `**Terms:** ${souldraw.terms}\n` +
            `**Number of Winners:** ${souldraw.numWinners || 1}\n` +
            `**Min Participants:** ${souldraw.min || 'No Minimum'}\n` +
            `**Max Participants:** ${souldraw.max || 'No Maximum'}\n` +
            `**Time Remaining:** ${formatTime(timeRemaining)}\n\n` +
            `Click the button below to join!`
        )
        .addFields(
            { name: 'Souldraw ID', value: souldraw.id, inline: true },
            { name: 'Draw Mode', value: souldraw.drawMode, inline: true },
        )
        .setTimestamp();


    if (souldraw.winners && souldraw.winners.length > 0) {
        const winnerList = souldraw.winners.map(winner => `<@${winner}>`).join('\n');
        embed.addFields({ name: 'Winners', value: winnerList });
    }

    return embed;
}

module.exports = { createSouldrawEmbed };
