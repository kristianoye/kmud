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

    receive_message(messageType, message) {
        switch (messageType) {
            case 'secondPerson':
                efuns.command(`say Why did you ${message}?`);
                break;

            case 'thirdPerson':
                break;
        }
    }
}

module.exports = Harry;
