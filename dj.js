// variable declaration
var discord    = require("discord.js"),
    fs         = require("fs"),
    ytdl       = require('ytdl-core'),
	YouTube    = require('youtube-node'),
	utils      = require("./utilities.js"),
	config     = require("./config.json");

// declaration of bot
var bot = new discord.Client({autoReconnect: true});
var ytsearch = new YouTube();
ytsearch.addParam("type", "video");

var queue = [];
var playing = false;
var currentSong = null;
var currentSongMsg = false;
var dispatcher;
// login
bot.login(config.token);
ytsearch.setKey(config.youtubeDataAPIToken);

// setup
bot.on("ready", function() {
    utils.consoleLog("system", "DJ is ready to operate!\n");
    bot.user.setUsername(config.displayName);
    bot.user.setStatus("online", "- silent -");
});

// command interpreter
bot.on("message", function(message) {
    var arg = message.content.split(" "),
        cmd = message.content.split(" ")[0];
    arg.splice(0,1);

    if (cmd.substring(0, config.prefix.length) === config.prefix) {
        cmd = cmd.substring(config.prefix.length);

        if (cmd === "join") {
            joinVoice();
        }

        if (cmd === "leave") {
            if(message.member.voiceChannel) {
                if (message.member.voiceChannel.connection) {
                    message.member.voiceChannel.leave();
                } else {
                    message.channel.sendMessage("I'm not in your channel, so I can't leave it.");
                }
            }
        }

        if (cmd === "play") {
            if (arg[0]) {
				if (arg[0].startsWith("https://www.youtube.com") || arg[0].startsWith("https://youtu.be")) {
					addQueue(arg[0], queue);
				} else {
					message.channel.sendMessage("That's not a YouTube link silly. :laughing:");
				}
			} else {
				message.channel.sendMessage("You need to provide a YouTube link. :wink:");
			}
        }

        if (cmd === "search") {
            // interpretation of searchterm and amount of results
            var amount = 1
			var searchTerm = "";
			if (isNaN(arg[0]) === false) {
				if (arg[0] <= 5) {
					amount = arg[0];
					arg.splice(0,1);
				} else {
					amount = 5;
					arg.splice(0,1);
				}
			}
			if (arg[0].includes("\"") === true) {
				searchTerm = message.content.slice(message.content.indexOf("\"") + 1);
				if (searchTerm.includes("\"") === true) {
					searchTerm = searchTerm.slice(0, searchTerm.indexOf("\""));
				}
			} else if (arg[0].includes("\'") === true) {
				searchTerm = message.content.slice(message.content.indexOf("\'") + 1);
				if (searchTerm.includes("\'") === true) {
					searchTerm = searchTerm.slice(0, searchTerm.indexOf("\'"));
				}
			} else {
				arg.forEach(arg => {
					searchTerm += `${arg} `;
				});
				searchTerm = searchTerm.slice(0, (searchTerm.length - 1));
			}
			console.log(`Results requested: ${amount}`);
			console.log(`"${searchTerm}"`);
            // youtube searchin'
            ytsearch.search(searchTerm, amount, function(err, results) {
				if (err) {
					console.log(err);
				} else {
                    results.userId = message.author.id;
					confirmResult(results);
				}
			});
        }

        if (cmd === "skip") {
            if(playing === true) {
                dispatcher.end();
                message.channel.sendMessage("Song skipped. :fast_forward:").then(sent => {sent.delete(5000);});
            }
        }

        if (cmd === "pause") {
            if(playing === true) {
                dispatcher.pause();
            }
        }

        if (cmd === "resume") {
            if(playing === true) {
                dispatcher.resume();
            }
        }

        if (cmd === "queue") {
            message.channel.sendMessage(`Here is the current queue. (*${queueLength(queue)}*) \n\n${printQueue(queue)}`);
        }

        if (cmd === "shuffle") {
            if (queue.length > 0) {
                shuffle(queue);
                message.channel.sendMessage(":diamonds: :hearts: :spades: :clubs:").then(sent => {
                    setTimeout( () => {sent.edit(`:clubs: :hearts: :diamonds: :spades: :game_die:`)}, 500);
                    setTimeout( () => {sent.edit(`:spades: :diamonds: :clubs: :hearts: :ballot_box_with_check:`)}, 1000).then(sent2 => {sent2.delete(10000)});
                });
            }
        }

        /*
        if (cmd === "playlist") {
            if (arg[0] === "save") {
                if (queue.length > 0) {
                    if (arg[1]) {
                        let idList = new Array();
                        for(i = 0; i < queue.length; i++) {
                            idList.push({
                                id: queue[i].video_id, title: queue[i].title});
                        }
                        let playList = JSON.stringify(idList);
                        try {
                            let stats = fs.lstatSync(`./playlists/${arg[1]}.json`);
                            if (stats.isFile() === true) {
                                message.channel.sendMessage(`This name is already in use. Please specify a different playlist name. (Using no spaces)`);
                            }
                        } catch (err) {
                            if (err.code ===`ENOENT`) {
                                fs.writeFile(`./playlists/${arg[1]}.json`, playList, err => {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        utils.consoleLog(`Playlist`, `Saved playlist ${arg[1]} containing ${idList.length} songs.`);
                                        message.channel.sendMessage(`Saved the current queue as the playlist \`${arg[1]}\` containing ${idList.length} songs.`);
                                    }
                                });
                            } else {
                                console.log(err);
                            }
                        }
                    } else {
                        message.channel.sendMessage("You must specify a name for your playlist! Keep in mind spaces will not be recognized.");
                    }
                } else {
                    message.channel.sendMessage("There is currently no queue to save!").then(sent => {sent.delete(5000);});
                }
            } else if (arg[0] === "load") {
                try {
                    let stats = fs.lstatSync(`./playlists/${arg[1]}.json`);
                    if (stats.isFile() === true) {
                        let list = require(`./playlists/${arg[1]}.json`);
                        addQueue(`https://youtu.be/${list[0].id}`, queue);
                        setTimeout( () => {
                            for (i = 0; i < list.length; i++) {
                                let id = list[i].id;
                                setTimeout( () => {addQueue(`https://youtu.be/${id}`, queue)}, (i * 1000) );
                            }
                        }, 5000);
                    }
                } catch (err) {
                    if (err.code ===`ENOENT`) {
                        message.channel.sendMessage(`That playlist doesn't exist! Use \`&list\` to see available playlists.`);
                    } else {
                        console.log(err);
                    }
                }
            } else if (arg[0] === "list") {

            } else {
                message.cannel.sendMessage("help:");
            }
        }
        */
    }

    // functions

    function joinVoice() {
        if(message.member.voiceChannel) {
			message.member.voiceChannel.join();
		} else {
			message.channel.sendMessage("You are not in a voice channel :frowning:");
		}
    }

    function confirmResult(results) {
        var linkId = results.items[0].id.videoId;
        const filter = message => message.author.id === results.userId;
        message.channel.sendMessage(`Is this your video? Say \`yes\`/\`no\`/\`cancel\`.\nhttps://youtu.be/${results.items[0].id.videoId}`).then(msg => {
            message.channel.awaitMessages(filter, {max: 1}).then(responses => {
                msg.delete();
                if (responses.first().content.toLowerCase() === "yes" || responses.first().content.toLowerCase() === "y") {
					console.log("yes, stop search");
					addQueue(`https://youtu.be/${results.items[0].id.videoId}`, queue);
					return;
				} else if (responses.first().content.toLowerCase() === "no" || responses.first().content.toLowerCase() === "n") {
					console.log("no, next item if possible");
					results.items.splice(0, 1);
					if (results.items.length > 0) {
						confirmResult(results);
					} else {
						message.channel.sendMessage("Reached end of search results, you picky bastard! :upside_down:").then(sent => {sent.delete(7500)});
						return;
					}
				} else {
					console.log("canceled");
					message.channel.sendMessage("Search canceled. :no_entry_sign:").then(sent => {sent.delete(7500)});
					return;
				}
            });
        });

    }

    function addQueue(link, queue) {
        ytdl.getInfo(link, function(err, info) {
            try {
                info.addedBy = message.author;
                info.reqChannel = message.channel;
                queue.push(info);
                utils.consoleLog("queue", `${info.addedBy.username} added ${info.title} to the queue.\n`);
                message.channel.sendMessage(`Added ${info.title} \`[${secToMin(info.length_seconds)}]\` to the queue.`);
                if(!message.guild.voiceConnection) {
                    // Case 1: no voice conn exists.
                    message.member.voiceChannel.join().then(connection => {
                        playQueue(connection, queue);
                    });
                } else if (message.guild.voiceConnection && playing === false) {
                    // Case 2: voice conn exists, but there is no queue playing.
                    playQueue(message.guild.voiceConnection, queue);
                } else if (message.guild.voiceConnection && playing === true) {
                    // Case 3: voice conn exists, and a queue is already playing.
                    // do nothing
                }
            } catch(err) {
                console.log(err);
				message.channel.sendMessage("Either that is not a video, or it is not available where I am. :sob:");
				utils.consoleLog("Error", "The requested link is not a video or is not available.\n");
			}
        });
    }

    function playQueue(voice, queue) {
        dispatcher = voice.playStream(ytdl.downloadFromInfo(queue[0], {audioonly: true}), {volume: 0.33});
        currentSong = queue[0];
        currentSongNotif(currentSong, voice);
        dispatcher.on("start", () => {
            playing = true;
            bot.user.setStatus("online", queue[0].title);
            queue.splice(0,1);
        });
        dispatcher.on("end", () => {
            if (queue.length > 0) {
                // if the queue still has elements
                playQueue(voice, queue);
            } else {
                if(voice) {
                    voice.channel.leave();
                    bot.user.setStatus("online", "- silent -");
                    currentSong = null;
                    playing = false;
                }
            }
        });

    }

    function currentSongNotif(song, voice) {
        utils.consoleLog("stream", `Now playing: \n\tSong:    ${song.title} \n\tChannel: ${voice.channel.guild.name} -> ${voice.channel.name} \n\tRequest: #${song.reqChannel.name} -> ${song.addedBy.username}\n`);
        if(currentSongMsg === false) {
            song.reqChannel.sendMessage(`Now playing: (requested by <@${song.addedBy.id}>) \n\`\`\` ${song.title} [${secToMin(song.length_seconds)}] \`\`\` `).then(message => {currentSongMsg = message;});
        } else {
            currentSongMsg.delete();
            song.reqChannel.sendMessage(`Now playing: (requested by <@${song.addedBy.id}>) \n\`\`\` ${song.title} [${secToMin(song.length_seconds)}] \`\`\` `).then(message => {currentSongMsg = message;});
        }
    }

    function secToMin(seconds) {
		var min = Math.floor(seconds / 60);
		var sec = Math.round(( (seconds / 60) - min ) * 60);
		if (min < 10) {
			min = "0" + min;
		}
		if (sec < 10) {
			sec = "0" + sec;
		}
		return min + ":" + sec;
	}

    function queueLength(queue) {
		var lengthInSec = 0;
		for ( i = 0; i < queue.length; i++) {
				lengthInSec += Number(queue[i].length_seconds);
		}
		var length = secToMin(lengthInSec);
		return length;
	}

    function printQueue(queue) {
        var list = "";
        if (currentSong !== null) {
            list = `***Playing:*** ${currentSong.title} \`[${secToMin(currentSong.length_seconds)}]\` \`${currentSong.addedBy.username}\`\n\n` ;
        }
        if (queue.length > 0) {
            for ( i = 0; i < queue.length; i++) {
                list += `**${(i+1)}.** ${queue[i].title} \`[${secToMin(queue[i].length_seconds)}]\` \`${queue[i].addedBy.username}\`\n`
            }
        } else {
            list += `\t(*Empty*)`
        }
		return list;
	}

    function shuffle(array) {
	    var j, x, i;
	    for (i = array.length; i; i--) {
	        j = Math.floor(Math.random() * i);
	        x = array[i - 1];
	        array[i - 1] = array[j];
	        array[j] = x;
	    }
	}

});

process.on('uncaughtException', function(err) {
    if (err.code === "ECONNRESET") {
        consoleLog("ERROR", "ECONNRESET :(");
    } else {
        throw err;
    }
});
