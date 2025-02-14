// main.js (Part 1)
const { Client, GatewayIntentBits, REST, Routes, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
require('dotenv').config();
const { db, getOngoingSouldraws, updateSouldrawParticipants, updateSouldrawStatus } = require('./db');
const { createSouldrawEmbed } = require('./lotteryEmbed');
const {
    handleSouldrawCommand, handleMultiSouldrawCommand, handleCancelCommand,
    handleDrawCommand, handleStatusCommand, handleRemoveCommand, handleHelpCommand
} = require('./commands');
const { formatTime } = require('./utils');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

let ongoingSouldraws = [];
let timers = {};
let updateIntervals = {};
let confirmationMessages = {};
let souldrawStartMessages = {};

// HTTP server to keep bot alive on hosting platforms like Render
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running\n');
}).listen(process.env.PORT || 3000).on('error', (error) => {
    console.error('HTTP server error:', error);
});

client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            {
                body: [
                    {
                        name: 'sd',
                        description: 'Start a new souldraw',
                        options: [
                            {
                                name: 'time',
                                description: 'Duration of the souldraw (e.g., 60m, 2h)',
                                type: 3, // STRING
                                required: true,
                            },
                            {
                                name: 'prize',
                                description: 'Prize for the souldraw',
                                type: 3, // STRING
                                required: true,
                            },
                            {
                                name: 'min',
                                description: 'Minimum number of participants',
                                type: 4, // INTEGER
                                required: true,
                            },
                            {
                                name: 'max',
                                description: 'Maximum number of participants',
                                type: 4, // INTEGER
                                required: true,
                            },
                            {
                                name: 'terms',
                                description: 'Terms and conditions for the souldraw',
                                type: 3, // STRING
                                required: false,
                            },
                        ],
                    },
                    {
                        name: 'msd',
                        description: 'Start a souldraw with multiple winners',
                        options: [
                            {
                                name: 'time',
                                description: 'Duration of the souldraw (e.g., 60m, 2h)',
                                type: 3, // STRING
                                required: true,
                            },
                            {
                                name: 'prize',
                                description: 'Prize for the souldraw',
                                type: 3, // STRING
                                required: true,
                            },
                            {
                                name: 'num_winners',
                                description: 'Number of winners',
                                type: 4, // INTEGER
                                required: true,
                            },
                            {
                                name: 'min',
                                description: 'Minimum number of participants',
                                type: 4, // INTEGER
                                required: true,
                            },
                            {
                                name: 'max',
                                description: 'Maximum number of participants',
                                type: 4, // INTEGER
                                required: true,
                            },
                            {
                                name: 'terms',
                                description: 'Terms and conditions for the souldraw',
                                type: 3, // STRING
                                required: false,
                            },
                        ],
                    },
                    {
                        name: 'cnl',
                        description: 'Cancel the ongoing souldraw',
                        options: [
                            {
                                name: 'id',
                                description: 'ID of the souldraw to cancel',
                                type: 3, // STRING
                                required: true,
                            },
                        ],
                    },
                    {
                        name: 'st',
                        description: 'Check the current status of the souldraw',
                        options: [
                            {
                                name: 'id',
                                description: 'ID of the souldraw to check',
                                type: 3, // STRING
                                required: true,
                            },
                        ],
                    },
                    {
                        name: 'rm',
                        description: 'Remove participants from the souldraw (Admin only)',
                        options: [
                            {
                                name: 'id',
                                description: 'ID of the souldraw to remove from',
                                type: 3, // STRING
                                required: true,
                            },
                        ],
                    },
                    {
                        name: 'hlp',
                        description: 'Display a list of commands',
                    },
                ],
            },
        );
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Failed to register slash commands:', error);
    }

            try {
        const rows = await getOngoingSouldraws();
        rows.forEach(row => {
            const souldraw = {
                id: row.id,
                prize: row.prize,
                terms: row.terms,
                min: row.minParticipants,
                max: row.maxParticipants,
                numWinners: row.numWinners,
                participants: JSON.parse(row.participants),
                winners: JSON.parse(row.winners),
                endTime: row.endTime,
                duration: row.endTime - Date.now(),
                drawMode: row.drawMode || 'auto',
            };

            ongoingSouldraws.push(souldraw);
            console.log('Ongoing souldraw restored from database:', souldraw.id);

            startSouldrawTimersAndIntervals(souldraw, client);

        });
    } catch (error) {
        console.error('Error restoring souldraws:', error);
    }
});

