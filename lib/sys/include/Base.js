const
    { DIR_BASE, DIR_SLIB } = require('./Dirs');

module.exports = Object.freeze({
    Body: DIR_BASE + '/Body',
    Command: DIR_BASE + '/Command',
    Container: DIR_BASE + '/Container',
    Creator: DIR_BASE + '/Creator',
    Interactive: DIR_BASE + '/Interactive',
    Living: DIR_BASE + '/Living',
    Login: DIR_SLIB + '/Login',
    Monster: DIR_BASE + '/Monster',
    NPC: DIR_BASE + + '/NPC',
    GameObject: DIR_BASE + '/GameObject',
    Player: DIR_BASE + '/Player',
    Room: DIR_BASE + '/Room',
    Verb: DIR_BASE + '/Verb',
    Weapon: DIR_BASE + '/Weapon'
});
