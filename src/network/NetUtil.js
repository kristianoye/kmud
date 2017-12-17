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
     * @param {function} callback The callback for when operation is complete.
     */
    discovery(callback, refresh) {
        let _ifaces = os.networkInterfaces(),
            finished = 0;

        if (this.networks.length > 0 && refresh !== true) {
            return callback(this.networks);
        }
        this.networks = [];

        console.log('\nPerforming network scan ');
        let working = setInterval(function () {
            console.log('.');
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
                    console.log(ifname + ':' + alias, iface.address);
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

        this.networks.sort((a, b) => {
            if (a.address.startsWith('192.')) {
                if (b.address.startsWith('192.'))
                    return a.address < b.address ? -1 : a.address === b.address ? 0 : 1;
                return 2;
            }
            else if (a.address.startsWith('10.')) {
                if (b.address.startsWith('10.'))
                    return a.address < b.address ? -1 : a.address === b.address ? 0 : 1;
                return 1;
            }
            return a.address < b.address ? -1 : a.address === b.address ? 0 : 1;
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
}

module.exports = {
    NetUtil: new NetUtil(),
    NetworkInterface: NetworkInterface
};
