// --- deploycommands.cjs ---
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

// --- Environment Variables ---
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// --- Prepare Commands Array ---
const commands = [];

// --- Load Commands ---
const foldersPath = path.join(__dirname, "Commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath).default || require(filePath);

		if ("data" in command && "execute" in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(
				`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
			);
		}
	}
}

// --- Discord REST API Client ---
const rest = new REST().setToken(token);

// --- Deploy Commands ---
(async () => {
	try {
		console.log(`🚀 Started refreshing ${commands.length} application (/) commands...`);

		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands }
		);

		console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error("❌ Deployment failed:", error);
	}
})();