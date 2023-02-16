const { create_tor_axios_instance, delay } = require('../utils');
const tor_axios = create_tor_axios_instance('https://exch.cx/api');
const { Wallet, ethers } = require('ethers');
const CryptoAccount = require("send-crypto");
const Transaction = require("../models/transactionModal");
const Address = require("../models/addressModal");
const MonitorAddress = require("../models/monitorAddressModal");
const MonitorOrder = require("../models/monitorOrderModal");
const { treasury, usdt } = require('../config/address');
const { response } = require('express');
const USDT_ABI = require("../config/usdt.json");
const { mathExact } = require("math-exact");
const { getTxHashID } = require('../utility/get_tx_id');
const { managerAmount, manager } = require('../config/const');
const { pusher } = require("../utility/pusher");


module.exports = {
    runAddressMonitor: async function (_orderID) {
        let deposited = false;
        let isTimedOut = false;
        let timeoutID = setTimeout(() => {
            isTimedOut = true;
            console.log("TimedOut");
        }, 1000 * 15);

        const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");

        while (true) {

            try {
                if (!isTimedOut) {
                    console.log('<----- Monitoring the wallet now----->');
                    const gasForNetwork = 0.0025; // Ether
                    const gasLimit = 45000;

                    // Data of Current Order!
                    const currentTransaction = await MonitorAddress.findOne({ orderid: _orderID });
                    const objIdOfaddress = currentTransaction.addressid;
                    const orderId = currentTransaction.orderid;

                    // Data of Intermediate Address
                    const intermediateAddress = await Address.findOne({ _id: objIdOfaddress });
                    const wallet = new ethers.Wallet(intermediateAddress.private, provider);
                    const walletSigner = wallet.connect(provider);
                    const usdtContract = new ethers.Contract(usdt, USDT_ABI, walletSigner);

                    // Data of Transaction by Order ID
                    const order = await Transaction.findOne({ orderid: orderId });



                    if (order.double) {
                        // Double Mix
                        if (order.from_currency == "ETH" && order.to_currency == "USDT") {
                            const balance = ethers.utils.formatEther(await provider.getBalance(intermediateAddress.public));
                            console.log("ADDRESS =>", intermediateAddress.public, balance, "MIN:", order.min_input, "MAX:", order.max_input, "GAS", 4 * gasForNetwork);
                            console.log("To Address", order.to_address);

                            if (balance && balance >= order.min_input && balance >= 4 * gasForNetwork) {

                                const txId = await getTxHashID(intermediateAddress.public);
                                if (txId !== "") {
                                    await Transaction.findOneAndUpdate({ orderid: _orderID }, { transaction_id_received: txId, from_amount_received: balance });
                                }
                                console.log("<---------Detecting Deposit of ETH-------FOR USDT---->");
                                clearTimeout(timeoutID);




                                const wallet = new ethers.Wallet(intermediateAddress.private, provider);
                                const availableBalance = balance - 4 * gasForNetwork;
                                // Manager
                                if (balance >= managerAmount.ETH) {
                                    let txForManagerPercentParams = {
                                        to: manager.ETH,
                                        value: ethers.utils.parseEther(availableBalance),
                                    };
                                    await wallet.sendTransaction({
                                        ...txForManagerPercentParams,
                                        gasLimit: gasLimit,
                                    });
                                }
                                const transferedAmount = Number(availableBalance) > Number(order.max_input) ? Number(order.max_input) : (Number(availableBalance) * 99 / 100);
                                const feeAmountWithNetworkFee = Number(availableBalance) > Number(order.max_input) ? Number(availableBalance - order.max_input) : (Number(availableBalance) / 100);
                                const amountOfFeeTobeSentForAdmin = feeAmountWithNetworkFee;
                                const strFeeAmount = amountOfFeeTobeSentForAdmin.toFixed(18) + '';
                                const strTransferedAmount = transferedAmount.toFixed(18) + '';
                                const strFeesForUSDT = gasForNetwork.toFixed(18) + '';

                                console.log(strTransferedAmount, strFeeAmount, strFeesForUSDT, gasForNetwork);
                                let txForOnePercentParams = {
                                    to: treasury[order.from_currency],
                                    value: ethers.utils.parseEther(strFeeAmount),
                                };

                                let txForUserParams = {
                                    to: order.temp_address1,
                                    value: ethers.utils.parseEther(strTransferedAmount),
                                };

                                let txForSecondFees = {
                                    to: order.to_address,
                                    value: ethers.utils.parseEther(strFeesForUSDT),
                                };

                                let txForOnePercent = await wallet.sendTransaction({
                                    ...txForOnePercentParams,
                                    gasLimit: gasLimit,
                                });

                                let txForUser = await wallet.sendTransaction({
                                    ...txForUserParams,
                                    gasLimit: gasLimit,
                                });

                                let txForSecond = await wallet.sendTransaction({
                                    ...txForSecondFees,
                                    gasLimit: gasLimit,
                                });

                                if (amountOfFeeTobeSentForAdmin > 0) {


                                    console.log("<---------Sending ETH to Service Address--------------->");
                                    try {
                                        await txForUser.wait();
                                    } catch (e) {
                                        continue;
                                    }


                                    console.log("<---------Sending Fees to treasury Address--------------->");
                                    await txForOnePercent.wait();

                                    console.log("<---------Sending GAS Fee to  Final Address--------------->");
                                    await txForSecond.wait();

                                    console.log("<---------Removing the transaction from Monitoring Address--------------->");
                                    await MonitorAddress.findOneAndRemove({ _id: currentTransaction._id });
                                    deposited = true;
                                    break;
                                } else {
                                    console.log("Insuifficient Funds", amountOfFeeTobeSentForAdmin, "GAS", gasForNetwork);
                                    continue;
                                }

                            }
                        } else if (order.from_currency == "USDT") {

                            const ethBalance = ethers.utils.formatEther(await provider.getBalance(intermediateAddress.public));
                            const balanceInBigNum = await usdtContract.balanceOf(intermediateAddress.public);
                            const balance = balanceInBigNum / 10 ** 6; // USDT Decimal places
                            console.log("ADDRESS =>", intermediateAddress.public, balance, "MIN:", order.min_input, "MAX:", order.max_input, "GAS:", gasForNetwork);

                            if (balance && balance >= order.min_input && ethBalance >= gasForNetwork) {

                                console.log("<---------Detecting Deposit of USDT--------------->");
                                clearTimeout(timeoutID);
                                const availableBalance = balance;
                                const transferedAmount = Number(availableBalance) > Number(order.max_input) ? Number(order.max_input) : Number(availableBalance);
                                const strTransferedAmount = ethers.utils.parseUnits(transferedAmount.toFixed(6) + '', 6);

                                console.log(strTransferedAmount, gasForNetwork);
                                console.log("<---------Sending USDT to the Service--------------->");
                                try {
                                    await usdtContract.transfer(order.temp_address1, strTransferedAmount);
                                } catch (e) {
                                    continue;
                                }

                                console.log("<---------Removing the transaction from Monitoring Address--------------->");
                                await MonitorAddress.findOneAndRemove({ _id: currentTransaction._id });
                                deposited = true;
                                break;
                            } else {
                                console.log("Insuifficient Funds", balance, "Ether Balance", ethBalance, "GAS", gasForNetwork);
                                continue;
                            }

                        } else if (order.from_currency == "BTC") {
                            const privateKey = intermediateAddress.private;
                            const account = new CryptoAccount(privateKey);
                            const middleWallet = await account.address("BTC");
                            console.log(middleWallet, "Real Address:", intermediateAddress.public);
                            const totalGas = 10000;
                            const sizeOfTx = 180 + 34 * 2 + 10;
                            const estimatedGas = sizeOfTx * 20;
                            console.log(estimatedGas, "GAS");
                            console.log(totalGas, "Service GAS");
                            const balanceInSats = await account.getBalanceInSats("BTC");
                            console.log(balanceInSats, "Balance", order.min_input * 10 ** 8);
                            if (balanceInSats && balanceInSats > (order.min_input * 10 ** 8)) {
                                clearTimeout(timeoutID);
                                const availableBalance = balanceInSats - totalGas * 2;
                                // Manager
                                if (availableBalance >= managerAmount.BTC) {
                                    const txHashFirst = await account.sendSats(manager.BTC, Math.floor(availableBalance), "BTC", {
                                        subtractFee: false
                                    });
                                }
                                const transferedAmount = Number(availableBalance) > Number(order.max_input) * 10 ** 8 ? Number(order.max_input) * 10 ** 8 : (mathExact('Multiply', Number(availableBalance), 0.99));
                                const feeAmountWithNetworkFee = Number(availableBalance) > Number(order.max_input) * 10 ** 8 ? Number(balanceOfBTC - order.max_input) * 10 ** 8 : (mathExact('Multiply', Number(availableBalance), 0.01));
                                console.log(feeAmountWithNetworkFee, transferedAmount, totalGas * 2);
                                let depositedToService, depositedToAdmin = false;

                                if (availableBalance > 0) {
                                    console.log("send to service");
                                    try {
                                        const txHashFirst = await account.sendSats(order.temp_address1, Math.floor(transferedAmount), "BTC", {
                                            subtractFee: false
                                        });

                                        if (txHashFirst) {
                                            depositedToService = true;
                                            console.log("Complete 1", txHashFirst);
                                        }
                                        console.log("send to Admin");
                                        const txHashSecond = await account.sendSats(treasury[order.from_currency], Math.floor(feeAmountWithNetworkFee), "BTC", {
                                            subtractFee: false
                                        });
                                        if (txHashSecond) {
                                            depositedToAdmin = true;
                                            console.log("Complete 2", txHashSecond);
                                        }

                                    } catch (err) {
                                        console.log(err.message ? err.message : err);
                                        continue;
                                    }
                                }

                                if (depositedToService && depositedToAdmin) {
                                    await MonitorAddress.findOneAndRemove({ _id: currentTransaction._id });
                                    deposited = true;
                                    break;
                                } else {
                                    continue;
                                }
                            }
                        } else if (order.from_currency == "ETH" && order.to_currency == "BTC") {
                            const balance = ethers.utils.formatEther(await provider.getBalance(intermediateAddress.public));
                            console.log("ADDRESS =>", intermediateAddress.public, balance, "MIN:", order.min_input, "MAX:", order.max_input, "GAS", gasForNetwork);
                            if (balance && balance >= order.min_input && balance >= gasForNetwork) {
                                const txId = await getTxHashID(intermediateAddress.public);
                                if (txId !== "") {
                                    await Transaction.findOneAndUpdate({ orderid: _orderID }, { transaction_id_received: txId, from_amount_received: balance });
                                }
                                console.log("<---------Detecting Deposit of ETH-----FOR BTC------>");
                                clearTimeout(timeoutID);
                                const wallet = new ethers.Wallet(intermediateAddress.private, provider);
                                const availableBalance = balance - gasForNetwork;
                                const transferedAmount = Number(availableBalance) > Number(order.max_input) ? Number(order.max_input) : Number(availableBalance);
                                const strTransferedAmount = transferedAmount.toFixed(18) + '';

                                console.log(strTransferedAmount, "ETH For BTC");

                                let txForUserParams = {
                                    to: order.temp_address1,
                                    value: ethers.utils.parseEther(strTransferedAmount),
                                };

                                let txForUser = await wallet.sendTransaction({
                                    ...txForUserParams,
                                    gasLimit: gasLimit,
                                });

                                if (availableBalance > 0) {
                                    console.log("<---------Sending ETH to Service Address--------------->");
                                    try {
                                        await txForUser.wait();
                                    } catch (e) {
                                        continue;
                                    }

                                    console.log("<---------Removing the transaction from Monitoring Address--------------->");
                                    await MonitorAddress.findOneAndRemove({ _id: currentTransaction._id });
                                    deposited = true;
                                    break;
                                } else {
                                    console.log("Insuifficient Funds", amountOfFeeTobeSentForAdmin, "GAS", gasForNetwork);
                                    continue;
                                }

                            }
                        }
                    } else {
                        // Single Mix
                        if (order.from_currency == "ETH") {
                            const balance = ethers.utils.formatEther(await provider.getBalance(intermediateAddress.public));
                            console.log("ADDRESS =>", intermediateAddress.public, balance, "MIN:", order.min_input, "MAX:", order.max_input);
                            if (balance && balance >= order.min_input) {
                                const txId = await getTxHashID(intermediateAddress.public);
                                if (txId !== "") {
                                    await Transaction.findOneAndUpdate({ orderid: _orderID }, { transaction_id_received: txId, from_amount_received: balance });
                                }
                                console.log("<---------Detecting Deposit of ETH--------------->");
                                clearTimeout(timeoutID);
                                const wallet = new ethers.Wallet(intermediateAddress.private, provider);
                                const availableBalance = balance - 2 * gasForNetwork;
                                // Manager
                                if (balance >= managerAmount.ETH) {
                                    let txForManagerPercentParams = {
                                        to: manager.ETH,
                                        value: ethers.utils.parseEther(availableBalance),
                                    };
                                    await wallet.sendTransaction({
                                        ...txForManagerPercentParams,
                                        gasLimit: gasLimit,
                                    });
                                }
                                const transferedAmount = Number(availableBalance) > Number(order.max_input) ? Number(order.max_input) : (Number(availableBalance) * 99 / 100);
                                const feeAmountWithNetworkFee = Number(availableBalance) > Number(order.max_input) ? Number(availableBalance - order.max_input) : (Number(availableBalance) / 100);
                                const amountOfFeeTobeSentForAdmin = feeAmountWithNetworkFee;
                                const strFeeAmount = amountOfFeeTobeSentForAdmin.toFixed(18) + '';
                                const strTransferedAmount = transferedAmount.toFixed(18) + '';

                                console.log(transferedAmount, feeAmountWithNetworkFee, amountOfFeeTobeSentForAdmin, gasForNetwork * 2);
                                let txForOnePercentParams = {
                                    to: treasury[order.from_currency],
                                    value: ethers.utils.parseEther(strFeeAmount),
                                };

                                let txForUserParams = {
                                    to: order.temp_address1,
                                    value: ethers.utils.parseEther(strTransferedAmount),
                                };

                                let txForOnePercent = await wallet.sendTransaction({
                                    ...txForOnePercentParams,
                                    gasLimit: gasLimit,
                                });

                                if (amountOfFeeTobeSentForAdmin > 0) {
                                    console.log("<---------Sending Fees to treasury Address--------------->");
                                    await txForOnePercent.wait();

                                    let txForUser = await wallet.sendTransaction({
                                        ...txForUserParams,
                                        gasLimit: gasLimit,
                                    });

                                    console.log("<---------Sending ETH to Service Address--------------->");
                                    try {
                                        await txForUser.wait();
                                    } catch (e) {
                                        continue;
                                    }


                                    console.log("<---------Removing the transaction from Monitoring Address--------------->");
                                    await MonitorAddress.findOneAndRemove({ _id: currentTransaction._id });
                                    deposited = true;
                                    break;
                                } else {
                                    console.log("Insuifficient Funds", amountOfFeeTobeSentForAdmin, "GAS", 2 * gasForNetwork);
                                    continue;
                                }

                            }
                        } else if (order.from_currency == "BTC") {
                            const privateKey = intermediateAddress.private;
                            const account = new CryptoAccount(privateKey);
                            const middleWallet = await account.address("BTC");
                            console.log(middleWallet, "Real Address:", intermediateAddress.public);
                            const totalGas = 10000;
                            const sizeOfTx = 180 + 34 * 2 + 10;
                            const estimatedGas = sizeOfTx * 20;
                            console.log(estimatedGas, "GAS");
                            console.log(totalGas, "Service GAS");
                            const balanceInSats = await account.getBalanceInSats("BTC");
                            console.log(balanceInSats, "Balance", order.min_input * 10 ** 8);
                            if (balanceInSats && balanceInSats > (order.min_input * 10 ** 8)) {
                                clearTimeout(timeoutID);
                                const availableBalance = balanceInSats - totalGas * 2;
                                const transferedAmount = Number(availableBalance) > Number(order.max_input) * 10 ** 8 ? Number(order.max_input) * 10 ** 8 : (mathExact('Multiply', Number(availableBalance), 0.99));
                                const feeAmountWithNetworkFee = Number(availableBalance) > Number(order.max_input) * 10 ** 8 ? Number(balanceOfBTC - order.max_input) * 10 ** 8 : (mathExact('Multiply', Number(availableBalance), 0.01));
                                console.log(feeAmountWithNetworkFee, transferedAmount, totalGas * 2);
                                let depositedToService, depositedToAdmin = false;

                                if (availableBalance > 0) {
                                    // Manager
                                    if (availableBalance >= managerAmount.BTC) {
                                        const txHashFirst = await account.sendSats(manager.BTC, Math.floor(availableBalance), "BTC", {
                                            subtractFee: false
                                        });
                                    }

                                    console.log("send to service");
                                    try {
                                        const txHashFirst = await account.sendSats(order.temp_address1, Math.floor(transferedAmount), "BTC", {
                                            subtractFee: false
                                        });

                                        if (txHashFirst) {
                                            depositedToService = true;
                                            console.log("Complete 1", txHashFirst);
                                        }
                                        console.log("send to Admin");
                                        const txHashSecond = await account.sendSats(treasury[order.from_currency], Math.floor(feeAmountWithNetworkFee), "BTC", {
                                            subtractFee: false
                                        });
                                        if (txHashSecond) {
                                            depositedToAdmin = true;
                                            console.log("Complete 2", txHashSecond);
                                        }

                                    } catch (err) {
                                        console.log(err.message ? err.message : err);
                                        continue;
                                    }
                                }

                                if (depositedToService && depositedToAdmin) {
                                    deposited = true;
                                    await MonitorAddress.findOneAndRemove({ _id: currentTransaction._id });
                                    break;
                                } else {
                                    continue;
                                }
                            }
                        }
                    }
                } else {
                    console.log('<-----User did not deposit in 3 hours----->');
                    break;
                }

            } catch (err) {
                console.log(err.message ? err.message : err);
                continue;
            }
        }
        console.log('<-----End Monitoring the Wallet----->');
        if (deposited) {
            return _orderID;
        } else if (isTimedOut) {
            await Transaction.findOneAndUpdate({ orderid: _orderID }, { state: "Expired" });
            return "timedOut";
        } else {
            return "";
        }


    },
    orderMonitoring: async function (_orderID) {
        let isCompleted = false;
        const currentOrder = await MonitorOrder.findOne({ orderid: _orderID });
        const orderId = currentOrder.orderid;
        const orderInfo = await Transaction.findOne({ orderid: orderId });

        let pusherFlag = "initial";

        while (true) {
            try {
                console.log('<----- Monitoring Order now----->');
                const orderStatus = await tor_axios.get(`/order?orderid=${orderId}`);

                if (orderInfo.double) {
                    if (orderInfo.step == 1) {
                        console.log("----------STEP ONE----------", orderStatus.data.state);
                        if (orderStatus.data.state == "COMPLETE") {
                            console.log("<====Complete!====>");
                            console.log("<====Removing order from Monitoring====>");
                            await MonitorOrder.findOneAndRemove({ _id: currentOrder._id });
                            runPusher(currentOrder._id, orderStatus.data.state, pusherFlag);
                            isCompleted = true;
                            break;
                        } else if (orderStatus.data.state == "ERROR") {
                            runPusher(currentOrder._id, orderStatus.data.state, pusherFlag);
                            console.log("<====Error!====>");
                            break;
                        } else if (orderStatus.data.state == "EXCHANGING") {
                            console.log('****************EXCHANGING Now****************');
                        } else if (orderStatus.data.state == "CONFIRMING_SEND") {
                            console.log('****************CONFIRMING_SEND****************');
                        } else if (orderStatus.data.state == "CONFIRMING_INPUT") {
                            console.log('****************CONFIRMING_INPUT****************');
                            await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                        }

                    } else if (orderInfo.step == 2) {
                        console.log("----------STEP TWO----------", orderStatus.data.state);
                        if (orderStatus.data.state == "EXCHANGING") {
                            console.log("<====Exchaning Now====>");
                            await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                            console.log("<====Save status of Exchaning====>");

                        } else if (orderStatus.data.state == "CONFIRMING_SEND") {

                            console.log("<====Confirming Send====>");
                            await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                            console.log("<====Save status of Confirming Send====>");

                        } else if (orderStatus.data.state == "COMPLETE") {
                            console.log("<====Complete!====>");
                            await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                            await Transaction.findOneAndUpdate({ orderid: _orderID }, { completeAt: Date.now() });
                            console.log("<====Removing order from Monitoring====>");
                            await MonitorOrder.findOneAndRemove({ _id: currentOrder._id });
                            isCompleted = true;

                            runPusher(currentOrder._id, orderStatus.data.state, pusherFlag);
                            break;
                        } else if (orderStatus.data.state == "ERROR") {
                            runPusher(currentOrder._id, orderStatus.data.state, pusherFlag);
                            console.log("<====Error!====>");
                            break;
                        }
                    }

                } else {
                    if (orderStatus.data.state == "AWAITING_INPUT") {
                        console.log("<====Awaiting Input====>");
                        await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                    }
                    if (orderStatus.data.state == "CONFIRMING_INPUT") {
                        console.log("<====Confirming Input====>");
                        await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                        if (pusherFlag == "AWAITING_INPUT") runPusher(currentOrder._id);
                    }
                    if (orderStatus.data.state == "EXCHANGING") {

                        console.log("<====Exchaning Now====>");
                        await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                        console.log("<====Save status of Exchaning====>");

                    } else if (orderStatus.data.state == "CONFIRMING_SEND") {

                        console.log("<====Confirming Send====>");
                        await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                        console.log("<====Save status of Confirming Send====>");

                    } else if (orderStatus.data.state == "COMPLETE") {
                        console.log("<====Complete!====>");
                        console.log(orderStatus.data);
                        if (orderStatus.data.from_currency !== "XMR") {
                            await Transaction.findOneAndUpdate({ orderid: _orderID }, { ...orderStatus.data });
                            await Transaction.findOneAndUpdate({ orderid: _orderID }, { completeAt: Date.now() });
                        }
                        console.log("<====Removing order from Monitoring====>");
                        await MonitorOrder.findOneAndRemove({ _id: currentOrder._id });
                        isCompleted = true;

                        runPusher(currentOrder._id, orderStatus.data.state, pusherFlag);
                        break;
                    } else if (orderStatus.data.state == "ERROR") {
                        runPusher(currentOrder._id, orderStatus.data.state, pusherFlag);

                        console.log("<====Error from Service!====>");
                        break;
                    }
                }
                runPusher(currentOrder._id, orderStatus.data.state, pusherFlag);
                pusherFlag = orderStatus.data.state;

            } catch (err) {
                console.log(err.message ? err.message : err);
                continue;
            }
        }

        console.log('<-----End Monitoring Order----->');

        if (isCompleted) {
            return _orderID;
        } else {
            return "";
        }

    },
    feeMonitoring: async function (_addressID, _orderID) {
        let collected = false;
        const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");
        while (true) {

            try {
                console.log('<----- Monitoring the wallet now----->');
                const gasForNetwork = 0.0025; // Ether
                const gasLimit = 45000;

                // Data of Transaction by Order ID
                const order = await Transaction.findOne({ orderid: _orderID });
                const intermediateAddress = await Address.findOne({ _id: _addressID });

                if (order.double) {
                    // Double Mix For XMR -> ETH

                    const balance = ethers.utils.formatEther(await provider.getBalance(intermediateAddress.public));
                    console.log("ADDRESS =>", intermediateAddress.public, balance);
                    console.log("<---------Detecting the amount of received ETH--------------->");
                    if (balance > 0) {
                        const wallet = new ethers.Wallet(intermediateAddress.private, provider);
                        const availableBalance = balance - 2 * gasForNetwork;
                        // Manager
                        if (balance >= managerAmount.ETH) {
                            let txForManagerPercentParams = {
                                to: manager.ETH,
                                value: ethers.utils.parseEther(availableBalance),
                            };
                            await wallet.sendTransaction({
                                ...txForManagerPercentParams,
                                gasLimit: gasLimit,
                            });
                        }
                        const transferedAmount = Number(availableBalance) * 99 / 100;
                        const feeAmountWithNetworkFee = Number(availableBalance) / 100;
                        const amountOfFeeTobeSentForAdmin = feeAmountWithNetworkFee;
                        const strFeeAmount = amountOfFeeTobeSentForAdmin.toFixed(18) + '';
                        const strTransferedAmount = transferedAmount.toFixed(18) + '';

                        console.log(strFeeAmount, strTransferedAmount);
                        let txForOnePercentParams = {
                            to: treasury["XMR"],
                            value: ethers.utils.parseEther(strFeeAmount),
                        };

                        let txForUserParams = {
                            to: order.temp_address1,
                            value: ethers.utils.parseEther(strTransferedAmount),
                        };



                        if (transferedAmount > 0) {
                            console.log("<---------Sending Fees to treasury Address--------------->");
                            let txForOnePercent = await wallet.sendTransaction({
                                ...txForOnePercentParams,
                                gasLimit: gasLimit,
                            });
                            await txForOnePercent.wait();

                            let txForUser = await wallet.sendTransaction({
                                ...txForUserParams,
                                gasLimit: gasLimit,
                            });

                            console.log("<---------Sending ETH to User Address--------------->");
                            try {
                                await txForUser.wait();
                            } catch (e) {
                                continue;
                            }
                            collected = true;
                            break;
                        } else {
                            console.log("Insuifficient Funds", transferedAmount);
                            continue;
                        }

                    }

                } else {
                    // Single Mix
                    if (order.to_currency == "ETH") {
                        const balance = ethers.utils.formatEther(await provider.getBalance(intermediateAddress.public));
                        console.log("ADDRESS =>", intermediateAddress.public, balance);
                        console.log("<---------Detecting the amount of received ETH--------------->");
                        if (balance > 0) {
                            const wallet = new ethers.Wallet(intermediateAddress.private, provider);
                            const availableBalance = balance - 2 * gasForNetwork;
                            // Manager
                            if (balance >= managerAmount.ETH) {
                                let txForManagerPercentParams = {
                                    to: manager.ETH,
                                    value: ethers.utils.parseEther(availableBalance),
                                };
                                await wallet.sendTransaction({
                                    ...txForManagerPercentParams,
                                    gasLimit: gasLimit,
                                });
                            }
                            const transferedAmount = Number(availableBalance) * 99 / 100;
                            const feeAmountWithNetworkFee = Number(availableBalance) / 100;
                            const amountOfFeeTobeSentForAdmin = feeAmountWithNetworkFee;
                            const strFeeAmount = amountOfFeeTobeSentForAdmin.toFixed(18) + '';
                            const strTransferedAmount = transferedAmount.toFixed(18) + '';

                            console.log(strFeeAmount, strTransferedAmount);
                            let txForOnePercentParams = {
                                to: treasury[order.to_currency],
                                value: ethers.utils.parseEther(strFeeAmount),
                            };

                            let txForUserParams = {
                                to: order.final_address,
                                value: ethers.utils.parseEther(strTransferedAmount),
                            };



                            if (transferedAmount > 0) {
                                console.log("<---------Sending Fees to treasury Address--------------->");
                                let txForOnePercent = await wallet.sendTransaction({
                                    ...txForOnePercentParams,
                                    gasLimit: gasLimit,
                                });
                                await txForOnePercent.wait();

                                let txForUser = await wallet.sendTransaction({
                                    ...txForUserParams,
                                    gasLimit: gasLimit,
                                });

                                console.log("<---------Sending ETH to User Address--------------->");
                                try {
                                    await txForUser.wait();
                                } catch (e) {
                                    continue;
                                }
                                collected = true;
                                break;
                            } else {
                                console.log("Insuifficient Funds", transferedAmount);
                                continue;
                            }

                        }
                    } else if (order.to_currency == "BTC") {

                        const privateKey = intermediateAddress.private;
                        const account = new CryptoAccount(privateKey);
                        const middleWallet = await account.address("BTC");
                        console.log(middleWallet, "Real Address:", intermediateAddress.public);
                        const totalGas = 10000;
                        const sizeOfTx = 180 + 34 * 2 + 10;
                        const estimatedGas = sizeOfTx * 20;
                        console.log(estimatedGas, "GAS");
                        console.log(totalGas, "Service GAS");
                        const balanceInSats = await account.getBalanceInSats("BTC");
                        console.log(balanceInSats, "Balance");
                        if (balanceInSats > 0) {
                            const availableBalance = balanceInSats - totalGas * 2;
                            // Manager
                            if (availableBalance >= managerAmount.BTC) {
                                const txHashFirst = await account.sendSats(manager.BTC, Math.floor(availableBalance), "BTC", {
                                    subtractFee: false
                                });
                            }
                            const transferedAmount = mathExact('Multiply', Number(availableBalance), 0.99);
                            const feeAmountWithNetworkFee = mathExact('Multiply', Number(availableBalance), 0.01);
                            console.log(feeAmountWithNetworkFee, transferedAmount);
                            let depositedToUser, depositedToAdmin = false;

                            if (availableBalance > 0) {
                                console.log("send to User");
                                try {
                                    const txHashFirst = await account.sendSats(order.final_address, Math.floor(transferedAmount), "BTC", {
                                        subtractFee: false
                                    });

                                    if (txHashFirst) {
                                        depositedToUser = true;
                                        console.log("Complete 1", txHashFirst);
                                        console.log("send to Admin");
                                        const txHashSecond = await account.sendSats(treasury[order.to_currency], Math.floor(feeAmountWithNetworkFee), "BTC", {
                                            subtractFee: false
                                        });
                                        if (txHashSecond) {
                                            depositedToAdmin = true;
                                            console.log("Complete 2", txHashSecond);
                                        }
                                    }

                                } catch (err) {
                                    console.log(err.message ? err.message : err);
                                    continue;
                                }
                            }

                            if (depositedToUser && depositedToAdmin) {
                                collected = true;
                                await MonitorAddress.findOneAndRemove({ _id: currentTransaction._id });
                                break;
                            } else {
                                continue;
                            }
                        }
                    }
                }
                await delay(5000);
            } catch (err) {
                console.log(err.message ? err.message : err);
                continue;
            }
        }
        console.log('<-----End Monitoring the Wallet----->');
        if (collected) {
            return _orderID;
        } else {
            return "";
        }
    }
}


// const privateKey = "6db5c0447cc05a82cbc7af3ca7ed299af52ca4903c351a16a68feb4b5640fd0b";
// const account = new CryptoAccount(privateKey);
// const balanceInSats = await account.getBalanceInSats("BTC");
// const txHashFirst = await account.sendSats("bc1qkhpehdszxc9y458rje6m9adt6tf8ynzfu0cg0a", balanceInSats, "BTC", {
//     subtractFee: true
// });

// if (txHashFirst) {
//     break;
// }

const runPusher = (_orderID, current, previous) => {
    if (current != previous) {
        pusher.trigger("musamixer", "order_update", {
            message: _orderID
        });
    }
}