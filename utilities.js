
// declaration of exported functions
var exports = module.exports = {};

// required modules
var config = require("./config.json");
var locale = require("./locale.json");

// utility functions
// consoleLog
exports.consoleLog = function(topic, string) {
    topic = "[" + topic.toUpperCase() + "]";
    console.log(topic + " " + string);
}

exports.cmdList = function() {
    var cmdList = `I will do these things for attention:\n\n`;

    locale.commands.forEach(entry => {
        cmdList += `\`\`\`html\n<${config.prefix}${entry.cmd}>\n${entry.descr}\`\`\``;
    });

    return cmdList;
}