function startSouldrawTimersAndIntervals(souldraw, client) {
    const embed = createSouldrawEmbed(souldraw);
    const channel = client.channels.cache.get(process.env.CHANNEL_ID); // Replace with your channel ID
    if (!channel) {
        console.error("Channel not found!");
        return;
    }

    channel.send({ embeds: [embed] })
        .then(message => {
            souldrawStartMessages[souldraw.id] = message;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_souldraw')
                    .setLabel('🎟️ Join Souldraw!')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('view_participants')
                    .setLabel('👥 View Participants')
                    .setStyle(ButtonStyle.Secondary)
            );
            message.edit({ components: [row] });

            updateIntervals[souldraw.id] = setInterval(async () => {
                const timeRemaining = Math.max(0, souldraw.endTime - Date.now());
                embed.setDescription(
                    `**Prize:** ${souldraw.prize}\n**Terms:** ${souldraw.terms}\n**Number of Winners:** ${souldraw.numWinners || 1}\n**Min Participants:** ${souldraw.min || 'No Minimum'}\n**Max Participants:** ${souldraw.max || 'No Maximum'}\n**Time Remaining:** ${formatTime(timeRemaining)}\n\nClick the button below to join!`
                );

                try {
                    await message.edit({ embeds: [embed] });
                } catch (error) {
                    console.error('Failed to update souldraw message:', error);
                    clearInterval(updateIntervals[souldraw.id]);
                }

                if (timeRemaining <= 0) {
                    clearInterval(updateIntervals[souldraw.id]);
                }
            }, 15000);

            timers[souldraw.id] = setTimeout(() => {
                handleDrawCommand({
                    followUp: async (content) => {
                        await message.reply(content)
                    },
                    reply: async (content) => {
                        await message.reply(content)
                    }
                }, ongoingSouldraws, souldrawStartMessages, updateIntervals, timers);
            }, souldraw.duration);
        })
        .catch(console.error);
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: 'Only admins can use this bot.', flags: MessageFlags.Ephemeral });
        }

        switch (commandName) {
            case 'sd':
                await handleSouldrawCommand(interaction, ongoingSouldraws, souldrawStartMessages, updateIntervals, timers, confirmationMessages);
                break;
            case 'msd':
                await handleMultiSouldrawCommand(interaction, ongoingSouldraws, souldrawStartMessages, updateIntervals, timers, confirmationMessages);
                break;
            case 'cnl':
                await handleCancelCommand(interaction, ongoingSouldraws, timers, updateIntervals);
                break;
            case 'st':
                await handleStatusCommand(interaction, ongoingSouldraws);
                break;
            case 'rm':
                await handleRemoveCommand(interaction, ongoingSouldraws);
                break;
            case 'hlp':
                await handleHelpCommand(interaction);
                break;
        }
    } else if (interaction.isButton()) {
        const lotteryIdMatch = interaction.message.embeds[0]?.description?.match(/Souldraw ID: (\w+)/);
        if (!lotteryIdMatch) {
            return interaction.reply({ content: 'Unable to find souldraw ID in the message.', flags: MessageFlags.Ephemeral });
        }

        const souldrawId = lotteryIdMatch[1];
        const souldraw = ongoingSouldraws.find(l => l.id === souldrawId);
        if (!souldraw) {
            return interaction.reply({ content: 'There is no ongoing souldraw.', flags: MessageFlags.Ephemeral });
        }

        switch (interaction.customId) {
            case 'join_souldraw':
                if (souldraw.participants.includes(interaction.user.id)) {
                    return interaction.reply({ content: 'You have already joined this souldraw.', flags: MessageFlags.Ephemeral });
                }
                if (souldraw.max && souldraw.participants.length >= souldraw.max) {
                    return interaction.reply({ content: 'This souldraw is full.', flags: MessageFlags.Ephemeral });
                }

                souldraw.participants.push(interaction.user.id);
                await updateSouldrawParticipants(souldraw.id, souldraw.participants);

                const joinEmbed = createSouldrawEmbed(souldraw);
                const joinRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_souldraw')
                        .setLabel('🎟️ Join Souldraw!')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('view_participants')
                        .setLabel('👥 View Participants')
                        .setStyle(ButtonStyle.Secondary)
                );
                interaction.message.edit({ embeds: [joinEmbed], components: [joinRow] });

                interaction.reply({ content: 'You have successfully joined the souldraw!', flags: MessageFlags.Ephemeral });
                break;
            case 'view_participants':

                const participantList = souldraw.participants
                    .map((participantId, index) => `${index + 1}. <@${participantId}>`)
                    .join('\n') || 'No participants yet.';

                const participantEmbed = new EmbedBuilder()
                    .setTitle('👥 Current Participants')
                    .setDescription(participantList)
                    .setColor('Blue');

                interaction.reply({ embeds: [participantEmbed], flags: MessageFlags.Ephemeral });
                break;
            case 'confirm_souldraw':
                if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                    return interaction.reply({ content: 'Only admins can confirm souldraws.', flags: MessageFlags.Ephemeral });
                }

                delete confirmationMessages[souldraw.id];
                const confirmedEmbed = createSouldrawEmbed(souldraw);
                const confirmedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_souldraw')
                        .setLabel('🎟️ Join Souldraw!')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('view_participants')
                        .setLabel('👥 View Participants')
                        .setStyle(ButtonStyle.Secondary)
                );
                interaction.message.edit({ embeds: [confirmedEmbed], components: [confirmedRow] });

                interaction.reply({ content: 'Souldraw confirmed!', flags: MessageFlags.Ephemeral });
                startSouldrawTimersAndIntervals(souldraw, client);
                break;
            case 'cancel_souldraw':
                if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                    return interaction.reply({ content: 'Only admins can cancel souldraws.', flags: MessageFlags.Ephemeral });
                }

                delete confirmationMessages[souldraw.id];
                clearTimeout(timers[souldraw.id]);
                clearInterval(updateIntervals[souldraw.id]);
                ongoingSouldraws = ongoingSouldraws.filter(l => l.id !== souldraw.id);
                updateSouldrawStatus(souldraw.id, 'cancelled');

                interaction.message.delete();
                interaction.reply({ content: 'Souldraw cancelled!', flags: MessageFlags.Ephemeral });
                break;
            case 'toggle_draw_mode':
                if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                    return interaction.reply({ content: 'Only admins can change draw mode.', flags: MessageFlags.Ephemeral });
                }
                souldraw.drawMode = souldraw.drawMode === 'auto' ? 'manual' : 'auto';
                updateSouldrawStatus(souldraw.id, souldraw.drawMode === 'auto' ? 'auto' : 'manual');

                const drawModeEmbed = createSouldrawEmbed(souldraw);
                const drawModeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_souldraw')
                        .setLabel('🎟️ Join Souldraw!')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('view_participants')
                        .setLabel('👥 View Participants')
                        .setStyle(ButtonStyle.Secondary)
                );
                interaction.message.edit({ embeds: [drawModeEmbed], components: [drawModeRow] });

                interaction.reply({ content: `Draw mode toggled to ${souldraw.drawMode === 'auto' ? 'auto' : 'manual'}`, flags: MessageFlags.Ephemeral });
                break;
        }
    }

          } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'remove_participant') {
            const souldrawToRemove = ongoingSouldraws.find(l => l.id === interaction.message.embeds[0].description.match(/Souldraw ID: (\w+)/)[1]);

            if (!souldrawToRemove) {
                return interaction.reply({ content: 'Souldraw not found.', flags: MessageFlags.Ephemeral });
            }

            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return interaction.reply({ content: 'Only admins can remove participants.', flags: MessageFlags.Ephemeral });
            }

            const participantToRemove = interaction.values[0];
            souldrawToRemove.participants = souldrawToRemove.participants.filter(p => p !== participantToRemove);
            await updateSouldrawParticipants(souldrawToRemove.id, souldrawToRemove.participants);

            const updatedParticipantList = souldrawToRemove.participants
                .map((participantId, index) => `${index + 1}. <@${participantId}>`)
                .join('\n') || 'No participants yet.';

            const updatedParticipantEmbed = new EmbedBuilder()
                .setTitle('👥 Current Participants')
                .setDescription(updatedParticipantList)
                .setColor('Blue');

            const updatedRemoveRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('remove_participant')
                    .setPlaceholder('Select a participant to remove')
                    .addOptions(
                        souldrawToRemove.participants.map((participantId) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(interaction.guild.members.cache.get(participantId)?.displayName || 'Unknown User')
                                .setValue(participantId)
                        )
                    )
            );

            interaction.update({ embeds: [updatedParticipantEmbed], components: [updatedRemoveRow], flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
