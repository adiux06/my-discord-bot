# 🤖 Discord Bot (Node.js & discord.js v14)

A modular, feature-rich Discord bot built using Node.js and **discord.js v14** featuring **Moderation Kick**, **Voice Music Streaming** (using `@discordjs/voice`, `yt-dlp-exec`, and `ffmpeg-static`), and an interactive **Give Power Permission Panel** using Discord select menus and buttons.

---

## 🌟 Features Summary

1. **👢 Kick (`/commands/kick.js`)**
   - Trigger: `kick @user [reason]` or `@botname kick @user [reason]`.
   - Security: Checks permission (`Kick Members` / `Administrator` / Guild Owner).
   - Guards: Protects server owner, bot itself, and command author. Checks role hierarchy and bot permissions.
   - Reply: Rich confirmation embed with details.

2. **🎵 Music (`/commands/music.js` & `utils/musicQueue.js`)**
   - Trigger: `@botname <link>` or `play <link>`, `@botname skip`, `@botname stop`, `@botname pause`, `@botname resume`.
   - Supports YouTube, SoundCloud, Spotify (search resolution), and direct audio URLs.
   - Uses `@discordjs/voice`, `yt-dlp-exec`, and `ffmpeg-static` (NO `ytdl-core`).
   - Features per-server music queue, "Now Playing" embed with thumbnail, and auto-leave on empty queue or channel.

3. **👑 Give Power Permission Panel (`/commands/givepower.js`)**
   - Trigger: `@botname give power`.
   - Security: Restricted to Server Owner and Administrators only.
   - Interactive UI: Step 1 `UserSelectMenu` picker, Step 2 multi-select Permission Menus, Step 3 Confirm & Cancel buttons.
   - Role Management: Automatically creates or updates role named `Power-<username>` with selected permissions and assigns it.
   - Role Hierarchy & Safety: Checks bot permissions and role positions. Author-only interaction with a 2-minute auto-expiry timer.

4. **🏓 Ping & Slash Commands (`/commands/ping.js`)**
   - Slash Command: `/ping` (with instant embed response, roundtrip latency, and WebSocket heartbeat).
   - Plain Message Trigger: `ping` or `@botname ping`.
   - Automatic registration on startup or manual deployment via `npm run deploy`.

---

## 🛠️ Step-by-Step Setup Guide

### Step 1: Create Bot in Discord Developer Portal

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** in the top right corner.
3. Enter a name for your application (e.g., `MyPowerBot`) and click **Create**.
4. In the left menu, click **Bot**.
5. Click **Reset Token** (or **Add Bot** / **Copy Token**) to reveal your bot token.
6. Copy this token — you will paste it into your `.env` file.

### Step 2: Enable Privileged Gateway Intents (CRITICAL)

1. Under the **Bot** tab on the Developer Portal, scroll down to **Privileged Gateway Intents**.
2. Toggle **ON** the following intents:
   - ✅ **Presence Intent** (optional)
   - ✅ **Server Members Intent** (Required for member fetching & kick/power logic)
   - ✅ **Message Content Intent** (Required for reading plain message commands)
3. Click **Save Changes** at the bottom.

### Step 3: Invite Bot to Your Server

1. In the left menu, click **OAuth2** -> **URL Generator**.
2. Under **Scopes**, select:
   - ✅ `bot`
   - ✅ `applications.commands` *(Required for slash commands like `/ping`!)*
3. Under **Bot Permissions**, select:
   - ✅ `Administrator` (or select `Kick Members`, `Manage Roles`, `Manage Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Connect`, `Speak`, `Mute Members`, `Move Members`).
4. Copy the generated **OAuth2 URL** at the bottom and paste it into your web browser.
5. Select your Discord server and click **Authorize**.

---

## 🚀 Installation & Running

