class EmoteEntry {
    constructor(data) {
        this.rules = [];
    }
}

class EmoteDaemon extends MUDObject {
    create() {
        this.emotes = {};
        efuns.restoreObject(__dirname + '/save/EmoteDaemon.json');
    }

    cmd(verb, args) {

    }

    get emotes() {
        return this.getProperty('emotes', {});
    }

    set emotes(data) {
        if (typeof data !== 'object') return;
        return this.setProperty('emotes', data);
    }

    save() {
        efuns.saveObject(__dirname + '/save/EmoteDaemon.json')
    }
}

module.exports = EmoteDaemon;
