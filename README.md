# robotto-dj
Just another Discord.js music bot.

## Quick start: ##
Put the files in a convenient location. If you don't have the dependencies yet, navigate to the folder using bash, command prompt, etc and use `npm install`.

Before running the bot, copy `default-config.json` and rename it to **config.json**. Open it and fill in your bot token. You need a YouTube API token to use the search function. A guide to obtaining one can be found [here](https://www.youtube.com/watch?v=Im69kzhpR3I).

Start the bot with dj.bat.

## Features include: ##
 - queue system
 - play youtube link
 - search on youtube
 - shuffle
 - skip
 - pause/resume

## Planned features ##
- voteskipping
- multiserver support
- playlist system
- DJ user (has permissions to skip without voting, etc)

## Depends on the following Node modules: ##
 - discord.js
 - node-opus
 - ytdl-core
 - youtube-node
 (see package.json for versions)
