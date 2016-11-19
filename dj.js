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

var queue = {};
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
                if(queue[message.guild.id]) {
                    if(queue[message.guild.id].playing === true) {
                        queue[message.guild.id].dispatcher.end();
                        message.channel.sendMessage("Song skipped. :fast_forward:").then(sent => {sent.delete(5000);});
                    } else {
                        message.channel.sendMessage("You can't skip silence! :face_palm: ").then(sent => {sent.delete(5000);});
                    }
                }
            } else {
                message.channel.sendMessage("You are not authorized to skip a song on demand. Only our benevolent dictators can do that.").then(sent => {sent.delete(5000);});
            }
        }

        if (cmd === "voteskip") {
            if (queue[message.guild.id]) {
                if(queue[message.guild.id].playing === true) {
                    if (queue[message.guild.id].currentSong.voters.indexOf(message.author.id) < 0) {
                        queue[message.guild.id].currentSong.voteskips += 1;
                        queue[message.guild.id].currentSong.voters.push(message.author.id);
                        queue[message.guild.id].currentSong.votesNeeded = Math.ceil( (message.guild.voiceConnection.channel.members.array().length - 1) / 2 ); // don't count self
                        if (queue[message.guild.id].currentSong.voteskips >= queue[message.guild.id].currentSong.votesNeeded) {
                            let skippedSong = queue[message.guild.id].currentSong;
                            queue[message.guild.id].dispatcher.end();
                            message.channel.sendMessage(`${skippedSong.voteskips}/${skippedSong.votesNeeded} votes received. Song will be skipped. :fast_forward:`).then(sent => {sent.delete(5000);});
                        } else {
                            message.channel.sendMessage(`${queue[message.guild.id].currentSong.voteskips}/${queue[message.guild.id].currentSong.votesNeeded} votes received. Need ${queue[message.guild.id].currentSong.votesNeeded - queue[message.guild.id].currentSong.voteskips} more...`).then(sent => {sent.delete(5000);});
                        }
                    } else {
                        message.channel.sendMessage(`You already voted! :upside_down: ${queue[message.guild.id].currentSong.voteskips}/${queue[message.guild.id].currentSong.votesNeeded} votes received.`).then(sent => {sent.delete(5000);});
                    }
                } else {
                    message.channel.sendMessage("You can't skip silence! :face_palm: ").then(sent => {sent.delete(5000);});
                }
            }
        }

        if (cmd === "pause") {
            if (queue[message.guild.id]) {
                if (queue[message.guild.id].playing === true) {
                    queue[message.guild.id].dispatcher.pause();
                }
            }
        }

        if (cmd === "resume") {
            if (queue[message.guild.id]) {
                if (queue[message.guild.id].playing === true) {
                    queue[message.guild.id].dispatcher.resume();
                }
            }
        }

        if (cmd === "queue") {
            if(queue[message.guild.id]) {
                message.channel.sendMessage(`Here is the current queue. (*${queueLength(queue[message.guild.id].songs)}*) \n\n${printQueue(queue[message.guild.id])}`)
                .then(sent => {sent.delete(50000)});
            } else {
                message.channel.sendMessage("This server has no queue yet.").then(sent => {sent.delete(5000)});
            }
        }

        if (cmd === "clear") {
            if (config.masterDJ.indexOf(message.author.id) >= 0) {
                if (queue[message.guild.id]) {
                    if (queue[message.guild.id].songs.length > 0) {
                        queue[message.guild.id].songs = [];
                    }
                    if (queue[message.guild.id].playing === true) {
                        queue[message.guild.id].dispatcher.end();
                    }
                    message.channel.sendMessage("Queue cleared. :crayon: ");
                }
            } else {
                message.channel.sendMessage("You are not authorized to do that").then(sent => {sent.delete(5000)});
            }
        }

        if (cmd === "shuffle") {
            if(queue[message.guild.id]) {
                if (queue[message.guild.id].songs.length > 0) {
                    shuffle(queue[message.guild.id].songs);
                    message.channel.sendMessage(":diamonds: :hearts: :spades: :clubs:").then(sent => {
                        setTimeout( () => {sent.edit(`:clubs: :hearts: :diamonds: :spades: :game_die:`)}, 500);
                        setTimeout( () => {sent.edit(`:spades: :diamonds: :clubs: :hearts: :ballot_box_with_check:`).then(sent2 => {sent2.delete(10000)})}, 1000);
                    });
                }
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
                        var list = fs.readFileSync(`./playlists/${arg[1]}.txt`).toString();
                        if (list.includes("\r\n")) { // OS = Windows
                            list = list.split("\r\n");
                        } else { // OS = Unix
                            list = list.split("\n");
                        }

                        // playing list / adding list
                        if(!queue.hasOwnProperty(message.guild.id)) {
                            queue[message.guild.id] = {playing: false, songs: [], dispatcher: null, currentSong: null, currentSongMsg: null};
                        }
                        if (queue[message.guild.id].playing === true) {
                            const filter = inputMsg => message.author.id === inputMsg.author.id;
                            message.channel.sendMessage(`:point_up: This playlist contains ${list.length} songs. Do you wish to add this list to the queue or to override it? (Respond with \`A\`dd or \`O\`verride)`).then(msg => {
                                message.channel.awaitMessages(filter, {max: 1}).then(responses => {
                                    msg.delete();
                                    if(responses.first().content.toLowerCase().startsWith("o") === true) {
                                        queue = [];
                                        dispatcher.end();
                                        addQueue(list[0], queue);
                                        list.splice(0,1);
                                        addQueueList(list, queue);
                                        message.channel.sendMessage(`Resetting queue and adding ${list.length} songs to the queue...`).then(sent => {sent.delete(5000);});
                                    } else if (responses.first().content.toLowerCase().startsWith("a") === true) {
                                        message.channel.sendMessage(`Adding ${list.length} songs to the queue...`).then(sent => {sent.delete(5000);});
                                        addQueueList(list, queue);
                                    } else {
                                        message.channel.sendMessage("I don't understand that reply, canceling action. :cold_sweat: ").then(sent => {sent.delete(5000)});;
                                    }
                                });
                            });
                        } else {
                            message.channel.sendMessage(`Adding ${list.length} songs to the queue...`).then(sent => {sent.delete(5000);});
                            addQueue(list[0], queue);
                            list.splice(0,1);
                            addQueueList(list, queue);
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
    message.delete(5000);
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
                    responses.first().delete();
					addQueue(`https://youtu.be/${results.items[0].id.videoId}`, queue);
					return;
				} else if (responses.first().content.toLowerCase() === "no" || responses.first().content.toLowerCase() === "n") {
                    responses.first().delete();
                    results.items.splice(0, 1);
					if (results.items.length > 0) {
						confirmResult(results);
					} else {
						message.channel.sendMessage("Reached end of search results, you picky bastard! :upside_down:").then(sent => {sent.delete(5000)});
						return;
					}
				} else {
					message.channel.sendMessage("Search canceled. :no_entry_sign:").then(sent => {sent.delete(5000)});
					return;
				}
            });
        });

    }

    function addQueueList(list, queue) {
        if (list.length > 0) {
            ytdl.getInfo(list[0], function(err, info) {
                try {
                    if(!queue.hasOwnProperty(message.guild.id)) {
                        queue[message.guild.id] = {playing: false, songs: [], dispatcher: null, currentSong: null, currentSongMsg: null};
                    }
                    queue[message.guild.id].songs.push({url: list[0], user: message.author, channel: message.channel, title: info.title, length_seconds: info.length_seconds, voteskips: 0, voters: []});
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
            message.channel.sendMessage(`Finished adding your playlist. New queue lenght: \`[${queueLength(queue[message.guild.id].songs)}]\``).then(sent => {sent.delete(5000);});
        }
    }

    function addQueue(link, queue) {
        ytdl.getInfo(link, function(err, info) {
            try {
                if(!queue.hasOwnProperty(message.guild.id)) {
                    queue[message.guild.id] = {playing: false, songs: [], dispatcher: null, currentSong: null, currentSongMsg: null};
                }
                queue[message.guild.id].songs.push({url: link, user: message.author, channel: message.channel, title: info.title, length_seconds: info.length_seconds, voteskips: 0, voters: []});
                utils.consoleLog("queue", `${message.author.username} added ${info.title} to the queue.\n`),
                message.channel.sendMessage(`Added ${info.title} \`[${secToMin(info.length_seconds)}]\` to the queue.`).then(sent => {sent.delete(5000);});
                if(!message.guild.voiceConnection) {
                    // Case 1: no voice conn exists.
                    message.member.voiceChannel.join().then(connection => {
                        playQueue(connection, queue[message.guild.id]);
                    });
                } else if (message.guild.voiceConnection && queue[message.guild.id].playing === false) {
                    // Case 2: voice conn exists, but there is no queue playing.
                    playQueue(message.guild.voiceConnection, queue[message.guild.id]);
                } else if (message.guild.voiceConnection && queue[message.guild.id].playing === true) {
                    // Case 3: voice conn exists, and a queue is already playing.
                    // do nothing
                }
            } catch(err) {
				message.channel.sendMessage("Either that is not a video, or it is not available where I am. :sob:");
				utils.consoleLog("Error", "The requested link is not a video or is not available.\n");
			}
        });
    }

    function playQueue(voice, server) {
        ytdl.getInfo(server.songs[0].url, (err, info) => {
            server.dispatcher = voice.playStream(ytdl.downloadFromInfo(info, {audioonly: true}), {volume: 0.33});
            server.currentSong = server.songs[0];
            currentSongNotif(server.currentSong, voice);
            server.dispatcher.on("start", () => {
                server.playing = true;
                server.songs.splice(0,1);
            });
            server.dispatcher.on("end", () => {
                if (server.songs.length > 0) {
                    // if the queue still has elements
                    playQueue(voice, server);
                } else {
                    if(voice) {
                        voice.channel.leave();
                    }
                    server.playing = false;
                    server.currentSong = null;
                    server.currentSongMsg.delete();
                }
            });
        });
    }

    function currentSongNotif(song, voice) {
        utils.consoleLog("stream", `Now playing: \n\tSong:    ${song.title} \n\tChannel: ${voice.channel.guild.name} -> ${voice.channel.name} \n\tRequest: #${song.channel.name} -> ${song.user.username}\n`);
        if(queue[song.channel.guild.id].currentSongMsg === null) {
            song.channel.sendMessage(`Now playing: (requested by <@${song.user.id}>) \n\`\`\` ${song.title} [${secToMin(song.length_seconds)}] \`\`\` `).then(sent => {queue[song.channel.guild.id].currentSongMsg = sent;});
        } else {
            queue[song.channel.guild.id].currentSongMsg.delete();
            song.channel.sendMessage(`Now playing: (requested by <@${song.user.id}>) \n\`\`\` ${song.title} [${secToMin(song.length_seconds)}] \`\`\` `).then(sent => {queue[song.channel.guild.id].currentSongMsg = sent;});
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
        if (queue.currentSong !== null) {
            list += `***Playing:*** ${queue.currentSong.title} \`[${secToMin(queue.currentSong.length_seconds)}]\` \`${queue.currentSong.user.username}\`\n\n` ;
        }
        if (queue.songs.length > 0) {
            for ( i = 0; i < queue.songs.length; i++) {
                list += `**${(i+1)}.** ${queue.songs[i].title} \`[${secToMin(queue.songs[i].length_seconds)}]\` \`${queue.songs[i].user.username}\`\n`;
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
