import { LIB_NPC } from '@Base';
import NPC from LIB_NPC;

export default class Harry extends NPC {
    override create() {
        super.create();
        this.shortDesc = 'Harry the Affectionate';
        this.name = 'harry';
        this.setKeyId('harry');
        this.setCapName('Harry');
        this.idList = ['harry', 'man'];
        this.adjectives =  ['friendly', 'affectionate'];
        this.longDesc = 'Harry the Affectionate looks quite friendly.';
        this.gender = 'male';
    }

    /**
     * 
     * @param {string} messageType
     * @param {string} message
     */
    receiveMessage(messageType, message) {
        let verb = efuns.queryVerb(),
            verbs = efuns.pluralize(verb),
            name = thisPlayer().displayName;

        if (message.endsWith('.'))
            message = message.slice(0, message.length - 1);

        switch (messageType) {
            case 'secondPerson':
                switch (verb) {
                    case 'smile':
                        setTimeout(async () => {
                            await efuns.command(`smile hap at ${name.toLowerCase()}`);
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
