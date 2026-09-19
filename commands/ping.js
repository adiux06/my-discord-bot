const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Ping Command
 * Supports both slash command (/ping) and plain message trigger (ping / @bot ping).
 */
module.exports = {
  name: 'ping',
  description: 'Replies with Pong and latency statistics.',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and latency statistics!'),

  /**
   * Slash command execution handler
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async executeSlash(interaction) {
    const startTime = Date.now();
    await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const roundtrip = Date.now() - startTime;
    const wsPing = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🏓 Pong!')
      .setDescription('Bot is responsive and online!')
      .addFields(
        { name: '📡 Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: '💓 WebSocket Heartbeat', value: `\`${wsPing}ms\``, inline: true }
      )
      .setFooter({ text: 'Slash Command • Discord API v10' })
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },

  /**
   * Plain text message execution handler
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    const sent = await message.reply('🏓 Pinging...');
    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const wsPing = message.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🏓 Pong!')
      .setDescription('Bot is responsive and online!')
      .addFields(
        { name: '📡 Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: '💓 WebSocket Heartbeat', value: `\`${wsPing}ms\``, inline: true }
      )
      .setFooter({ text: 'Message Command • Discord API v10' })
      .setTimestamp();

    await sent.edit({ content: null, embeds: [embed] });
  }
};
