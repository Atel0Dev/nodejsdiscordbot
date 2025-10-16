// --- Imports & Setup ---
const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { Client, Events, GatewayIntentBits, Collection } = require("discord.js");

// --- Environment Variables ---
const DISCORD_WEBHOOK_API = process.env.DISCORD_WEBHOOK_API;
const TOKEN = process.env.TOKEN;

// --- Express Keepalive Server ---
const app = express();
app.get("/", (req, res) => {
	res.send(`
		<html>
			<head><title>Status Bot</title></head>
			<body style="font-family:sans-serif;text-align:center;margin-top:50px;">
				<h1>🤖 Server Status Discord Bot</h1>
				<p>Bot is online and connected to Discord!</p>
			</body>
		</html>
	`);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Express server ready on port ${PORT}`));

// --- Discord Client Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// --- Load All Commands ---
const foldersPath = path.join(__dirname, "Commands");
if (!fs.existsSync(foldersPath)) {
	console.warn("⚠️ Commands folder not found at:", foldersPath);
} else {
	const commandFolders = fs.readdirSync(foldersPath);
	for (const folder of commandFolders) {
		const commandsPath = path.join(foldersPath, folder);
		if (!fs.existsSync(commandsPath)) continue;

		const commandFiles = fs
			.readdirSync(commandsPath)
			.filter((file) => file.endsWith(".js"));

		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			try {
				const command = require(filePath);
				if ("data" in command && "execute" in command) {
					client.commands.set(command.data.name, command);
				} else {
					console.log(
						`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
					);
				}
			} catch (err) {
				console.error(`❌ Failed to load command at ${filePath}:`, err);
			}
		}
	}
}

// --- Command Handler ---
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);
	if (!command) {
		console.error(`No command matching ${interaction.commandName} found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		const msg = {
			content: "There was an error executing this command!",
			ephemeral: true,
		};
		if (interaction.replied || interaction.deferred)
			await interaction.followUp(msg);
		else await interaction.reply(msg);
	}
});

// --- Background Render Server Monitor ---
const URL = "https://nodejssignalserver.onrender.com";
let wasUp = true;

async function sendWebhookEmbed({ color, title, description }) {
	if (!DISCORD_WEBHOOK_API)
		return console.warn("⚠️ Missing DISCORD_WEBHOOK_API environment variable");
	try {
		await fetch(DISCORD_WEBHOOK_API, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				embeds: [
					{
						color,
						title,
						description,
						timestamp: new Date(),
						footer: { text: "Render Signal Server Monitor" },
					},
				],
			}),
		});
	} catch (err) {
		console.error("❌ Failed to send webhook:", err);
	}
}

async function checkServer() {
	try {
		const res = await fetch(URL, { method: "HEAD" });
		if (res.ok) {
			console.log(`[OK] Server UP (${res.status})`);
			if (!wasUp) {
				await sendWebhookEmbed({
					color: 0x00ff00,
					title: "🟢 Server Back Online",
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
				title: "🔴 Server is DOWN!",
				description: `Render signal server not responding.\n**Error:** ${err.message}`,
			});
			wasUp = false;
		}
	}
}

// --- Bot Ready Event ---
client.once(Events.ClientReady, async (readyClient) => {
	console.log(`🤖 Ready! Logged in as ${readyClient.user.tag}`);
	console.log("🔍 Starting background server monitor...");

	await sendWebhookEmbed({
		color: 0x3498db,
		title: "🤖 Bot Online",
		description: "Render server monitor is now active.",
	});

	checkServer();
	setInterval(checkServer, 5 * 60 * 1000); // every 5 minutes
});

// --- Start Bot ---
client.login(TOKEN);