### Prerequisites
- [Node.js](https://nodejs.org/) version 16.9.0 or higher.
- `npm` installed.

### 1. Install Dependencies
Run the following command in the project root directory:
```bash
npm install
```

### 2. Configure Environment Variables
Open or create `.env` file in the root folder and add your bot token:
```env
DISCORD_TOKEN=your_actual_bot_token_here
```

### 3. Start the Bot
- **Option A (Double-Click)**: Double-click `start.bat` in the project folder.
- **Option B (Terminal)**: Run:
```bash
npm start
```
*or*
```bash
node index.js
```

You should see:
```text
[Command Loaded]: kick
[Command Loaded]: music
[Command Loaded]: givepower
=================================
🤖 Logged in as MyPowerBot#1234
🌐 Connected to 1 server(s)
=================================
```

---

## 📖 Command Usage Guide

### 👢 Kick Command
| Trigger | Example | Description |
| :--- | :--- | :--- |
| `kick @user [reason]` | `kick @JohnSpammer Spamming in general chat` | Kicks member with reason |
| `@botname kick @user` | `@MyPowerBot kick @JohnSpammer` | Alternative mention format |

### 🎵 Music Commands
| Trigger | Example | Description |
| :--- | :--- | :--- |
| `@botname <link>` | `@MyPowerBot https://www.youtube.com/watch?v=...` | Plays song or adds to queue |
| `play <query>` | `play lofi beats stream` | Searches & plays YouTube track |
| `@botname skip` | `@MyPowerBot skip` | Skips current playing track |
| `@botname pause` | `@MyPowerBot pause` | Pauses current track |
| `@botname resume` | `@MyPowerBot resume` | Resumes paused track |
| `@botname stop` | `@MyPowerBot stop` | Stops playback & clears queue |

### 👑 Give Power Panel Command
| Trigger | Description |
| :--- | :--- |
| `@botname give power` | Opens interactive UI panel to grant custom power roles |
| `give power` | Alternative unmentioned trigger |

### 🏓 Ping Command
| Trigger | Description |
| :--- | :--- |
| `/ping` | Slash command returning roundtrip latency & WebSocket heartbeat |
| `ping` | Plain text trigger |
| `@botname ping` | Mention trigger |

---

## ⚡ Slash Commands & Active Developer Badge Notice

> [!IMPORTANT]
> **Active Developer Badge Status**:
> Discord officially **decommissioned and retired the Active Developer Badge on December 5, 2025**. All badges were removed from profiles and the badge is no longer claimable at `discord.com/developers/active-developer`. Discord discontinued the program due to support volume and spam bots created solely for badge-hunting.

### How Slash Commands Work in This Bot
Even though the badge has been retired, Slash Commands (Application Commands) are the modern standard for Discord bots!
- **Auto-Registration**: When the bot starts up (`npm start`), it automatically registers all slash commands in `commands/` globally using the Discord REST API.
- **Manual Registration**: You can also register or refresh slash commands at any time without running the full bot client by executing:
  ```bash
  npm run deploy
  ```
- **Permission Scope**: Ensure your bot was invited with both the `bot` AND `applications.commands` OAuth2 scopes so slash commands show up in your server's chat bar.

---

## 📁 Modular Project Structure

```
my-discord-bot/
├── .env                  # Secret environment variables (DISCORD_TOKEN)
├── .env.example          # Environment template
├── index.js              # Client entry point, interaction handler & auto-registration
├── deploy-commands.js    # Standalone slash command registration script
├── package.json          # Dependencies & scripts
├── README.md             # Setup and usage documentation
├── commands/             # Command modules
│   ├── ping.js           # Slash & plain ping latency command
│   ├── kick.js           # Kick moderation logic
│   ├── music.js          # Music play, skip, stop, pause, resume
│   └── givepower.js      # Permission panel UI with select menus & buttons
└── utils/                # Helper utilities
    └── musicQueue.js     # Voice channel queue manager & yt-dlp audio stream
```

---

## ⚙️ Adding New Commands

To add a new command module, create a new `.js` file inside the `commands/` directory.

### Example: Slash Command + Plain Message Command
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  name: 'hello',
  description: 'Replies with Hello!',
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Replies with Hello!'),

  // Slash command handler
  async executeSlash(interaction) {
    await interaction.reply('👋 Hello from slash command!');
  },

  // Message command handler
  async execute(message, args) {
    await message.reply('👋 Hello from message command!');
  }
};
```

The command will be **automatically loaded** and registered by `index.js` on startup!
