
MUD.include('Base', 'Daemon');

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
        var PlayerDaemon = efuns.loadObject(DAEMON_PLAYER);
        PlayerDaemon().savePlayer(this, callback);
    }
}

MUD.export(Player);
