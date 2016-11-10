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
    bot.user.setGame(`- silent -`);
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
                    if (arg[0].startsWith("https://www.youtube.com/playlist?list=")) {
                        addPlaylist(arg[0], queue);
                    } else {
                        addQueue(arg[0], queue);
                    }
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
            if (config.masterDJ.indexOf(message.author.id) >= 0) {
                if(playing === true) {
                    dispatcher.end();
                    message.channel.sendMessage("Song skipped. :fast_forward:").then(sent => {sent.delete(5000);});
                } else {
                    message.channel.sendMessage("You can't skip silence! :face_palm: ");
                }
            } else {
                message.channel.sendMessage("You are not authorized to skip a song on demand. Only our benevolent dictators can do that.");
            }
        }

        if (cmd === "voteskip") {
            if(playing === true) {
                if (currentSong.voters.indexOf(message.author.id) < 0) {
                    currentSong.voteskips += 1;
                    currentSong.voters.push(message.author.id);
                    currentSong.votesNeeded = Math.ceil( (message.guild.voiceConnection.channel.members.array().length - 1) / 2 ); // don't count self
                    if (currentSong.voteskips >= currentSong.votesNeeded) {
                        let skippedSong = currentSong;
                        dispatcher.end();
                        message.channel.sendMessage(`${skippedSong.voteskips}/${skippedSong.votesNeeded} votes received. Song will be skipped. :fast_forward:`);
                    } else {
                        message.channel.sendMessage(`${currentSong.voteskips}/${currentSong.votesNeeded} votes received. Need ${currentSong.votesNeeded - currentSong.voteskips} more...`);
                    }
                } else {
                    message.channel.sendMessage(`You already voted! :upside_down:`)
                }
            } else {
                message.channel.sendMessage("You can't skip silence! :face_palm: ");
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
                    setTimeout( () => {sent.edit(`:spades: :diamonds: :clubs: :hearts: :ballot_box_with_check:`).then(sent2 => {sent2.delete(10000)})}, 1000);
                });
            }
        }

        if (cmd === "help") {
            message.author.sendMessage(utils.cmdList());
        }

        if (cmd === "playlist") {
            if (arg[0] === "load") {
                // loading from text file
                try {
                    let textfile = fs.lstatSync(`./playlists/${arg[1]}.txt`);
                    if (textfile.isFile() === true) {
                        var links = fs.readFileSync(`./playlists/${arg[1]}.txt`).toString().split("\r\n");

                        // playing list / adding list
                        if (playing === true) {
                            const filter = inputMsg => message.author.id === inputMsg.author.id;
                            message.channel.sendMessage(`:point_up: This playlist contains ${links.length} songs. Do you wish to add this list to the queue or to override it? (Respond with \`A\`dd or \`O\`verride)`).then(msg => {
                                message.channel.awaitMessages(filter, {max: 1}).then(responses => {
                                    msg.delete();
                                    if(responses.first().content.toLowerCase().startsWith("o") === true) {
                                        queue = [];
                                        dispatcher.end();
                                        addQueue(links[0]);
                                        links.splice(0,1);
                                        addQueueList(links, queue);
                                        message.channel.sendMessage(`Resetting queue and adding ${links.length} songs to the queue...`);
                                    } else if (responses.first().content.toLowerCase().startsWith("a") === true) {
                                        message.channel.sendMessage(`Adding ${links.length} songs to the queue...`);
                                        addQueueList(links, queue);
                                    } else {
                                        message.channel.sendMessage("I don't understand that reply, canceling action. :cold_sweat: ").then(sent => {sent.delete(10000)});;
                                    }
                                });
                            });
                        } else {
                            message.channel.sendMessage(`Adding ${links.length} songs to the queue...`);
                            addQueue(links[0], queue);
                            links.splice(0,1);
                            addQueueList(links, queue);
                        }
                    }
                } catch (err) {
                    if (err.code ===`ENOENT`) {
                        message.channel.sendMessage(`That playlist doesn't exist! Use \`&playlist list\` to see available playlists. :paperclips: `).then(sent => {sent.delete(10000)});;
                    } else {
                        console.log(err);
                    }
                }
            }
        }
    }


    // functions

    function addPlaylist(link, queue) {
        var id = link.slice(38);
        message.channel.sendMessage("Adding playlists is currently not supported. :disappointed: ");
    }

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

    function addQueueList(list, queue) {
        if (list.length > 0) {
            ytdl.getInfo(list[0], function(err, info) {
                try {
                    queue.push({url: list[0], user: message.author, channel: message.channel, title: info.title, length_seconds: info.length_seconds, voteskips: 0, voters: []});
                    utils.consoleLog("queue", `${message.author.username} added ${info.title} to the queue.\n`);
                    list.splice(0,1);
                    addQueueList(list, queue);
                } catch(err) {
    				utils.consoleLog("Error", `The requested link is not a video or is not available. (${err})\n`);
                    list.splice(0,1);
                    addQueueList(list, queue);
    			}
            });
        } else {
            message.channel.sendMessage(`Finished adding your playlist. New queue lenght: \`[${queueLength(queue)}]\``);
        }
    }

    function addQueue(link, queue) {
        ytdl.getInfo(link, function(err, info) {
            try {
                queue.push({url: link, user: message.author, channel: message.channel, title: info.title, length_seconds: info.length_seconds, voteskips: 0, voters: []});
                utils.consoleLog("queue", `${message.author.username} added ${info.title} to the queue.\n`),
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
				message.channel.sendMessage("Either that is not a video, or it is not available where I am. :sob:");
				utils.consoleLog("Error", "The requested link is not a video or is not available.\n");
			}
        });
    }

    function playQueue(voice, queue) {
        ytdl.getInfo(queue[0].url, (err, info) => {
            dispatcher = voice.playStream(ytdl.downloadFromInfo(info, {audioonly: true}), {volume: 0.33});
            currentSong = queue[0];
            currentSongNotif(currentSong, voice);
            dispatcher.on("start", () => {
                playing = true;
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
        });
    }

    function currentSongNotif(song, voice) {
        utils.consoleLog("stream", `Now playing: \n\tSong:    ${song.title} \n\tChannel: ${voice.channel.guild.name} -> ${voice.channel.name} \n\tRequest: #${song.channel.name} -> ${song.user.username}\n`);
        if(currentSongMsg === false) {
            song.channel.sendMessage(`Now playing: (requested by <@${song.user.id}>) \n\`\`\` ${song.title} [${secToMin(song.length_seconds)}] \`\`\` `).then(message => {currentSongMsg = message;});
        } else {
            currentSongMsg.delete();
            song.channel.sendMessage(`Now playing: (requested by <@${song.user.id}>) \n\`\`\` ${song.title} [${secToMin(song.length_seconds)}] \`\`\` `).then(message => {currentSongMsg = message;});
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
            list += `***Playing:*** ${currentSong.title} \`[${secToMin(currentSong.length_seconds)}]\` \`${currentSong.user.username}\`\n\n` ;
        }
        if (queue.length > 0) {
            for ( i = 0; i < queue.length; i++) {
                list += `**${(i+1)}.** ${queue[i].title} \`[${secToMin(queue[i].length_seconds)}]\` \`${queue[i].user.username}\`\n`;
            }
        } else {
            list += `\t(*Empty*)`;
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
