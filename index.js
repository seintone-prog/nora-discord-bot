
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Nora Settings
const PREFIXES = ['n ', 'N '];

client.once('ready', () => {
    console.log(`Nora is online as ${client.user.tag}`);

    client.user.setPresence({
        activities: [{
            name: 'Cute Anime Games 🌸',
            type: 0
        }],
        status: 'online'
    });
});

// Message Commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const prefix = PREFIXES.find(p =>
        message.content.startsWith(p)
    );

    if (!prefix) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // HELP COMMAND
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#FFB6D9')
            .setTitle('🌸 Nora - Game Assistant')
            .setDescription(
                'Welcome to Nora Anime Game World!'
            )
            .addFields(
                { name: '🎮 Games', value: 'RPG • Detective • Survival\nPuzzle • Business • Horror' },
                { name: '💰 Economy', value: '`n wallet`\n`n daily`' },
                { name: '👤 Profile', value: '`n profile`' },
                { name: '❓ Help', value: '`n help`' }
            )
            .setFooter({ text: 'Nora Bot • Cute Anime World' });

        return message.reply({ embeds: [embed] });
    }

    // WALLET COMMAND
    if (command === 'wallet') {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 Player Wallet')
            .setDescription(
                `👤 Player: ${message.author.username}\n\n🪙 Coins: 0`
            )
            .setFooter({ text: 'Nora Economy System' });

        return message.reply({ embeds: [embed] });
    }

    // PROFILE COMMAND
    if (command === 'profile') {
        const embed = new EmbedBuilder()
            .setColor('#FFB6D9')
            .setTitle('👤 Player Profile')
            .setDescription(
                `🌸 Player: ${message.author.username}\n⭐ Level: 1\n✨ XP: 0\n🪙 Coins: 0`
            );

        return message.reply({ embeds: [embed] });
    }

    // UNKNOWN COMMAND
    return message.reply(
        '🌸 Unknown command! Type `n help` to see commands.'
    );
});

// Bot Login
client.login(process.env.DISCORD_TOKEN);
