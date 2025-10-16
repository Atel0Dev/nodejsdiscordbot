// index.js
const fs = require('fs');
const path = require('path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { token, DISCORD_WEBHOOK_API } = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// --- Load all command files ---
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// --- Command handler ---
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);
	if (!command) return console.error(`No command matching ${interaction.commandName} found.`);
	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		const msg = { content: 'There was an error executing this command!', ephemeral: true };
		if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
		else await interaction.reply(msg);
	}
});

// --- Background Render Server Monitor ---
const URL = 'https://nodejssignalserver.onrender.com';
let wasUp = true;

async function sendWebhookEmbed({ color, title, description }) {
	if (!DISCORD_WEBHOOK_API) return console.warn('⚠️ Missing DISCORD_WEBHOOK_API in config.json');
	try {
		await fetch(DISCORD_WEBHOOK_API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				embeds: [
					{
						color,
						title,
						description,
						timestamp: new Date(),
						footer: { text: 'Render Signal Server Monitor' },
					},
				],
			}),
		});
	} catch (err) {
		console.error('❌ Failed to send webhook:', err);
	}
}

async function checkServer() {
	try {
		const res = await fetch(URL, { method: 'HEAD' });
		if (res.ok) {
			console.log(`[OK] Server UP (${res.status})`);
			if (!wasUp) {
				await sendWebhookEmbed({
					color: 0x00ff00,
					title: '🟢 Server Back Online',
					description: `Render signal server is responding.\n**Status:** ${res.status}`,
				});
				wasUp = true;
			}
		} else throw new Error(`Status ${res.status}`);
	} catch (err) {
		console.log(`[ERROR] Server DOWN: ${err.message}`);
		if (wasUp) {
			await sendWebhookEmbed({
				color: 0xff0000,
				title: '🔴 Server is DOWN!',
				description: `Render signal server not responding.\n**Error:** ${err.message}`,
			});
			wasUp = false;
		}
	}
}

client.once(Events.ClientReady, async (readyClient) => {
	console.log(`✅ Ready! Logged in as ${readyClient.user.tag}`);
	console.log('🔍 Starting background server monitor...');
	await sendWebhookEmbed({
		color: 0x3498db,
		title: '🤖 Bot Online',
		description: 'Render server monitor is now active.',
	});
	checkServer();
	setInterval(checkServer, 5 * 60 * 1000);
});

client.login(token);