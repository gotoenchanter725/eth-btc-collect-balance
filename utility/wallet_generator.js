const ethers = require("ethers");
const CoinKey = require('coinkey');
const Address = require("../models/addressModal");

const walletGenerator = async (_type) => {
    let publicAddress, privateKey, legacyAddress = "";
    let walletCreated;

    if (_type == "ETH" || _type == "USDT") {
        const etherWallet = ethers.Wallet.createRandom();
        publicAddress = etherWallet.address;
        privateKey = etherWallet.privateKey;


    } else if (_type == "BTC") {
        const btcWallet = new CoinKey.createRandom();
        privateKey = btcWallet.privateKey.toString("hex");
        legacyAddress = btcWallet.publicAddress;
        publicAddress = legacyAddress;

    } else {
        return "no case"
    }

    walletCreated = {
        type: _type,
        public: publicAddress,
        private: privateKey,
    }
    const newWallet = await saveDataToDB(walletCreated);
    return newWallet;
}

const saveDataToDB = async (_wallet) => {
    const newWallet = new Address({
        type: _wallet.type,
        public: _wallet.public,
        private: _wallet.private,
    });

    let res = await newWallet.save();
    return res;
}

module.exports = { walletGenerator };