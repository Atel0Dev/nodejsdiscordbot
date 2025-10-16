const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const URL = "https://nodejssignalserver.onrender.com";

module.exports = {
	data: new SlashCommandBuilder()
		.setName("checkserver")
		.setDescription("Checks if the Render signal server is online"),

	async execute(interaction) {
		await interaction.deferReply();
		try {
			const res = await fetch(URL, { method: "HEAD" });
			if (res.ok) {
				const embed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle("🟢 Server Status: Online")
					.setDescription(
						`**Status:** ${res.status}\n✅ Server is responding normally.`,
					)
					.setTimestamp();
				await interaction.editReply({ embeds: [embed] });
			} else {
				throw new Error(`Status ${res.status}`);
			}
		} catch (err) {
			const embed = new EmbedBuilder()
				.setColor(0xff0000)
				.setTitle("🔴 Server Status: Offline")
				.setDescription(`❌ **Error:** ${err.message}`)
				.setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		}
	},
};
