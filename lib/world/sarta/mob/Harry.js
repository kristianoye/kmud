const
    NPC = require('../../../base/NPC');

class Harry extends NPC {
    create() {
        this.setShort('Harry the Affectionate')
            .setLong('Harry the Affectionate looks quite friendly.')
            .setPrimaryName('harry')
            .setDisplayName('Harry')
            .setLevel(5);
    }

    /**
     * 
     * @param {string} messageType
     * @param {string} message
     */
    receive_message(messageType, message) {
        let verb = efuns.queryVerb(),
            verbs = efuns.pluralize(verb),
            name = thisPlayer.displayName;

        if (message.endsWith('.'))
            message = message.slice(0, message.length - 1);

        switch (messageType) {
            case 'secondPerson':
                let x = message.indexOf(verb),
                    s = (x > -1 ? message.slice(x) : message)
                        .replace('you', 'me')
                        .replace(verbs, verb);
                efuns.command(`say Why did you ${s}, ${name}?`);
                break;

            case 'thirdPerson':
                break;
        }
    }
}

module.exports = Harry;
