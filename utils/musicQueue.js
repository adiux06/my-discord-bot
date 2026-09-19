const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
  getVoiceConnection
} = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const ytdl = require('yt-dlp-exec');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');

// In-memory queue storage per guild
const queues = new Map();

/**
 * Resolves input query or link into track metadata using yt-dlp.
 */
async function resolveTrackInfo(input, author) {
  let query = input.trim();

  // If input is a Spotify link, convert to search query
  if (query.includes('spotify.com')) {
    // Attempt basic clean string extraction for spotify tracks
    const match = query.match(/track\/([a-zA-Z0-9]+)/);
    if (match) {
      query = `ytsearch:${query}`;
    } else {
      query = `ytsearch:${query}`;
    }
  } else if (!query.startsWith('http://') && !query.startsWith('https://')) {
    query = `ytsearch:${query}`;
  }

  // Use yt-dlp to extract metadata
  const info = await ytdl(
    query,
    {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      defaultSearch: 'ytsearch',
      preferFreeFormats: true,
    },
    { windowsHide: true }
  );

  // Handle search results where info might contain entries array
  const track = info.entries ? info.entries[0] : info;

  if (!track) {
    throw new Error('No track found for the provided query or link.');
  }

  return {
    title: track.title || 'Unknown Track',
    url: track.webpage_url || track.url || input,
    streamUrl: track.url || track.webpage_url || input,
    thumbnail: track.thumbnail || (track.thumbnails && track.thumbnails.length > 0 ? track.thumbnails[0].url : null),
    duration: track.duration_string || (track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : 'Unknown'),
    requester: author
  };
}

/**
 * Creates an audio resource by piping yt-dlp stdout into ffmpeg raw s16le stream.
 */
function createStreamResource(streamUrl) {
  const ytdlProc = ytdl.exec(
    streamUrl,
    {
      output: '-',
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      quiet: true,
      noPlaylist: true
    },
    {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    }
  );

  const ffmpegProc = spawn(
    ffmpeg,
    [
      '-i', 'pipe:0',
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    }
  );

  ytdlProc.stdout.pipe(ffmpegProc.stdin);

  ffmpegProc.stdin.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('[ffmpeg stdin error]:', err);
  });
  ytdlProc.stdout.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('[ytdl stdout error]:', err);
  });

  ytdlProc.on('error', err => console.error('[yt-dlp stream error]:', err));
  ffmpegProc.on('error', err => console.error('[ffmpeg stream error]:', err));

  return createAudioResource(ffmpegProc.stdout, {
    inputType: StreamType.Raw
  });
}

/**
 * Helper to play the next song in a guild queue.
 */
async function playNextSong(guildId) {
  const serverQueue = queues.get(guildId);
  if (!serverQueue) return;

  if (serverQueue.idleTimer) {
    clearTimeout(serverQueue.idleTimer);
    serverQueue.idleTimer = null;
  }

  if (serverQueue.songs.length === 0) {
    // Queue is empty -> auto leave after 30s if still empty
    serverQueue.currentSong = null;
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('Queue Finished')
      .setDescription('🎵 Queue is now empty. The bot will leave the voice channel if no new songs are added soon.');
    serverQueue.textChannel.send({ embeds: [embed] }).catch(() => {});

    serverQueue.idleTimer = setTimeout(() => {
      destroyQueue(guildId, 'Queue was empty for 30 seconds.');
    }, 30000);
    return;
  }

  const song = serverQueue.songs.shift();
  serverQueue.currentSong = song;

  try {
    const resource = createStreamResource(song.streamUrl);
    serverQueue.player.play(resource);

    // Send Now Playing Embed
    const embed = new EmbedBuilder()
      .setColor('#00E5FF')
      .setTitle('🎶 Now Playing')
      .setDescription(`[**${song.title}**](${song.url})`)
      .addFields(
        { name: 'Duration', value: song.duration, inline: true },
        { name: 'Requested by', value: `${song.requester}`, inline: true },
        { name: 'Queue Length', value: `${serverQueue.songs.length} song(s) remaining`, inline: true }
      )
      .setTimestamp();

    if (song.thumbnail) {
      embed.setThumbnail(song.thumbnail);
    }

    serverQueue.textChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (error) {
    console.error(`Error playing song in guild ${guildId}:`, error);
    serverQueue.textChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF4B4B')
          .setTitle('Playback Error')
          .setDescription(`❌ Could not play **${song.title}**: ${error.message || 'Unknown error'}. Skipping to next...`)
      ]
    }).catch(() => {});

    // Try playing next song
    playNextSong(guildId);
  }
}

/**
 * Destroys and cleans up a server's voice queue.
 */
function destroyQueue(guildId, reason) {
  const serverQueue = queues.get(guildId);
  if (serverQueue) {
    if (serverQueue.idleTimer) clearTimeout(serverQueue.idleTimer);
    try {
      serverQueue.player.stop();
      serverQueue.connection.destroy();
    } catch (err) {}

    if (reason && serverQueue.textChannel) {
      serverQueue.textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#888888')
            .setTitle('Disconnected')
            .setDescription(`👋 Left voice channel: ${reason}`)
        ]
      }).catch(() => {});
    }

    queues.delete(guildId);
  }
}

/**
 * Public Music Manager API
 */
