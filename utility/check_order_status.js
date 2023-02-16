const { create_tor_axios_instance } = require('../utils');
const tor_axios = create_tor_axios_instance('https://exch.cx/api');

const checkOrderStatus = async (_orderId) => {
    let orderStatus;

    while (true) {
        orderStatus = await tor_axios.get(`/order?orderid=${_orderId}`);
        try {
            console.log("Order Status=>", orderStatus.data.from_addr, _orderId);
            if (orderStatus?.data.from_addr !== "_GENERATING_") {
                break;
            }
        } catch (e) {
            console.log(e.message ? e.message : 'Error');
            break;
        }
    }
    return orderStatus;
}

module.exports = { checkOrderStatus };