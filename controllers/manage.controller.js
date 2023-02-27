const { ethers } = require('ethers');
const CryptoAccount = require("send-crypto");
const Address = require("../models/addressModal");
const { manager } = require('../config/const');
const { mathExact } = require('math-exact');
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");
const gasLimit = 21000;

module.exports = {
    balance_withdraw: async function (req, res) {
        try {

            let addresses = await Address.find({});
            console.log(addresses.length);

            let gasFee = 0, gasPrice = 0;

            if (addresses.length) {
                let eth_t = 0, btc_t = 0;
                for (let i = 0; i < addresses.length; i++) {
                    const address = addresses[i];
                    if (address.type == "ETH" || address.type == "USDT") {
                        const balance = ethers.utils.formatEther(await provider.getBalance(address.public));
                        if (balance == 0) continue;
                        address.balance = balance;
                        gasPrice = await getNetworkGasPrice();
                        gasFee = CalcFee(gasPrice);
                        console.log("\n=====ETH:", balance, address.private);
                        console.log("  gasFee:", gasFee);

                        eth_t += Number(balance);
                        if (balance > gasFee * 2) {
                            while (true) {
                                try {
                                    const wallet = new ethers.Wallet(address.private, provider);
                                    gasPrice = await getNetworkGasPrice();
                                    gasFee = CalcFee(gasPrice);
                                    console.log("  gasFee:", gasFee);
                                    let finalBalance = Number(mathExact('Subtract', balance, gasFee)).toFixed(18) + '';
                                    console.log("-----ETH SENDING:", finalBalance)
                                    let txForManagerPercentParams = {
                                        to: manager.ETH,
                                        value: ethers.utils.parseEther(finalBalance),
                                    };
                                    await wallet.sendTransaction({
                                        ...txForManagerPercentParams,
                                        gasLimit: gasLimit,
                                        gasPrice: ethers.utils.parseEther(gasPrice.toFixed(18) + '')
                                    });
                                    break;
                                } catch (e) {
                                    console.log(e.message);
                                    console.log('retry')
                                    continue;
                                }
                            }
                        }
                    } else if (address.type == "BTC") {
                        const account = new CryptoAccount(address.private);
                        const balance = await account.getBalanceInSats("BTC");
                        btc_t += balance / 10 ** 8;
                        address.balance = balance / 10 ** 8;
                        console.log("\n=====BTC:", balance, address.private);
                        if (balance > 15000) {
                            console.log("-----BTC SENDING")
                            while (true) {
                                try {
                                    let tx = await account.sendSats(manager.BTC, Math.floor(balance), "BTC", {
                                        subtractFee: true
                                    });
                                    console.log(tx);
                                    break;
                                } catch (e) {
                                    console.log(e.message);
                                    continue;
                                }
                            }
                        }
                    }
                }
                console.log("ETH: ", eth_t, " BTC: ", btc_t);
                res.status(200).json({
                    message: "success",
                    data: addresses
                });
            } else {
                throw "This address already exists"
            }
            // await gasPriceWEI();
        } catch (err) {
            console.log(err);
            res.status(500).json({
                message: 'Error: ' + err.message
            })
        }
    },

    delete_address: async function (req, res) {
        try {

            let addresses = await Address.find({});
            console.log(addresses.length);

            let gasFee = 0, gasPrice = 0;

            if (addresses.length) {
                let eth_t = 0, btc_t = 0;
                for (let i = 0; i < addresses.length; i++) {
                    const address = addresses[i];
                    if (address.type == "ETH" || address.type == "USDT") {
                        const balance = ethers.utils.formatEther(await provider.getBalance(address.public));
                        if (balance == 0) continue;
                        address.balance = balance;
                        gasPrice = await getNetworkGasPrice();
                        gasFee = CalcFee(gasPrice);
                        console.log("\n=====ETH:", balance, address.private);
                        console.log("  gasFee:", gasFee);

                        eth_t += Number(balance);
                        if (balance < gasFee) {
                            console.log("-----ETH Deleting")
                            await Address.findOneAndDelete({ _id: address._id });
                        }
                    } else if (address.type == "BTC") {
                        const account = new CryptoAccount(address.private);
                        const balance = await account.getBalanceInSats("BTC");
                        btc_t += balance / 10 ** 8;
                        address.balance = balance / 10 ** 8;
                        console.log("\n=====BTC:", balance, address.private);

                        if (balance < 10000) {
                            console.log("-----BTC Deleting")
                            await Address.findOneAndDelete({ _id: address._id });
                        }
                    }
                }
                console.log("ETH: ", eth_t, " BTC: ", btc_t);
                res.status(200).json({
                    message: "success",
                    data: addresses
                });
            } else {
                throw "This address already exists"
            }
        } catch (err) {
            console.log(err);
            res.status(500).json({
                message: 'Error: ' + err.message
            })
        }
    },

    balance_check: async function (req, res) {
        try {

            let addresses = await Address.find({});
            console.log(addresses.length);

            let gasFee = 0, gasPrice = 0;

            if (addresses.length) {
                let eth_t = 0, btc_t = 0;
                for (let i = 0; i < addresses.length; i++) {
                    const address = addresses[i];
                    if (address.type == "ETH" || address.type == "USDT") {
                        const balance = ethers.utils.formatEther(await provider.getBalance(address.public));
                        if (balance == 0) continue;
                        address.balance = balance;
                        gasPrice = await getNetworkGasPrice();
                        gasFee = CalcFee(gasPrice);
                        console.log("\n=====ETH:", balance, address.private);
                        console.log("  gasFee:", gasFee);

                        eth_t += Number(balance);
                    } else if (address.type == "BTC") {
                        const account = new CryptoAccount(address.private);
                        const balance = await account.getBalanceInSats("BTC");
                        btc_t += balance / 10 ** 8;
                        address.balance = balance / 10 ** 8;
                        console.log("\n=====BTC:", balance, address.private);
                    }
                }
                console.log("ETH: ", eth_t, " BTC: ", btc_t);
                if (res) res.status(200).json({
                    message: "success",
                    data: addresses
                });
            } else {
                throw "This address already exists"
            }
        } catch (err) {
            console.log(err);
            if (res) res.status(500).json({
                message: 'Error: ' + err.message
            })
        }
    }
}

const getNetworkGasPrice = async () => {
    return ethers.utils.formatEther(await provider.getGasPrice());
}

const CalcFee = (gasPrice) => {
    return mathExact('Multiply', gasPrice, gasLimit);
}

const gasPriceWEI = async () => {
    let gas = await getNetworkGasPrice();
    let gasFee = mathExact('Multiply', gas, 1.5);
    return ethers.utils.parseEther(((gasFee * gasLimit > 0.0025 ? 0.0024 / gasLimit : gasFee)).toFixed(18) + '');
}