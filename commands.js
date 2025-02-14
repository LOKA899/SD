
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { db, updateSouldrawParticipants, updateSouldrawStatus } = require('./db');
const { createSouldrawEmbed } = require('./lotteryEmbed');
const { formatTime } = require('./utils');

async function handleSouldrawCommand(interaction, ongoingSouldraws, souldrawStartMessages, updateIntervals, timers, confirmationMessages) {
    const time = interaction.options.getString('time');
    const prize = interaction.options.getString('prize');
    const terms = interaction.options.getString('terms') || 'No terms specified.';
    const minParticipants = interaction.options.getInteger('min');
    const maxParticipants = interaction.options.getInteger('max');

    const durationMatch = time.match(/(\d+)([smhd])/);
    if (!durationMatch) {
        return interaction.reply({ content: 'Invalid time format. Use values like 10s, 5m, 2h, 1d', flags: MessageFlags.Ephemeral });
    }

    let duration = parseInt(durationMatch[1]);
    const unit = durationMatch[2];

 

async function handleCancelCommand(interaction, ongoingSouldraws, timers, updateIntervals) {
    const souldrawId = interaction.options.getString('id');
    const souldraw = ongoingSouldraws.find(sd => sd.id === souldrawId);

    if (!souldraw) {
        return interaction.reply({ content: 'Souldraw not found.', flags: MessageFlags.Ephemeral });
    }

    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ content: 'Only administrators can cancel souldraws.', flags: MessageFlags.Ephemeral });
    }

    try {
        await db.query('UPDATE souldraws SET endTime = ?, drawMode = ? WHERE id = ?', [Date.now(), 'cancelled', souldrawId]);
        clearTimeout(timers[souldraw.id]);
        clearInterval(updateIntervals[souldraw.id]);
        ongoingSouldraws = ongoingSouldraws.filter(sd => sd.id !== souldrawId);

        const message = await interaction.reply({ content: 'Souldraw cancelled.', fetchReply: true });

        // Try to delete the original embed message
        try {
            const channel = interaction.channel;
            if (channel) {
                const embedMessage = await channel.messages.fetch(souldrawStartMessages[souldrawId]?.id);
                if (embedMessage) {
                    await embedMessage.delete();
                }
            }

        } catch (deleteError) {
            console.error("Error deleting souldraw message:", deleteError);
            // If deleting the message fails, don't stop the cancellation process.
        }

    } catch (error) {
        console.error('Error cancelling souldraw:', error);
        interaction.reply({ content: 'There was an error cancelling the souldraw.', flags: MessageFlags.Ephemeral });
    }
}


async function handleStatusCommand(interaction, ongoingSouldraws) {
    const souldrawId = interaction.options.getString('id');
    const souldraw = ongoingSouldraws.find(sd => sd.id === souldrawId);

    if (!souldraw) {
        return interaction.reply({ content: 'Souldraw not found.', flags: MessageFlags.Ephemeral });
    }

    const embed = createSouldrawEmbed(souldraw);
    interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
    switch (unit) {
        case 's':
            break;
        case 'm':
            duration *= 60;
            break;
        case 'h':
            duration *= 60 * 60;
            break;
        case 'd':
            duration *= 60 * 60 * 24;
            break;
    }

    const endTime = Date.now() + duration * 1000;
    const souldraw = {
        id: uuidv4(),
        prize: prize,
        terms: terms,
        min: minParticipants,
        max: maxParticipants,
        numWinners: 1,
        participants: [],
        winners: [],
        endTime: endTime,
        duration: duration * 1000,
        drawMode: 'auto',
    };

    ongoingSouldraws.push(souldraw);

    try {
        await db.query('INSERT INTO souldraws (id, prize, terms, minParticipants, maxParticipants, numWinners, participants, winners, endTime, drawMode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            souldraw.id, souldraw.prize, souldraw.terms, souldraw.min, souldraw.max, souldraw.numWinners, JSON.stringify(souldraw.participants), JSON.stringify(souldraw.winners), souldraw.endTime, souldraw.drawMode
        ]);

        const embed = createSouldrawEmbed(souldraw);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_souldraw')
                .setLabel('Confirm Souldraw')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel_souldraw')
                .setLabel('Cancel Souldraw')
                .setStyle(ButtonStyle.Danger)
        );

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        confirmationMessages[souldraw.id] = message;

    } catch (error) {
        console.error('Error creating souldraw:', error);
        interaction.reply({ content: 'There was an error creating the souldraw.', flags: MessageFlags.Ephemeral });
        ongoingSouldraws = ongoingSouldraws.filter(l => l.id !== souldraw.id); // Remove the souldraw from the array
    }
}


