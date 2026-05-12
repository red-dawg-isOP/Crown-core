require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const cron = require("node-cron");

const config = require("./config.json");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let data = require("./activityData.json");
let wins = require("./winners.json");

function saveData() {
    fs.writeFileSync("./activityData.json", JSON.stringify(data, null, 2));
}

function saveWins() {
    fs.writeFileSync("./winners.json", JSON.stringify(wins, null, 2));
}

/* ---------------------------
   ROLE CHECK HELPERS
----------------------------*/

function hasRole(member, roles) {
    return roles.some(role => member.roles.cache.has(role));
}

/* ---------------------------
   MESSAGE TRACKING (FIXED)
   STAFF OVERRIDES MEMBER
----------------------------*/

client.on("messageCreate", async message => {

    if (message.author.bot) return;
    if (!message.guild) return;

    const member = message.member;

    const isStaff = hasRole(member, config.staffRoles);
    const isMember = hasRole(member, config.memberRoles);

    // 🔥 PRIORITY RULE: STAFF ONLY
    if (isStaff) {

        if (!data.staff[member.id]) {
            data.staff[member.id] = 0;
        }

        data.staff[member.id]++;

        saveData();
        return;
    }

    // 👤 MEMBER ONLY IF NOT STAFF
    if (isMember) {

        if (!data.members[member.id]) {
            data.members[member.id] = 0;
        }

        data.members[member.id]++;

        saveData();
    }
});

/* ---------------------------
   GET TOP USER FUNCTION
----------------------------*/

function getTop(category) {

    let highest = 0;
    let winner = null;

    for (const id in data[category]) {

        if (data[category][id] > highest) {
            highest = data[category][id];
            winner = id;
        }
    }

    return {
        id: winner,
        messages: highest
    };
}

/* ---------------------------
   WEEKLY SYSTEM (SUNDAY)
----------------------------*/

cron.schedule("0 12 * * 0", async () => {

    const guild = await client.guilds.fetch(config.guildId);
    await guild.members.fetch();

    const awardsChannel =
        guild.channels.cache.get(config.announcementChannelId);

    const hallChannel =
        guild.channels.cache.get(config.hallOfFameChannelId);

    const memberRole =
        guild.roles.cache.get(config.memberWinnerRole);

    const staffRole =
        guild.roles.cache.get(config.staffWinnerRole);

    /* ---------------------------
       REMOVE OLD WINNERS
    ----------------------------*/

    for (const member of memberRole.members.values()) {
        await member.roles.remove(memberRole);
    }

    for (const member of staffRole.members.values()) {
        await member.roles.remove(staffRole);
    }

    /* ---------------------------
       FIND WINNERS
    ----------------------------*/

    const memberWinner = getTop("members");
    const staffWinner = getTop("staff");

    if (!memberWinner.id || !staffWinner.id) return;

    const memberUser = await guild.members.fetch(memberWinner.id);
    const staffUser = await guild.members.fetch(staffWinner.id);

    await memberUser.roles.add(memberRole);
    await staffUser.roles.add(staffRole);

    /* ---------------------------
       WIN TRACKING
    ----------------------------*/

    wins.memberWins[memberWinner.id] =
        (wins.memberWins[memberWinner.id] || 0) + 1;

    wins.staffWins[staffWinner.id] =
        (wins.staffWins[staffWinner.id] || 0) + 1;

    saveWins();

    /* ---------------------------
       PREMIUM AWARDS EMBED
    ----------------------------*/

    const awardsEmbed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({
            name: "Weekly Excellence Awards",
            iconURL: guild.iconURL()
        })
        .setThumbnail(guild.iconURL())
        .setDescription(`
✨━━━━━━━━━━━━━━━━━━✨

👑 **MEMBER OF THE WEEK**
<@${memberWinner.id}>

💬 Messages: **${memberWinner.messages}**
🏆 Wins: **${wins.memberWins[memberWinner.id]}**

━━━━━━━━━━━━━━━━━━

🛡️ **STAFF OF THE WEEK**
<@${staffWinner.id}>

💬 Messages: **${staffWinner.messages}**
🏆 Wins: **${wins.staffWins[staffWinner.id]}**

✨━━━━━━━━━━━━━━━━━━✨
`)
        .setFooter({
            text: "Community Excellence System"
        })
        .setTimestamp();

    await awardsChannel.send({
        content: `<@${memberWinner.id}> <@${staffWinner.id}>`,
        embeds: [awardsEmbed]
    });

    /* ---------------------------
       HALL OF FAME
    ----------------------------*/

    const hallEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
            name: "Hall of Fame",
            iconURL: guild.iconURL()
        })
        .setDescription(`
🏛️ **Weekly Champions**

👑 Member:
<@${memberWinner.id}>

🛡️ Staff:
<@${staffWinner.id}>
`)
        .setTimestamp();

    await hallChannel.send({
        embeds: [hallEmbed]
    });

    /* ---------------------------
       RESET DATA
    ----------------------------*/

    data = {
        members: {},
        staff: {}
    };

    saveData();
});

/* ---------------------------
   BOT READY
----------------------------*/

client.once("ready", () => {
    console.log(`${client.user.tag} is online.`);

    client.user.setPresence({
        activities: [
            {
                name: "https://discord.gg/KWAMGXQrNm",
                type: 1, // Streaming
                url: "https://discord.gg/KWAMGXQrNm"
            }
        ],
        status: "online"
    });
});

client.login(process.env.BOT_TOKEN);