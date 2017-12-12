
class FingerDaemon extends MUDObject
{
    eventIntermud3FingerRequest(username, cb) {
        var result = PlayerDaemon().loadPlayerData(username, function (data) {
            var player = efuns.findPlayer(username);

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

MUD.export(FingerDaemon);

