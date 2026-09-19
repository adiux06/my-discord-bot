const musicQueue = require('../utils/musicQueue');
const { EmbedBuilder } = require('discord.js');

/**
 * Music Command Handler
 * Handles play, skip, stop, pause, resume
 */
module.exports = {
  name: 'music',
  description: 'Plays music from YouTube, SoundCloud, Spotify or URLs in voice channels.',
  async execute(message, args, subCommand) {
    try {
      const action = subCommand ? subCommand.toLowerCase() : (args[0] ? args[0].toLowerCase() : 'play');

      switch (action) {
        case 'skip':
          return musicQueue.handleSkip(message);
        case 'stop':
          return musicQueue.handleStop(message);
        case 'pause':
          return musicQueue.handlePause(message);
        case 'resume':
          return musicQueue.handleResume(message);
        case 'play':
        default: {
          const query = subCommand ? args.join(' ') : args.join(' ');
          if (!query || query.trim().length === 0) {
            return message.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FFA500')
                  .setTitle('Missing Music Link/Query')
                  .setDescription('⚠️ Please provide a song link or search term.\n\n**Example:** `@botname https://www.youtube.com/watch?v=...` or `@botname play lofi beats`')
              ]
            });
          }
          return musicQueue.handlePlay(message, query);
        }
      }
    } catch (error) {
      console.error('Error in music command execution:', error);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setTitle('Error')
            .setDescription(`❌ Music system error: ${error.message || 'Unknown error'}`)
        ]
      });
    }
  }
};
