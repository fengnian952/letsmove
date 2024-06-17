
import {NAVISDKClient} from "navi-sdk";
import {TransactionBlock} from "@mysten/sui.js/transactions";
import {pool, Sui, vSui} from "navi-sdk/dist/address";
import {Pool, PoolConfig} from "navi-sdk/dist/types";
import {borrowCoin, flashloan, repayFlashLoan, SignAndSubmitTXB} from "navi-sdk/dist/libs/PTB";
require('dotenv').config()

/**
 * Prerequisites:
 *
 * - The task needs to be done in a single PTB.
 * - Before using NAVI-SDK, use dotenv to get your mnemonic
 * - Use NAVI-SDK to complete the task
 *
 * Here’s the chain of actions you need to achieve:
 *
 * 1. FlashLoan 50% of 10 SUI
 * 2. Merge the loaned SUI to your wallet Sui object to obtain 15 SUI + gas
 * 3. Stake 15 SUI to vSUI via the voloSui staking contract
 * 4. Supply the vSUI from step 3 to NAVI
 * 5. Borrow 5 SUI * (1 + 0.06% flashloan-fee)
 * 6. Repay the flashloan using the asset from step 5
 */


/**
 * 1. npm i dotenv 安装包
 * 2. 添加.env文件，增加MNEMONIC=''配置
 * 3. 加载 env config
 */
async function task8() {

   const mnemonic =  process.env.MNEMONIC
    const client = new NAVISDKClient({
        mnemonic: mnemonic,
        networkType: "mainnet",
        numberOfAccounts: 1,
    });
    let txb = new TransactionBlock();
    const account = client.accounts[0];
    let sender = account.address;
    console.log("address: ", sender)
    txb.setSender(sender);

    // step 1 FlashLoan 5 SUI
    let to_flashloan_amount = (10*10**9) * 0.5;
    const Sui_Pool: PoolConfig = pool[Sui.symbol as keyof Pool];

    let [flvsuicoin,receipt] = await flashloan(txb,  Sui_Pool,to_flashloan_amount);

    const this_coin = await txb.moveCall({
        target: '0x2::coin::from_balance',
        arguments: [flvsuicoin],
        typeArguments: [Sui_Pool.type],
    });

    // step2 Merge coin  15 SUI, add 1 SUI as gas fee ,total: 16 SUI
    let to_add_amount = 11 *10**9 // contain gas fee
    const to_add = txb.splitCoins(txb.gas, [txb.pure(to_add_amount)]);//
    await txb.mergeCoins(this_coin,[to_add]);

    // step3 Stake 15 SUI
    let recvvSui = await txb.moveCall({
        target : `0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::native_pool::stake_non_entry`,
        arguments: [
            txb.object('0x7fa2faa111b8c65bea48a23049bfd81ca8f971a262d981dcd9a17c3825cb5baf'),
            txb.object('0x680cd26af32b2bde8d3361e804c53ec1d1cfe24c7f039eb7f549e8dfde389a60'),
            txb.object("0x05"),
            this_coin,
        ],
        typeArguments:[]// type arguments
    });

    const vsui_pool: PoolConfig = pool[vSui.symbol as keyof Pool];
    const e_value = await txb.moveCall({
        target: '0x2::coin::value',
        arguments: [recvvSui],
        typeArguments: [vsui_pool.type],
    });
    // step4  Supply the vSUI
    await txb.moveCall({
        target: `0xc6374c7da60746002bfee93014aeb607e023b2d6b25c9e55a152b826dbc8c1ce::incentive_v2::entry_deposit`,
        arguments: [
            txb.object('0x06'),
            txb.object('0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe'),
            txb.object(vsui_pool.poolId),
            txb.pure(vsui_pool.assetId),
            recvvSui,
            e_value,
            txb.object('0xaaf735bf83ff564e1b219a0d644de894ef5bdc4b2250b126b2a46dd002331821'),
            txb.object('0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c'),
        ],
        typeArguments: [vsui_pool.type],
    }) ;


    // step5  Borrow 5 SUI * (1 + 0.06% flashloan-fee)
    let to_borrow_amount = (5*10**9) * (1 + 0.06);
    let [borrowed] = await borrowCoin(txb,Sui_Pool,to_borrow_amount);

    const repayBalance = txb.moveCall({
        target: '0x2::coin::into_balance',
        arguments: [borrowed],
        typeArguments: [Sui_Pool.type],
    });

    // step 6 repay loan
    let [e_balance] = await repayFlashLoan(txb,Sui_Pool,receipt,repayBalance);

    //Extra token after repay
    const e_coin = await txb.moveCall({
        target: '0x2::coin::from_balance',
        arguments: [e_balance],
        typeArguments: [Sui_Pool.type],
    });

    //Transfer left_money after repay to  account
    txb.transferObjects([e_coin], sender);

    const result = await SignAndSubmitTXB(txb, account.client, account.keypair);
    console.log("result: ", result);

}

task8()