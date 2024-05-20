import { DIR_BASE, DIR_SLIB } from './Dirs';

export const
    LIB_ARGPARSER = DIR_BASE + '/ArgParser',
    LIB_ARMOR = DIR_BASE + '/Armor',
    LIB_BODY = DIR_BASE + '/Body',
    LIB_CHARCLASS = DIR_BASE + '/CharacterClass',
    LIB_COMMAND = DIR_BASE + '/Command',
    LIB_CONTAINER = DIR_BASE + '/Container',
    LIB_CREATOR = DIR_BASE + '/Creator',
    LIB_INTERACTIVE = DIR_BASE + '/Interactive',
    LIB_LIVING = DIR_BASE + '/Living',
    LIB_MONSTER = DIR_BASE + '/Monster',
    LIB_NPC = DIR_BASE + '/NPC',
    LIB_OBJECT = DIR_BASE + '/GameObject',
    LIB_PLAYER = DIR_BASE + '/Player',
    LIB_ROOM = DIR_BASE + '/Room',
    LIB_SHELLCMD = DIR_BASE + '/ShellCommand',
    LIB_VERB = DIR_BASE + '/Verb',
    LIB_WEAPON = DIR_BASE + '/Weapon';
    
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
    ShellObject: DIR_BASE + '/ShellObject',
    Verb: DIR_BASE + '/Verb',
    Weapon: DIR_BASE + '/Weapon'
});
