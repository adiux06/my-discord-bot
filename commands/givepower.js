const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

// Map of user-friendly permission labels to PermissionFlagsBits keys
const PERMISSION_OPTIONS_SET1 = [
  { label: 'Kick Members', value: 'KickMembers', description: 'Allows kicking members from the server' },
  { label: 'Ban Members', value: 'BanMembers', description: 'Allows banning members from the server' },
  { label: 'Manage Server', value: 'ManageGuild', description: 'Allows editing server name and settings' },
  { label: 'Manage Roles', value: 'ManageRoles', description: 'Allows creating and editing roles below bot' },
  { label: 'Manage Channels', value: 'ManageChannels', description: 'Allows creating, editing, and deleting channels' },
  { label: 'Manage Messages', value: 'ManageMessages', description: 'Allows deleting and pinning messages' },
  { label: 'Manage Nicknames', value: 'ManageNicknames', description: 'Allows changing nicknames of other members' },
  { label: 'Manage Webhooks', value: 'ManageWebhooks', description: 'Allows creating and editing webhooks' },
  { label: 'Manage Events', value: 'ManageEvents', description: 'Allows creating and editing server events' },
  { label: 'View Audit Log', value: 'ViewAuditLog', description: 'Allows viewing server audit logs' },
  { label: 'Timeout Members', value: 'ModerateMembers', description: 'Allows placing members in timeout' },
  { label: 'Administrator', value: 'Administrator', description: 'Grants all permissions implicitly' },
];

const PERMISSION_OPTIONS_SET2 = [
  { label: 'Send Messages', value: 'SendMessages', description: 'Allows sending messages in channels' },
  { label: 'Embed Links', value: 'EmbedLinks', description: 'Allows links to display rich previews' },
  { label: 'Attach Files', value: 'AttachFiles', description: 'Allows uploading images and files' },
  { label: 'Add Reactions', value: 'AddReactions', description: 'Allows adding new emoji reactions' },
  { label: 'Mention Everyone', value: 'MentionEveryone', description: 'Allows using @everyone and @here' },
  { label: 'Use External Emojis', value: 'UseExternalEmojis', description: 'Allows using custom emojis from other servers' },
  { label: 'Connect (Voice)', value: 'Connect', description: 'Allows joining voice channels' },
  { label: 'Speak (Voice)', value: 'Speak', description: 'Allows speaking in voice channels' },
  { label: 'Mute Members (Voice)', value: 'MuteMembers', description: 'Allows muting members in voice channels' },
  { label: 'Deafen Members (Voice)', value: 'DeafenMembers', description: 'Allows deafening members in voice channels' },
  { label: 'Move Members (Voice)', value: 'MoveMembers', description: 'Allows moving members between voice channels' },
  { label: 'Priority Speaker', value: 'PrioritySpeaker', description: 'Allows being heard more clearly in voice' },
];

