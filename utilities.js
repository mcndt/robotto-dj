
// declaration of exported functions
var exports = module.exports = {};

// required modules
var config  = require("./config.json");
var locale  = require("./locale.json");

// utility functions

// consoleLog
exports.consoleLog = function(topic, string) {
    topic = "[" + topic.toUpperCase() + "]";
    console.log(topic + " " + string);
}

// help command utility
exports.cmdList = function() {
    var cmdList = `I will do these things for attention:\n\n`;

    locale.commands.forEach(entry => {
        cmdList += `\`\`\`html\n<${config.prefix}${entry.cmd}>\n${entry.descr}\`\`\``;
    });

    return cmdList;
}

// get readable uptime
exports.uptime = (client) => {
    var totalMinutes = Math.round(client.uptime / (1000 * 60));
    var hours = Math.floor(totalMinutes / 60);
    var minutes = Math.round(totalMinutes - (hours * 60));
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    return hours + "h" + minutes + "'";
}
