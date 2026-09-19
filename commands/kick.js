const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Handles the kick command.
 * Usage: kick @user [reason]
 */
module.exports = {
  name: 'kick',
  description: 'Kicks a member from the server.',
  async execute(message, args) {
    try {
      const { guild, member, author } = message;

      // 1. Check if command author has permission (Kick Members or Administrator or Server Owner)
      const isOwner = guild.ownerId === author.id;
      const hasPermission = isOwner || member.permissions.has(PermissionFlagsBits.KickMembers) || member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        const errEmbed = new EmbedBuilder()
          .setColor('#FF4B4B')
          .setTitle('Permission Denied')
          .setDescription('❌ You need the **Kick Members** or **Administrator** permission to use this command.');
        return message.reply({ embeds: [errEmbed] });
      }

      // 2. Identify target user/member from mentions or args
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        const usageEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('Invalid Usage')
          .setDescription('⚠️ Please mention a user to kick.\n\n**Example:** `kick @user Spamming in chat`');
        return message.reply({ embeds: [usageEmbed] });
      }

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        const notFoundEmbed = new EmbedBuilder()
          .setColor('#FF4B4B')
          .setTitle('User Not Found')
          .setDescription('❌ That user is not a member of this server.');
        return message.reply({ embeds: [notFoundEmbed] });
      }

      // Extract optional reason (everything after mention)
      const reasonIndex = args.findIndex(arg => arg.includes(targetUser.id));
      const reason = reasonIndex !== -1 && args.slice(reasonIndex + 1).length > 0
        ? args.slice(reasonIndex + 1).join(' ')
        : args.filter(arg => !arg.includes(targetUser.id)).join(' ') || 'No reason provided';

      // 3. Guard Checks
      // Cannot kick server owner
      if (targetUser.id === guild.ownerId) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Action Prohibited')
              .setDescription('❌ You cannot kick the server owner!')
          ]
        });
      }

      // Cannot kick the bot itself
      if (targetUser.id === message.client.user.id) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Action Prohibited')
              .setDescription('❌ I cannot kick myself!')
          ]
        });
      }

      // Cannot kick command author
      if (targetUser.id === author.id) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Action Prohibited')
              .setDescription('❌ You cannot kick yourself!')
          ]
        });
      }

      // 4. Check Bot permissions
      const botMember = await guild.members.fetchMe();
      if (!botMember.permissions.has(PermissionFlagsBits.KickMembers) && !botMember.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Bot Missing Permission')
              .setDescription('❌ I lack the **Kick Members** permission required to perform this action.')
          ]
        });
      }

      // 5. Check Role Hierarchy
      // Bot highest role vs Target highest role
      if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Hierarchy Error')
              .setDescription(`❌ I cannot kick **${targetUser.tag}** because their highest role is equal to or higher than my highest role.`)
          ]
        });
      }

      // Author highest role vs Target highest role (unless author is server owner)
      if (!isOwner && member.roles.highest.position <= targetMember.roles.highest.position) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF4B4B')
              .setTitle('Hierarchy Error')
              .setDescription(`❌ You cannot kick **${targetUser.tag}** because their highest role is equal to or higher than your highest role.`)
          ]
        });
      }

      // 6. Perform Kick
      await targetMember.kick(reason);

      // 7. Confirmation Embed
      const confirmEmbed = new EmbedBuilder()
        .setColor('#00FF88')
        .setTitle('👢 Member Kicked')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Kicked Member', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: 'Moderator', value: `${author.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      return message.reply({ embeds: [confirmEmbed] });
    } catch (error) {
      console.error('Error in kick command:', error);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF4B4B')
            .setTitle('Error')
            .setDescription(`❌ Failed to kick member: ${error.message || 'Unknown error'}`)
        ]
      });
    }
  }
};
