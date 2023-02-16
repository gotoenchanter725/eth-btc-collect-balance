const getTxHashID = async (_address) => {
    let txID = "";
    const address = _address.toLowerCase();
    const txAPIEndpoint = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=MKDMVE9XYCKF6KU2QFK4ZCUT6IBKZ8M9PR`;
    const txHistory = await fetch(txAPIEndpoint).then(res => res.json());
    if (txHistory.message == "OK" && txHistory.result.length > 0) {
        txHistory.result.filter(tx => {
            console.log(tx.to);
            if ((tx.to).toLowerCase() == address) {
                txID = tx.hash;
            }
        })
    }
    return txID;
}

module.exports = { getTxHashID };