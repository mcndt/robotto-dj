
// declaration of exported functions
var exports = module.exports = {};

// required modules
var config = require("./config.json");

// utility functions
// consoleLog
exports.consoleLog = function(topic, string) {
    topic = "[" + topic.toUpperCase() + "]";
    console.log(topic + " " + string);
}
