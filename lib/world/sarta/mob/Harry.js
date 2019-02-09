const
    NPC = require('../../../base/NPC');

class Harry extends NPC {
    create() {
        this.title = 'Harry the Affectionate';
        this.name = 'harry';
        this.description = 'Harry the Affectionate looks quite friendly.';
    }

    /**
     * 
     * @param {string} messageType
     * @param {string} message
     */
    receiveMessage(messageType, message) {
        let verb = efuns.queryVerb(),
            verbs = efuns.pluralize(verb),
            name = thisPlayer.displayName;

        if (message.endsWith('.'))
            message = message.slice(0, message.length - 1);

        switch (messageType) {
            case 'secondPerson':
                switch (verb) {
                    case 'smile':
                        efuns.callOut(() => {
                            efuns.command(`smile hap at ${name.toLowerCase()}`);
                        }, 2000);
                        break;

                    default:
                        let x = message.indexOf(verb),
                            s = (x > -1 ? message.slice(x) : message)
                                .replace('you', 'me')
                                .replace(verbs, verb);
                        efuns.command(`say Why did you ${s}, ${name}?`);
                        break;
                }
                break;

            case 'thirdPerson':
                break;
        }
    }
}

module.exports = Harry;
