
const
    MudHtmlImplementation = require('../MudHtmlImplementation');

class KmudHtmlSupport extends MudHtmlImplementation {
    renderHtml(html) {
        return html;
    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.htmlEnabled = true;
    }
}

module.exports = KmudHtmlSupport;
