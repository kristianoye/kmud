include('Daemon');

var _cache = {},
    CommandDaemon = efuns.loadObject(DAEMON_COMMAND);

class HelpSystem extends MUDObject {
    getHelp(topic, category, player) {
        var cmd = CommandDaemon().resolve(topic, player.searchPath),
            self = this;

        if (cmd) {
            return cmd().getHelp();
        }
    }

    /**
        * 
        * @param {any} topic
        * @param {any} category
        * @param {any} player
        */
    getHelpForPlayer(topic, category, player) {
        var cmd = CommandDaemon().resolve(topic, player.searchPath),
            showHtml = player.hasBrowser,
            self = this;

        if (cmd) {
            var help = cmd().getHelp();
            if (!help)
                return 'There is no help available for ' + topic;
            if (showHtml) {
                player.client.registerCallback('helpQuery', function (data) {
                    var result = self.getHelp(data.eventData, false, this);
                    this.eventSend({
                        eventType: 'helpText',
                        eventData: result,
                        eventTarget: data.eventTarget
                    });
                });
                player.eventSend({ eventType: 'helpText', eventData: help });
            }
            else {

            }
            return true;
        }
    }
}

MUD.export(HelpSystem);
