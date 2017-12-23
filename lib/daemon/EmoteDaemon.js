class EmoteDaemon extends MUDObject {
    create() {
        this.adverbs = [];
        this.emotes = {};
        efuns.restoreObject(__dirname + '/save/EmoteDaemon.json');
    }

    cmd(verb, args) {
        let entry = this.emotes[verb];
        if (entry) {

        }
        return false;
    }

    addAdverb(adverb) {
        let index = this.adverbs.indexOf(adverb)
        if (index === -1) {
            this.adverbs.push(adverb);
            this.save();
        }
    }

    addEmoteRule(verb, rule) {
        let newEmote = false,
            entry = this.emotes[verb] || (newEmote = true, []);

        if (entry.indexOf(rule) === -1)
            entry.push(rule);

        if (newEmote) this.emotes[verb] = entry;
        this.save();
    }

    get adverbs() {
        return this.getProperty('adverbs', []);
    }

    set adverbs(list) {
        this.setProperty('adverbs', list);
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

module.exports = { EmoteDaemon, EmoteEntry };