module.exports = {
  name: 'givepower',
  description: 'Interactive permission panel to grant custom power roles to server members.',
  async execute(message) {
    try {
      const { guild, member, author } = message;

      // 1. Author permissions check: Only Server Owner or Administrators can use it
      const isOwner = guild.ownerId === author.id;
      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Permission Denied')
              .setDescription('❌ Only the **Server Owner** or members with **Administrator** permission can use this panel.')
          ]
        });
      }

      // 2. Bot permissions check: Bot needs ManageRoles permission
      const botMember = await guild.members.fetchMe();
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Bot Missing Permission')
              .setDescription('❌ I lack the **Manage Roles** permission required to create or assign power roles.')
          ]
        });
      }

      // State tracking for panel selections
      let selectedTargetUser = null;
      let selectedPermissions = new Set();

      // Helper to build panel UI components
      const buildComponents = (disabled = false) => {
        // User Select Menu
        const userSelect = new UserSelectMenuBuilder()
          .setCustomId(`givepower_user_${message.id}`)
          .setPlaceholder(selectedTargetUser ? `Selected Member: ${selectedTargetUser.username}` : 'Step 1: Select a server member...')
          .setMinValues(1)
          .setMaxValues(1)
          .setDisabled(disabled);

        // Permission Select Menu 1
        const permSelect1 = new StringSelectMenuBuilder()
          .setCustomId(`givepower_perms1_${message.id}`)
          .setPlaceholder('Step 2a: Moderation & Admin Permissions...')
          .setMinValues(0)
          .setMaxValues(PERMISSION_OPTIONS_SET1.length)
          .addOptions(PERMISSION_OPTIONS_SET1.map(opt => ({
            ...opt,
            default: selectedPermissions.has(opt.value)
          })))
          .setDisabled(disabled);

        // Permission Select Menu 2
        const permSelect2 = new StringSelectMenuBuilder()
          .setCustomId(`givepower_perms2_${message.id}`)
          .setPlaceholder('Step 2b: Text, Voice & Interaction Permissions...')
          .setMinValues(0)
          .setMaxValues(PERMISSION_OPTIONS_SET2.length)
          .addOptions(PERMISSION_OPTIONS_SET2.map(opt => ({
            ...opt,
            default: selectedPermissions.has(opt.value)
          })))
          .setDisabled(disabled);

        // Action Row with Buttons
        const confirmBtn = new ButtonBuilder()
          .setCustomId(`givepower_confirm_${message.id}`)
          .setLabel('Confirm & Assign Power Role')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👑')
          .setDisabled(disabled || !selectedTargetUser || selectedPermissions.size === 0);

        const cancelBtn = new ButtonBuilder()
          .setCustomId(`givepower_cancel_${message.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled);

        return [
          new ActionRowBuilder().addComponents(userSelect),
          new ActionRowBuilder().addComponents(permSelect1),
          new ActionRowBuilder().addComponents(permSelect2),
          new ActionRowBuilder().addComponents(confirmBtn, cancelBtn)
        ];
      };

      // Helper to generate current status Embed
      const buildPanelEmbed = () => {
        const permList = Array.from(selectedPermissions).map(p => `• \`${p}\``).join('\n') || '*None selected yet*';
        
        return new EmbedBuilder()
          .setColor('#7289DA')
          .setTitle('⚡ Give Power - Permission Panel')
          .setDescription('Grant custom permissions to a server member by configuring the selections below.')
          .addFields(
            {
              name: '👤 Selected Target Member',
              value: selectedTargetUser ? `${selectedTargetUser.tag} (\`${selectedTargetUser.id}\`)` : '❌ *No member selected*',
              inline: false
            },
            {
              name: `🛡️ Selected Permissions (${selectedPermissions.size})`,
              value: permList,
              inline: false
            }
          )
          .setFooter({ text: 'This panel will expire in 2 minutes.' })
          .setTimestamp();
      };

      // Send initial Panel message
      const panelMessage = await message.reply({
        embeds: [buildPanelEmbed()],
        components: buildComponents()
      });

      // Collector for interactions (2-minute timeout)
      const collector = panelMessage.createMessageComponentCollector({
        time: 120_000
      });

      collector.on('collect', async (i) => {
        // Enforce Author-only interaction
        if (i.user.id !== author.id) {
          return i.reply({
            content: '❌ Only the person who opened this permission panel can interact with it.',
            ephemeral: true
          });
        }

        const customId = i.customId;

        // 1. Handle User Selection
        if (customId === `givepower_user_${message.id}`) {
          const selectedUserId = i.values[0];
          try {
            selectedTargetUser = await message.client.users.fetch(selectedUserId);
          } catch (err) {
            selectedTargetUser = null;
          }
          await i.update({
            embeds: [buildPanelEmbed()],
            components: buildComponents()
          });
        }
        // 2. Handle Permission Menu 1
        else if (customId === `givepower_perms1_${message.id}`) {
          // Remove all set 1 perms first, then add current values
          PERMISSION_OPTIONS_SET1.forEach(opt => selectedPermissions.delete(opt.value));
          i.values.forEach(v => selectedPermissions.add(v));

          await i.update({
            embeds: [buildPanelEmbed()],
            components: buildComponents()
          });
        }
        // 3. Handle Permission Menu 2
        else if (customId === `givepower_perms2_${message.id}`) {
          // Remove all set 2 perms first, then add current values
          PERMISSION_OPTIONS_SET2.forEach(opt => selectedPermissions.delete(opt.value));
          i.values.forEach(v => selectedPermissions.add(v));

          await i.update({
            embeds: [buildPanelEmbed()],
            components: buildComponents()
          });
        }
        // 4. Handle Cancel Button
        else if (customId === `givepower_cancel_${message.id}`) {
          collector.stop('cancelled');
          const cancelEmbed = new EmbedBuilder()
            .setColor('#FF4B4B')
            .setTitle('Panel Canceled')
            .setDescription('❌ Give Power operation was canceled.');

          await i.update({
            embeds: [cancelEmbed],
            components: buildComponents(true)
          });
        }
        // 5. Handle Confirm Button
        else if (customId === `givepower_confirm_${message.id}`) {
          await i.deferUpdate();

          // Validate target member exists in guild
          const targetMember = await guild.members.fetch(selectedTargetUser.id).catch(() => null);
          if (!targetMember) {
            const errEmbed = new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Member Error')
              .setDescription('❌ Selected user is no longer in the server.');
            return i.followUp({ embeds: [errEmbed], ephemeral: true });
          }

          // Check Bot Permissions vs Requested Permissions
          const missingBotPerms = [];
          const botHasAdmin = botMember.permissions.has(PermissionFlagsBits.Administrator);

          for (const permKey of selectedPermissions) {
            const flag = PermissionFlagsBits[permKey];
            if (flag && !botHasAdmin && !botMember.permissions.has(flag)) {
              missingBotPerms.push(permKey);
            }
          }

          if (missingBotPerms.length > 0) {
            const errEmbed = new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Bot Missing Requested Permissions')
              .setDescription(`❌ I cannot grant permissions that I do not possess myself:\n${missingBotPerms.map(p => `• \`${p}\``).join('\n')}`);
            return i.followUp({ embeds: [errEmbed], ephemeral: true });
          }

          // Create array of BigInt flags to apply
          const bitFlags = Array.from(selectedPermissions).map(p => PermissionFlagsBits[p]);

          // Role Name convention: Power-<username>
          const roleName = `Power-${selectedTargetUser.username}`;

          // Check if role already exists in guild
          let powerRole = guild.roles.cache.find(r => r.name === roleName);

          if (powerRole) {
            // Check role hierarchy: bot must be strictly higher than existing role
            if (botMember.roles.highest.position <= powerRole.position) {
              const errEmbed = new EmbedBuilder()
                .setColor('#FF4B4B')
                .setTitle('Role Hierarchy Error')
                .setDescription(`❌ Cannot edit role **${roleName}** because it is positioned higher than or equal to my highest role.`);
              return i.followUp({ embeds: [errEmbed], ephemeral: true });
            }

            // Update existing role permissions
            await powerRole.setPermissions(bitFlags, `Updated by GivePower command by ${author.tag}`);
          } else {
            // Create new role below bot's highest role
            powerRole = await guild.roles.create({
              name: roleName,
              permissions: bitFlags,
              color: 0x9B59B6, // Purple highlight
              reason: `Created by GivePower command by ${author.tag}`
            });
          }

          // Assign role to member if they don't already have it
          if (!targetMember.roles.cache.has(powerRole.id)) {
            await targetMember.roles.add(powerRole, `Assigned by GivePower command by ${author.tag}`);
          }

          collector.stop('completed');

          // Summary Embed
          const summaryEmbed = new EmbedBuilder()
            .setColor('#00FF88')
            .setTitle('👑 Power Granted Successfully')
            .setThumbnail(selectedTargetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(`Successfully created/updated role **${roleName}** and assigned it to **${selectedTargetUser.tag}**.`)
            .addFields(
              { name: 'Target Member', value: `${selectedTargetUser.tag} (\`${selectedTargetUser.id}\`)`, inline: true },
              { name: 'Assigned Role', value: `${powerRole}`, inline: true },
              { name: 'Granted Permissions', value: Array.from(selectedPermissions).map(p => `• \`${p}\``).join('\n'), inline: false }
            )
            .setFooter({ text: `Action executed by ${author.tag}` })
            .setTimestamp();

          await panelMessage.edit({
            embeds: [summaryEmbed],
            components: buildComponents(true)
          });
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#888888')
            .setTitle('⌛ Panel Expired')
            .setDescription('This permission panel timed out after 2 minutes of inactivity.');

          await panelMessage.edit({
            embeds: [timeoutEmbed],
            components: buildComponents(true)
          }).catch(() => {});
        }
      });

    } catch (error) {
      console.error('Error in givepower command:', error);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setTitle('Error')
            .setDescription(`❌ Failed to process Give Power command: ${error.message || 'Unknown error'}`)
        ]
      });
    }
  }
};
