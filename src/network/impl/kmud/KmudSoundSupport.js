const
    MudSoundImplementation = require('../MudSoundImplementation');

class KmudSoundSupport extends MudSoundImplementation {
    playMusic() {

    }

    playSound() {

    }

    /**
     * 
     * @param {Object.<string,boolean>} flags
     */
    updateSupportFlags(flags) {
        flags.soundEnabled = true;
    }
}

module.exports = KmudSoundSupport;


