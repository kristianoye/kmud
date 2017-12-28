const
    MudHtmlImplementation = require('../MudHtmlImplementation');

/**
 * The MXP protocol allows a subsset of HTML5 so this implementation
 * will have to strip out or substitute elements that are not supported
 * by the client.
 */
class ZmudHtmlImplementation extends MudHtmlImplementation {
    constructor(caps) {
        super(caps);
    }

    init() {
        this.client.writeLine(`<!ELEMENT RoomTitle FLAG='RoomDesc'>`);
        this.client.writeLine(`<!ELEMENT RExits '<FONT COLOR="green">' FLAG='RoomExit'>`);
        this.client.writeLine(`<!ELEMENT Ex '<SEND>'>`);
    }

    renderHtml(text) {
        return text;
    }

    updateFlags(flags) {
        flags.html = true;
        flags.clientPrompt = true;
        return this;
    }
}

module.exports = ZmudHtmlImplementation;