module.exports = {
  getQueue(guildId) {
    return queues.get(guildId);
  },

  async handlePlay(message, queryInput) {
    const { guild, member, channel } = message;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setTitle('Voice Channel Required')
            .setDescription('❌ You must be in a voice channel for me to play music!')
        ]
      });
    }

    // Check bot permissions for voice channel
    const permissions = voiceChannel.permissionsFor(guild.members.me);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setTitle('Missing Permissions')
            .setDescription('❌ I need **Connect** and **Speak** permissions in your voice channel!')
        ]
      });
    }

    // Send loading feedback
    const loadingMsg = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFFF00')
          .setDescription('🔍 Searching and extracting track details...')
      ]
    }).catch(() => null);

    let song;
    try {
      song = await resolveTrackInfo(queryInput, message.author);
    } catch (err) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF4B4B')
        .setTitle('Extraction Error')
        .setDescription(`❌ Could not resolve song: ${err.message}`);
      
      if (loadingMsg) return loadingMsg.edit({ embeds: [errorEmbed] });
      return message.reply({ embeds: [errorEmbed] });
    }

    let serverQueue = queues.get(guild.id);

    if (!serverQueue) {
      // Create voice connection & player
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      serverQueue = {
        textChannel: channel,
        voiceChannel: voiceChannel,
        connection: connection,
        player: player,
        songs: [],
        currentSong: null,
        idleTimer: null
      };

      queues.set(guild.id, serverQueue);

      // Listen for player state changes
      player.on(AudioPlayerStatus.Idle, () => {
        playNextSong(guild.id);
      });

      player.on('error', (err) => {
        console.error(`AudioPlayer error in guild ${guild.id}:`, err);
        playNextSong(guild.id);
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signaling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
          // Reconnecting...
        } catch (error) {
          destroyQueue(guild.id, 'Bot was disconnected from the voice channel.');
        }
      });

      serverQueue.songs.push(song);
      
      if (loadingMsg) await loadingMsg.delete().catch(() => {});

      // Start playing
      await playNextSong(guild.id);
    } else {
      serverQueue.songs.push(song);

      const queueEmbed = new EmbedBuilder()
        .setColor('#00FF88')
        .setTitle('➕ Added to Queue')
        .setDescription(`[**${song.title}**](${song.url})`)
        .addFields(
          { name: 'Position in Queue', value: `#${serverQueue.songs.length}`, inline: true },
          { name: 'Duration', value: song.duration, inline: true },
          { name: 'Requested by', value: `${song.requester}`, inline: true }
        );

      if (song.thumbnail) queueEmbed.setThumbnail(song.thumbnail);

      if (loadingMsg) {
        await loadingMsg.edit({ embeds: [queueEmbed] });
      } else {
        await message.reply({ embeds: [queueEmbed] });
      }
    }
  },

  handleSkip(message) {
    const { guild, member } = message;
    const serverQueue = queues.get(guild.id);

    if (!member.voice.channel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setDescription('❌ You must be in a voice channel to skip songs!')
        ]
      });
    }

    if (!serverQueue || !serverQueue.currentSong) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FFA500')
            .setDescription('⚠️ There is no song currently playing to skip.')
        ]
      });
    }

    serverQueue.player.stop(); // Triggers AudioPlayerStatus.Idle -> plays next song

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF88')
          .setDescription('⏭️ Skipped current track.')
      ]
    });
  },

  handleStop(message) {
    const { guild, member } = message;
    const serverQueue = queues.get(guild.id);

    if (!member.voice.channel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setDescription('❌ You must be in a voice channel to stop the music!')
        ]
      });
    }

    if (!serverQueue) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FFA500')
            .setDescription('⚠️ No active music playback to stop.')
        ]
      });
    }

    serverQueue.songs = [];
    serverQueue.player.stop();
    destroyQueue(guild.id, 'Playback stopped by user.');

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF4B4B')
          .setDescription('⏹️ Stopped music playback and cleared the queue.')
      ]
    });
  },

  handlePause(message) {
    const { guild, member } = message;
    const serverQueue = queues.get(guild.id);

    if (!member.voice.channel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setDescription('❌ You must be in a voice channel to pause music!')
        ]
      });
    }

    if (!serverQueue || !serverQueue.currentSong) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FFA500')
            .setDescription('⚠️ There is no music playing right now.')
        ]
      });
    }

    const paused = serverQueue.player.pause();
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(paused ? '#FFA500' : '#FF4B4B')
          .setDescription(paused ? '⏸️ Music paused.' : '⚠️ Music is already paused.')
      ]
    });
  },

  handleResume(message) {
    const { guild, member } = message;
    const serverQueue = queues.get(guild.id);

    if (!member.voice.channel) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setDescription('❌ You must be in a voice channel to resume music!')
        ]
      });
    }

    if (!serverQueue || !serverQueue.currentSong) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FFA500')
            .setDescription('⚠️ No music is currently paused or playing.')
        ]
      });
    }

    const resumed = serverQueue.player.unpause();
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(resumed ? '#00FF88' : '#FF4B4B')
          .setDescription(resumed ? '▶️ Music resumed.' : '⚠️ Music is already playing.')
      ]
    });
  },

  checkEmptyVoiceChannels(oldState, newState) {
    // Helper called on voiceStateUpdate to auto leave when human count reaches 0
    const guildId = oldState.guild.id;
    const serverQueue = queues.get(guildId);
    if (!serverQueue) return;

    const channel = serverQueue.voiceChannel;
    if (channel) {
      const nonBots = channel.members.filter(m => !m.user.bot);
      if (nonBots.size === 0) {
        destroyQueue(guildId, 'All members left the voice channel.');
      }
    }
  }
};
