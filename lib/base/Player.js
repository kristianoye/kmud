
MUD.include('Base', 'Daemon', 'Dirs');

MUD.imports(LIB_INTERACTIVE);

class Player extends Interactive {
    /**
     * 
     * @param {MUDCreationContext} ctx
     */
    constructor(ctx) {
        super(ctx);
    }

    connect(client) {
        super.connect(client);
        client.eventSend({
            eventType: 'kmud.connected',
            eventData: this.displayName + '@' + efuns.mudName()
        });
        this.enableHeartbeat(true);
    }

    isPlayer() { return true; }

    isVisible() {
        return this.getProperty('visible', true) !== false;
    }

    save(callback) {
        let PlayerDaemon = efuns.loadObject(DAEMON_PLAYER);
        PlayerDaemon().savePlayer(this, callback);
    }

    get searchPath() {
        let sp = super.searchPath;
        sp.push(DIR_CMDS_PLAYER, DIR_SCMDS_PLAYER);
        return sp;
    }

    getAnswer() { return 42; }

}

MUD.export(Player);
