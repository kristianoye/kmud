/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
class FingerDaemon
{
    eventIntermud3FingerRequest(username, cb) {
        let result = PlayerDaemon().loadPlayerData(username, function (data) {
            let player = efuns.living.findPlayer(username);

            data.linkState = 'logged out';
            data.idleTime = -1;
            data.displayTitle = (data.title || '$N the newbie').replace('$N', data.name);
            if (player) {
                data.idleTime = Math.round(player.idleTime / 1000);
                data.linkState = player.connected ? 'connected' : 'link-dead';
            }
            cb(data);
        });
    }
}

module.exports = await createAsync(FingerDaemon);