async function handleMultiSouldrawCommand(interaction, ongoingSouldraws, souldrawStartMessages, updateIntervals, timers, confirmationMessages) {
    const time = interaction.options.getString('time');
    const prize = interaction.options.getString('prize');
    const terms = interaction.options.getString('terms') || 'No terms specified.';
    const numWinners = interaction.options.getInteger('num_winners');
    const minParticipants = interaction.options.getInteger('min');
    const maxParticipants = interaction.options.getInteger('max');

    const durationMatch = time.match(/(\d+)([smhd])/);
    if (!durationMatch) {
        return interaction.reply({ content: 'Invalid time format. Use values like 10s, 5m, 2h, 1d', flags: MessageFlags.Ephemeral });
    }

    let duration = parseInt(durationMatch[1]);
    const unit = durationMatch[2];

    switch (unit) {
        case 's':
            break;
        case 'm':
            duration *= 60;
            break;
        case 'h':
            duration *= 60 * 60;
            break;
        case 'd':
            duration *= 60 * 60 * 24;
            break;
    }

    const endTime = Date.now() + duration * 1000;
    const souldraw = {
        id: uuidv4(),
        prize: prize,
        terms: terms,
        min: minParticipants,
        max: maxParticipants,
        numWinners: numWinners,
        participants: [],
        winners: [],
        endTime: endTime,
        duration: duration * 1000,
        drawMode: 'auto',
    };

    ongoingSouldraws.push(souldraw);

    try {
        await db.query('INSERT INTO souldraws (id, prize, terms, minParticipants, maxParticipants, numWinners, participants, winners, endTime, drawMode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            souldraw.id, souldraw.prize, souldraw.terms, souldraw.min, souldraw.max, souldraw.numWinners, JSON.stringify(souldraw.participants), JSON.stringify(souldraw.winners), souldraw.endTime, souldraw.drawMode
        ]);

        const embed = createSouldrawEmbed(souldraw);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_souldraw')
                .setLabel('Confirm Souldraw')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel_souldraw')
                .setLabel('Cancel Souldraw')
                .setStyle(ButtonStyle.Danger)
        );

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        confirmationMessages[souldraw.id] = message;

    } catch (error) {
        console.error('Error creating multi souldraw:', error);
        interaction.reply({ content: 'There was an error creating the multi souldraw.', flags: MessageFlags.Ephemeral });
        ongoingSouldraws = ongoingSouldraws.filter(l => l.id !== souldraw.id); // Remove the souldraw from the array
    }
}



async function handleRemoveCommand(interaction, ongoingSouldraws) {
    const souldrawId = interaction.options.getString('id');
    const souldraw = ongoingSouldraws.find(sd => sd.id === souldrawId);

    if (!souldraw) {
        return interaction.reply({ content: 'Souldraw not found.', flags: MessageFlags.Ephemeral });
    }

    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ content: 'Only administrators can remove participants.', flags: MessageFlags.Ephemeral });
    }

    // Create a select menu of participants to remove
    const removeRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('remove_participant')
            .setPlaceholder('Select a participant to remove')
            .addOptions(
                souldraw.participants.map(participantId =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(interaction.guild.members.cache.get(participantId)?.displayName || 'Unknown User') // Get username or display name
                        .setValue(participantId)
                )
            )
    );

    if (souldraw.participants.length === 0) {
        return interaction.reply({ content: 'There are no participants to remove.', flags: MessageFlags.Ephemeral });
    }

    interaction.reply({ content: 'Select a participant to remove:', components: [removeRow], flags: MessageFlags.Ephemeral });
}

async function handleHelpCommand(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Souldraw Bot Commands')
        .setDescription('List of available commands:')
        .addFields(
            { name: '/sd', value: 'Start a new souldraw' },
            { name: '/msd', value: 'Start a new souldraw with multiple winners' },
            { name: '/cnl', value: 'Cancel the ongoing souldraw' },
            { name: '/st', value: 'Check the current status of the souldraw' },
            { name: '/rm', value: 'Remove participants from the souldraw (Admin only)' },
            { name: '/hlp', value: 'Display a list of commands' },
        );

    interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}


module.exports = {
    handleSouldrawCommand,
    handleMultiSouldrawCommand,
    handleCancelCommand,
    handleStatusCommand,
    handleRemoveCommand,
    handleHelpCommand
};
