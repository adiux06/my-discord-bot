require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const musicQueue = require('./utils/musicQueue');

// Initialize Discord Client with required Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Create command collection registries
client.commands = new Collection();
client.slashCommands = new Collection();

// Load command modules dynamically from /commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (command.name) {
    client.commands.set(command.name, command);
    console.log(`[Command Loaded]: ${command.name}`);
  }
  if (command.data) {
    client.slashCommands.set(command.data.name, command);
    console.log(`[Slash Command Loaded]: /${command.data.name}`);
  }
}

// Bot ready event
client.once('clientReady', async () => {
  console.log(`=================================`);
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`🌐 Connected to ${client.guilds.cache.size} server(s)`);
  console.log(`=================================`);

  client.user.setActivity('for messages & /ping', { type: ActivityType.Watching });

  // Auto-register slash commands with Discord REST API
  if (client.slashCommands.size > 0 && process.env.DISCORD_TOKEN) {
    try {
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      const slashData = client.slashCommands.map(cmd => cmd.data.toJSON());
      console.log(`⏳ Auto-registering ${slashData.length} global slash command(s)...`);
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: slashData }
      );
      console.log(`✅ Global slash command(s) registered successfully!`);
    } catch (err) {
      console.error('⚠️ Note: Could not auto-register slash commands:', err.message);
    }
  }
});

// Voice State Update Event (handles auto-leave when channel is empty)
client.on('voiceStateUpdate', (oldState, newState) => {
  try {
    musicQueue.checkEmptyVoiceChannels(oldState, newState);
  } catch (error) {
    console.error('Error in voiceStateUpdate handler:', error);
  }
});

// Interaction Create Event Handler (handles Slash Commands)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);
  if (!command) {
    console.warn(`No slash command matching /${interaction.commandName} was found.`);
    return;
  }

  try {
    if (typeof command.executeSlash === 'function') {
      await command.executeSlash(interaction);
    } else if (typeof command.execute === 'function') {
      await command.execute(interaction);
    }
  } catch (error) {
    console.error(`Error executing slash command /${interaction.commandName}:`, error);
    const replyContent = { content: '❌ There was an error while executing this command!', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyContent).catch(() => {});
    } else {
      await interaction.reply(replyContent).catch(() => {});
    }
  }
});

// Message Create Event Handler (plain message triggers & bot mentions)
client.on('messageCreate', async (message) => {
  // Ignore bots and DM messages
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const botMention = `<@${client.user.id}>`;
  const botMentionNickname = `<@!${client.user.id}>`;

  let cleanContent = '';
  let isMentioned = false;

  if (content.startsWith(botMention)) {
    cleanContent = content.slice(botMention.length).trim();
    isMentioned = true;
  } else if (content.startsWith(botMentionNickname)) {
    cleanContent = content.slice(botMentionNickname.length).trim();
    isMentioned = true;
  }

  // Handle Mention Triggers (@botname ...)
  if (isMentioned) {
    if (!cleanContent) {
      return message.reply(`Hello! I'm active and ready. Try commands like:\n• \`/ping\` or \`ping\`\n• \`kick @user [reason]\`\n• \`@${client.user.username} <link>\`\n• \`@${client.user.username} give power\``);
    }

    const args = cleanContent.split(/ +/);
    const firstWord = args[0].toLowerCase();
    const restWords = args.slice(1).join(' ');

    // Match 0: @botname ping
    if (firstWord === 'ping') {
      const command = client.commands.get('ping');
      if (command) return command.execute(message, args.slice(1));
    }

    // Match 1: @botname give power / givepower
    if (firstWord === 'givepower' || (firstWord === 'give' && args[1]?.toLowerCase() === 'power')) {
      const command = client.commands.get('givepower');
      if (command) return command.execute(message, args);
    }

    // Match 2: @botname kick ...
    if (firstWord === 'kick') {
      const command = client.commands.get('kick');
      if (command) return command.execute(message, args.slice(1));
    }

    // Match 3: @botname music subcommands (skip, stop, pause, resume)
    if (['skip', 'stop', 'pause', 'resume'].includes(firstWord)) {
      const command = client.commands.get('music');
      if (command) return command.execute(message, [], firstWord);
    }

    // Match 4: @botname play <query/link>
    if (firstWord === 'play') {
      const command = client.commands.get('music');
      if (command) return command.execute(message, args.slice(1), 'play');
    }

    // Default for @botname <link> or @botname <search query>: Treat as Music Play command
    const command = client.commands.get('music');
    if (command) return command.execute(message, args, 'play');
  }

  // Handle Plain Unmentioned Message Triggers
  const args = content.split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Plain ping trigger: `ping`
  if (commandName === 'ping') {
    const command = client.commands.get('ping');
    if (command) return command.execute(message, args);
  }

  // Plain kick trigger: `kick @user [reason]`
  if (commandName === 'kick') {
    const command = client.commands.get('kick');
    if (command) return command.execute(message, args);
  }

  // Plain give power trigger: `give power`
  if (commandName === 'givepower' || (commandName === 'give' && args[0]?.toLowerCase() === 'power')) {
    const command = client.commands.get('givepower');
    if (command) return command.execute(message, args);
  }

  // Plain music triggers: `play <link>`, `skip`, `stop`, `pause`, `resume`
  if (['play', 'skip', 'stop', 'pause', 'resume'].includes(commandName)) {
    const command = client.commands.get('music');
    if (command) return command.execute(message, args, commandName);
  }
});

// Anti-crash process protection
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection at Promise]:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('[Uncaught Exception]:', err, origin);
});

// Login to Discord
const token = process.env.DISCORD_TOKEN;
if (!token || token === 'your_bot_token_here') {
  console.error('❌ Error: DISCORD_TOKEN is missing in your .env file!');
  console.error('Please add your Discord Bot token to the .env file.');
  process.exit(1);
}

client.login(token);
