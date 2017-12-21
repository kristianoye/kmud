
class MudPort {
    constructor(data) {
        this.address = typeof data.address === 'string' ? data.address : '0.0.0.0';
        this.enabled = typeof data.enabled === 'boolean' ? data.enabled : true;
        this.port = parseInt(data.port);
        this.type = data.type || 'http';
        this.wizardsOnly = typeof data.wizardsOnly === 'boolean' ? data.wizardsOnly : false;
        this.maxConnections = parseInt(data.maxConnections) || -1; // default to unlimited
    }

    assertValid(index) {
        if (typeof this.port !== 'number')
            throw new Error(`Invalid setting for port entry #${index}; Value must be numeric and not ${typeof index}`);
        if (paseInt(this.port) !== this.port)
            throw new Error(`Invalid setting for port entry #${index}; Value must be integer [${parseInt(this.port)} vs ${this.port}]`);
        if (this.port < 1 || this.port > 65535)
            throw new Error(`Invalid port setting for entry #${index}; Value must be between 1 and 65535 and not ${this.port}`);
    }
}

module.exports = MudPort;
