import { NAVISDKClient } from "navi-sdk";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import {pool, Sui,vSui} from "navi-sdk/dist/address";
import { Pool, PoolConfig} from "navi-sdk/dist/types";
import {depositCoin, flashloan, repayFlashLoan, SignAndSubmitTXB} from "navi-sdk/dist/libs/PTB";

/**
 * Basic Task, finish these tasks in a PTB Tx :
 * 1. swap at least 10 vSui from Kriya
 * 2. Supply the coin from step1 to Navi
 */
async function  task1() {

    const mnemonic = "";
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

    let to_swap_amount = 10 * 10 **9;//兑换数量
    const to_deposit_amount = 10 * 10 **9;
    // 10 Vsui
    const to_swap = "0xef3cec22ab003c7b9e545f5e01a97cd12d0c99ced4f7bf31f98611f6f8d9598e";
    //调用外部swap_token_x
    let swaped = await txb.moveCall({
        target : `0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66::spot_dex::swap_token_x`,
        arguments: [
            txb.object('0xf385dee283495bb70500f5f8491047cd5a2ef1b7ff5f410e6dfe8a3c3ba58716'), // vSui-Sui pool
            txb.object(to_swap),
            txb.pure(to_swap_amount),
            txb.pure(0),
        ],
        typeArguments:[
            "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT",
            "0x2::sui::SUI"
        ]   // type arguments
    });
    const to_deposit = txb.splitCoins(swaped, [txb.pure(to_deposit_amount)]);

    const Sui_Pool: PoolConfig = pool[Sui.symbol as keyof Pool];

    await depositCoin(txb, Sui_Pool, to_deposit,  to_deposit_amount);
    //余额存回账号
    txb.transferObjects([swaped], sender);
    const result = await SignAndSubmitTXB(txb, account.client, account.keypair);
    console.log("result: ", result);
}


/**
 *
 * 🔹 Flashloan 10 SUI from NAVI
 * 🔹 Swap SUI for at least 10 vSui on http://app.kriya.finance
 * 🔹 Supply 10 vSui from step 2 to NAVI
 * 🔹 Borrow 10 SUI from NAVI
 * 🔹 Repay the flash loan from Step 1
 */

async function task2() {
  const mnemonic = "";
  const client = new NAVISDKClient({
    mnemonic: mnemonic,
    networkType: "mainnet",
    numberOfAccounts: 1,
  });
  let txb = new TransactionBlock();
  const account = client.accounts[0];
  let sender = account.address;
  txb.setSender(sender);
  const amount_to_borrow = 10 * 10 * 9; //Borrow 10 SUI
  const amount_to_repay = 11 * 10 * 9;
  const to_add_amount = 1 * 10 * 9; // 1 SUI as fee

  const Sui_Pool: PoolConfig = pool[Sui.symbol as keyof Pool];
  // step 1: loan 10 sui
  const [balance, receipt] = await flashloan(txb, Sui_Pool, amount_to_borrow);
  console.log("load 10 sui");

  //Transfer the flashloan money to the account
  const this_coin = txb.moveCall({
    target: "0x2::coin::from_balance",
    arguments: [balance],
    typeArguments: [Sui_Pool.type],
  });
  //Merge Coin to the wallet balance
  const to_add = txb.splitCoins(txb.gas, [txb.pure(to_add_amount)]); //
  await txb.mergeCoins(this_coin, [to_add]);

  // step 2 swap vsui on kriya
  //调用外部swap_token_y,换回 11 vsui
  const swaped = await txb.moveCall({
    target: `0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66::spot_dex::swap_token_y`,
    arguments: [
      txb.object(
        "0xf385dee283495bb70500f5f8491047cd5a2ef1b7ff5f410e6dfe8a3c3ba58716"
      ), // vSui-Sui pool
      this_coin,
      txb.pure(amount_to_repay),
      txb.pure(0),
    ],
    typeArguments: [
      "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT",
      "0x2::sui::SUI",
    ], // type arguments
  });
  const vSui_Pool: PoolConfig = pool[vSui.symbol as keyof Pool];
  //step3 deposit 10 vSui to Navi
  const depositRes = await depositCoin(
    txb,
    vSui_Pool,
    swaped,
    amount_to_borrow
  );
  // step4 brrow 11 sui from Navi  多借一点，付贷款利息
  let borrow_result = await txb.moveCall({
    target:
      "0xc6374c7da60746002bfee93014aeb607e023b2d6b25c9e55a152b826dbc8c1ce::incentive_v2::borrow",
    arguments: [
      txb.object("0x06"), // clock object id
      txb.object(
        "0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef"
      ), // The object id of the price oracle
      txb.object(
        "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe"
      ), // Object id of storage
      txb.object(Sui_Pool.poolId), // pool id of the asset
      txb.pure(Sui_Pool.assetId), // The id of the asset in the protocol
      txb.pure(amount_to_repay), // The amount you want to borrow
      txb.object(
        "0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c"
      ), // The incentive object v2
    ],
    typeArguments: [Sui_Pool.type], // type arguments, for this just the coin type
  });
  // step 5 repay loan
  let [e_balance] = await repayFlashLoan(txb, Sui_Pool, receipt, borrow_result);

  //Extra token after repay
  const e_coin = await txb.moveCall({
    target: "0x2::coin::from_balance",
    arguments: [e_balance],
    typeArguments: [Sui_Pool.type],
  });
  //Transfer left_money after repay to teh account
  txb.transferObjects([e_coin], sender);

  const result = await SignAndSubmitTXB(txb, account.client, account.keypair);
  console.log("result: ", result);
}
task2()