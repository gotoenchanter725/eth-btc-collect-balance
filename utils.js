const tor_axios = require('tor-axios');
const axios = require('axios');

module.exports = {
    create_tor_axios_instance: function (exchange_api_url) {
        const tor = tor_axios.torSetup({
            ip: '127.0.0.1',
            port: 9050
        });

        const tor_axios_instance = axios.create({
            baseURL: exchange_api_url,
            httpAgent: tor.httpAgent(),
            httpsAgent: tor.httpsAgent(),
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        return tor_axios_instance;
    },

    delay: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
