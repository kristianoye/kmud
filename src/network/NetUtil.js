const
    EventEmitter = require('events'),
    net = require('net'),
    os = require('os');

class NetworkInterface {
    /**
     * 
     * @param networkInfo The details
     * @param networkInfo.address The IP address.
     * @param networkInfo.name The name of the interface.
     */
    constructor(data) {
        /** @type {string} */
        this.address = data.address;

        /** @type {boolean} */
        this.internetAccess = data.hasInternet;

        /** @type {boolean} */
        this.isLocal = data.isLocal;

        /** @type {string} */
        this.name = data.name;
    }
}

class NetUtil extends EventEmitter {
    constructor() {
        super();
        /** @type {NetworkInterface[]} */
        this.networks = [];
    }

    /**
     * Perform network discovery operation.
     * @param {function(NetworkInterface[]):void} callback The callback for when operation is complete.
     * @param {boolean} refresh Flag indicating whether or not cache should be ignored (if true).
     */
    discovery(callback, refresh) {
        let _ifaces = os.networkInterfaces(),
            finished = 0;

        if (this.networks.length > 0 && refresh !== true) {
            return callback(this.networks);
        }
        this.networks = [];

        process.stdout.write('\nPerforming network scan ');

        let working = setInterval(function () {
            process.stdout.write('.');
        }, 500);

        Object.keys(_ifaces).forEach((ifname) => {
            var alias = 0;

            _ifaces[ifname].forEach((iface) => {
                if ('IPv4' !== iface.family) {
                    return;
                }
                else if (iface.internal !== false) {
                    this.networks.push(new NetworkInterface({
                        address: iface.address,
                        isLocal: true,
                        name: ifname
                    }));
                }

                if (alias >= 1) {
                    logger.log(ifname + ':' + alias, iface.address);
                } else {
                    this.networks.push(new NetworkInterface({
                        address: iface.address,
                        isLocal: false,
                        name: ifname
                    }));
                }
                ++alias;
            });
        });

        let privateNetworks = [
            [this.ip4toint('10.0.0.0'), this.ip4toint('10.255.255.255')],
            [this.ip4toint('192.168.0.0'), this.ip4toint('192.168.255.255')],
            [this.ip4toint('172.16.0.0'), this.ip4toint('172.31.255.255')]
        ];

        this.networks.sort((a, b) => {
            let na = this.ip4toint(a), nb = this.ip4toint(b);
            for (let i = 0; i < privateNetworks.length; i++) {
                let [min, max] = privateNetworks[i];

                if (na >= min && na <= max) {
                    if (nb >= min && nb <= max)
                        return na < nb ? -1 : na === nb ? 0 : 1;
                    return i;
                }
            }
            return na < nb ? -1 : na === nb ? 0 : 1;
        });

        this.networks.forEach(network => {
            try {
                let client = net.createConnection({
                    localAddress: network.address,
                    host: '8.8.8.8',
                    port: 53
                }, () => {
                    network.internetAccess = true;
                    client.end();
                    if (++finished === this.networks.length) {
                        clearInterval(working);
                        callback(this.networks);
                    }
                });

                client.on('error', err => {
                    network.internetAccess = false;
                    if (++finished === this.networks.length) {
                        clearInterval(working);
                        callback(this.networks);
                    }
                });
            }
            catch (x) {
                network.internetAccess = false;
                if (++finished === this.networks.length) {
                    clearInterval(working);
                    callback(this.networks);
                }
            }
        });
    }

    /**
     * Attempts to determine which networks have internet access.
     * @returns {Promise<NetworkInterface[]>} All network interfaces on local server.
     */
    async discoveryAsync() {
        return new Promise(async (resolved, failed) => {
            try {
                this.discovery(nets => resolved(nets));
            }
            catch (err) {
                failed('discoveryAsync', err.message);
            }
        });
    }

    /**
     * Convert an IPv4 address to an integer.
     * @param {string|NetworkInterface} ip The ip address.
     * @returns {number} The ip address as an integer.
     */
    ip4toint(ip) {
        if (typeof ip === 'object' && ip.constructor.name === 'NetworkInterface') {
            ip = ip.address;
        }
        try {
            let parts = ip.split('.').map(v => Number.parseInt(v)), r = 0;
            if (parts.length !== 4)
                throw new Error(`Invalid IPv4 address: ${ip}`);
            parts.reverse().forEach((n, i) => {
                if (n < 0 || n > 255)
                    throw new Error(`Octet #${i} is invalid: 0 <= ${n} <= 255`);
                r += (Math.pow(255, i) * n);
            });
            return r;
        }
        catch(x) {
            throw new Error(`Bad IP address ${ip}: ${x.message}`);
        }
    }
}

module.exports = {
    NetUtil: new NetUtil(),
    NetworkInterface: NetworkInterface
};
