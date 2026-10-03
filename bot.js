require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes } = require('discord.js');

const TOKEN = String(process.env.DISCORD_TOKEN || '').trim();
const CLIENT_ID = String(process.env.DISCORD_CLIENT_ID || '').trim();
const GUILD_ID = String(process.env.DISCORD_GUILD_ID || '').trim();
const TICKET_CATEGORY_ID = String(process.env.TICKET_CATEGORY_ID || '').trim();
const REVIEW_CHANNEL_ID = String(process.env.REVIEW_CHANNEL_ID || '').trim();
const STAFF_ROLE_ID = String(process.env.STAFF_ROLE_ID || '').trim();
const FRAGMENT_API_URL = String(process.env.FRAGMENT_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const INTERNAL_API_SECRET = String(process.env.INTERNAL_API_SECRET || '').trim();
const GIFT_CARD_INSTRUCTIONS = String(process.env.GIFT_CARD_INSTRUCTIONS || 'Send a supported gift card and enter its code in the ticket. Staff will verify the gift card manually before approval.');
const CLOSE_AFTER_MS = Math.max(0, Number(process.env.TICKET_CLOSE_DELAY_MS || 8000));
const PRICES = { software: 12, gui: 15, table: 25 };
const NAMES = { software: 'Fragment Software', gui: 'Fragment GUI', table: 'Fragment Table' };
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !REVIEW_CHANNEL_ID || !INTERNAL_API_SECRET) {
  console.error('Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, REVIEW_CHANNEL_ID, or INTERNAL_API_SECRET in .env');
  process.exit(1);
}

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
  catch { return { orders: [] }; }
}
function writeOrders(v) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(v, null, 2)); }
function isStaff(member) {
  return !!member && (member.permissions?.has(PermissionFlagsBits.ManageGuild) || (STAFF_ROLE_ID && member.roles?.cache?.has(STAFF_ROLE_ID)));
}
function productLabel(type) { return `${NAMES[type]} — $${PRICES[type]}`; }
function safeChannelName(username, type) {
  const u = String(username || 'user').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 35) || 'user';
  return `ticket-${u}-${type}`.slice(0, 95);
}

