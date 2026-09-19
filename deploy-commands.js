require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'your_bot_token_here') {
  console.error('❌ Error: DISCORD_TOKEN is missing in your .env file!');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`[Deploy] Prepared slash command: /${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`⏳ Refreshing ${commands.length} application (/) commands...`);

    // Dynamically retrieve client ID from Discord REST API
    const currentUser = await rest.get(Routes.user('@me'));
    console.log(`🤖 Deploying for: ${currentUser.username}#${currentUser.discriminator || '0'} (ID: ${currentUser.id})`);

    const data = await rest.put(
      Routes.applicationCommands(currentUser.id),
      { body: commands }
    );

    console.log(`✅ Successfully registered ${data.length} slash command(s) globally.`);
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
