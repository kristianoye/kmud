
class EmoteDaemon extends MUDObject {
    constructor() {
        super();
    }

    create() {
        efuns.restoreObject(__dirname + '/')
    }
}

module.exports = EmoteDaemon;