async function issueKey(order) {
  const response = await fetch(`${FRAGMENT_API_URL}/api/internal/issue-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-secret': INTERNAL_API_SECRET },
    body: JSON.stringify({ type: order.product, discordId: order.userId, orderId: order.id })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.key) throw new Error(data.error || 'License generation failed');
  return data.key;
}

async function registerCommands() {
  const commands = [{
    name: 'setup-shop',
    description: 'Post the Fragment ticket purchase panel',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
  }];
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  console.log(`Fragment shop bot logged in as ${client.user.tag}`);
  await registerCommands();
  console.log('Registered /setup-shop');
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-shop') {
      if (!isStaff(interaction.member)) return interaction.reply({ content: 'You need staff permissions to do that.', ephemeral: true });

      const menu = new StringSelectMenuBuilder()
        .setCustomId('fragment:ticket-type')
        .setPlaceholder('Ticket Information')
        .addOptions([
          { label: 'Purchase', description: 'Purchase Fragment Software, GUI, or Table', value: 'purchase' },
          { label: 'Support', description: 'Get help with your Fragment license or account', value: 'support' }
        ]);

      const embed = new EmbedBuilder()
        .setTitle('To create a ticket, select an option below')
        .setDescription('Use the menu below to open a private Fragment ticket.')
        .setColor(0x5865f2)
        .setFooter({ text: 'Fragment • Ticket Information' });

      return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'fragment:ticket-type') {
      if (interaction.values[0] === 'support') {
        const existing = interaction.guild.channels.cache.find(c => c.topic === `fragment-support:${interaction.user.id}`);
        if (existing) return interaction.reply({ content: `You already have an open support ticket: ${existing}`, ephemeral: true });
        const overwrites = [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
        ];
        if (STAFF_ROLE_ID) overwrites.push({ id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
        const channel = await interaction.guild.channels.create({ name: `ticket-${String(interaction.user.username).toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,35)}-support`, type: ChannelType.GuildText, parent: TICKET_CATEGORY_ID || undefined, topic: `fragment-support:${interaction.user.id}`, permissionOverwrites: overwrites });
        const embed = new EmbedBuilder().setTitle('Fragment Support').setDescription(`Welcome ${interaction.user}.\n\nPlease explain what you need help with and a staff member will assist you.`).setColor(0x5865f2).setFooter({ text: 'Fragment • Support' });
        await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [] });
        return interaction.reply({ content: `Your support ticket is ready: ${channel}`, ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('fragment:product')
        .setPlaceholder('Choose a product')
        .addOptions(Object.entries(PRICES).map(([value, price]) => ({ label: NAMES[value], description: `$${price} — create a private purchase ticket`, value })));
      return interaction.reply({ content: 'Choose the Fragment product you want to purchase:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'fragment:product') {
      const type = interaction.values[0];
      if (!PRICES[type]) return interaction.reply({ content: 'Invalid product.', ephemeral: true });
      const existing = interaction.guild.channels.cache.find(c => c.topic === `fragment-ticket:${interaction.user.id}`);
      if (existing) return interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });

      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
      ];
      if (STAFF_ROLE_ID) overwrites.push({ id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

      const channel = await interaction.guild.channels.create({
        name: safeChannelName(interaction.user.username, type),
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID || undefined,
        topic: `fragment-ticket:${interaction.user.id}`,
        permissionOverwrites: overwrites
      });

      const orders = readOrders();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      orders.orders.push({ id, userId: interaction.user.id, username: interaction.user.username, product: type, price: PRICES[type], ticketChannelId: channel.id, status: 'open', createdAt: new Date().toISOString() });
      writeOrders(orders);

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`fragment:giftcard:${id}`).setLabel('Submit Gift Card').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`fragment:cancel:${id}`).setLabel('Cancel Ticket').setStyle(ButtonStyle.Danger)
      );
      const embed = new EmbedBuilder()
        .setTitle(`Order • #${id.slice(-4)}`)
        .addFields(
          { name: 'Product', value: NAMES[type], inline: true },
          { name: 'Payment', value: 'Gift Card', inline: true },
          { name: 'Checkout', value: `Go to [Skine](https://skine.com/en-us/rewarble) and purchase a **$${PRICES[type]} USD** gift card.

Tap **Submit Code** below and paste the gift-card code.
When verified, Fragment will send your license key to your DMs automatically.`, inline: false },
          { name: 'Note', value: GIFT_CARD_INSTRUCTIONS, inline: false }
        )
        .setColor(0x5865f2)
        .setFooter({ text: `Order ${id}` });
      const submitButton = new ButtonBuilder().setCustomId(`fragment:giftcard:${id}`).setLabel('Submit Code').setStyle(ButtonStyle.Primary);
      await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [new ActionRowBuilder().addComponents(submitButton)] });
      return interaction.reply({ content: `Your purchase ticket is ready: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('fragment:giftcard:')) {
      const orderId = interaction.customId.split(':')[2];
      const order = readOrders().orders.find(o => o.id === orderId);
      if (!order || order.userId !== interaction.user.id || order.status !== 'open') return interaction.reply({ content: 'This ticket is no longer active.', ephemeral: true });
      const modal = new ModalBuilder().setCustomId(`fragment:giftcardmodal:${orderId}`).setTitle('Submit Gift Card');
      const code = new TextInputBuilder().setCustomId('giftcard_code').setLabel('Gift card code').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200).setPlaceholder('Enter the code exactly as provided');
      const note = new TextInputBuilder().setCustomId('giftcard_note').setLabel('Optional note').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500);
      modal.addComponents(new ActionRowBuilder().addComponents(code), new ActionRowBuilder().addComponents(note));
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('fragment:giftcardmodal:')) {
      const orderId = interaction.customId.split(':')[2];
      const db = readOrders();
      const order = db.orders.find(o => o.id === orderId);
      if (!order || order.userId !== interaction.user.id || order.status !== 'open') return interaction.reply({ content: 'This ticket is no longer active.', ephemeral: true });
      const code = interaction.fields.getTextInputValue('giftcard_code').trim();
      const note = interaction.fields.getTextInputValue('giftcard_note').trim();
      if (!code) return interaction.reply({ content: 'Gift card code is required.', ephemeral: true });
      order.status = 'awaiting_review';
      order.submittedAt = new Date().toISOString();
      order.note = note;
      order.giftCardCode = code;
      writeOrders(db);

      const review = await client.channels.fetch(REVIEW_CHANNEL_ID);
      if (!review || !review.isTextBased()) throw new Error('Review channel is not available.');
      const approve = new ButtonBuilder().setCustomId(`fragment:approve:${orderId}`).setLabel('Approve & Deliver').setStyle(ButtonStyle.Success);
      const reject = new ButtonBuilder().setCustomId(`fragment:reject:${orderId}`).setLabel('Reject').setStyle(ButtonStyle.Danger);
      const embed = new EmbedBuilder().setTitle('New Fragment Purchase Review').setDescription(`**${NAMES[order.product]}** — **$${order.price}**`).addFields(
        { name: 'Buyer', value: `<@${order.userId}> (${order.username})`, inline: false },
        { name: 'Ticket', value: `<#${order.ticketChannelId}>`, inline: true },
        { name: 'Gift Card Code', value: `\`${code}\``, inline: false },
        { name: 'Note', value: note || 'None', inline: false },
        { name: 'Order ID', value: order.id, inline: false }
      ).setColor(0x5865f2);
      await review.send({ content: STAFF_ROLE_ID ? `<@&${STAFF_ROLE_ID}>` : '@here', embeds: [embed], components: [new ActionRowBuilder().addComponents(approve, reject)] });
      await interaction.reply({ content: 'Submitted. Staff will verify the gift card and approve or reject the order.', ephemeral: true });
      await interaction.channel.send('Payment submitted for staff review. Please wait here until Xako approves it.');
      return;
    }

    if (interaction.isButton() && (interaction.customId.startsWith('fragment:approve:') || interaction.customId.startsWith('fragment:reject:'))) {
      if (!isStaff(interaction.member)) return interaction.reply({ content: 'Staff only.', ephemeral: true });
      const [_, action, orderId] = interaction.customId.split(':');
      const db = readOrders();
      const order = db.orders.find(o => o.id === orderId);
      if (!order || order.status !== 'awaiting_review') return interaction.reply({ content: 'This order has already been handled.', ephemeral: true });

      if (action === 'reject') {
        order.status = 'rejected'; order.reviewedAt = new Date().toISOString(); order.reviewedBy = interaction.user.id; writeOrders(db);
        await interaction.update({ content: `❌ Rejected by ${interaction.user}.`, embeds: interaction.message.embeds, components: [] });
        const ticket = await client.channels.fetch(order.ticketChannelId).catch(() => null);
        if (ticket) await ticket.send('❌ Your payment was rejected by staff. Please contact staff if you believe this was a mistake.');
        return;
      }

      await interaction.deferUpdate();
      try {
        const key = await issueKey(order);
        order.status = 'approved'; order.reviewedAt = new Date().toISOString(); order.reviewedBy = interaction.user.id; order.licenseKey = key; writeOrders(db);
        await interaction.editReply({ content: `✅ Approved by ${interaction.user}. License generated and delivered.`, embeds: interaction.message.embeds, components: [] });
        const user = await client.users.fetch(order.userId);
        const deliveryEmbed = new EmbedBuilder()
          .setTitle('Your Fragment Script order is ready.')
          .setColor(0x5865f2)
          .addFields(
            { name: 'Product', value: NAMES[order.product], inline: false },
            { name: 'License Key', value: `\`${key}\``, inline: false },
            { name: 'Next Steps', value: '1. Go to **https://fragment.lol/**\n2. Sign in or create your Fragment account.\n3. Redeem the license key above.', inline: false }
          )
          .setFooter({ text: 'Fragment • Your license is linked to this Discord purchase.' });
        await user.send({ embeds: [deliveryEmbed] });
        const ticket = await client.channels.fetch(order.ticketChannelId).catch(() => null);
        if (ticket) {
          await ticket.send(`✅ Payment approved. Your **${NAMES[order.product]}** license has been generated. Check your DMs for the key.`);
          if (CLOSE_AFTER_MS >= 0) setTimeout(() => ticket.delete().catch(() => null), CLOSE_AFTER_MS);
        }
      } catch (e) {
        await interaction.editReply({ content: `⚠️ Approval failed: ${e.message}`, embeds: interaction.message.embeds, components: interaction.message.components });
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('fragment:cancel:')) {
      const orderId = interaction.customId.split(':')[2];
      const db = readOrders();
      const order = db.orders.find(o => o.id === orderId);
      if (!order || order.userId !== interaction.user.id) return interaction.reply({ content: 'This is not your ticket.', ephemeral: true });
      order.status = 'cancelled'; writeOrders(db);
      await interaction.reply('Ticket cancelled.');
      setTimeout(() => interaction.channel.delete().catch(() => null), 1500);
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: `Something went wrong: ${err.message}`, ephemeral: true }).catch(() => null);
  }
});

client.login(TOKEN);
